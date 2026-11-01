// engine.ts — ต่อ service ของ backend เข้ากับสคริปต์ประเมินผล (โหมด B: ไม่เปิดเซิร์ฟเวอร์ ไม่ผ่าน HTTP)
//
// อ่านอย่างเดียว: ไม่สร้าง SessionStore/ExecutionService จึงไม่มีทางเขียนแถวลง DB (มีแค่ SELECT โหลดผัง)
// ไม่แก้โค้ด production: import class จริงของ backend/src มาประกอบเอง (ลำดับเดียวกับ backend/src/app.ts)

import * as path from 'path';
import { createDbPool } from '../../backend/src/database/pool';
import { EMBEDDING_MODEL_ID, EmbeddingService } from '../../backend/src/embedding/embedding.service';
import { FlowRepository } from '../../backend/src/execution/flow.repository';
import type { ManualSummary } from '../../backend/src/execution/flow.repository';
import { SymptomSearchService } from '../../backend/src/symptom-search/symptom-search.service';
import type { DeviceCategory, TroubleshootingFlow } from '../../backend/src/state-machine/types';

const BACKEND_DIR = path.resolve(__dirname, '../../backend');

/** DB ที่ใช้ประเมินผลโดยเฉพาะ (seed จาก data/manuals/*.json) — ไม่ใช้ DB_NAME ใน .env เด็ดขาด กันเผลอไปอ่าน/ผูกผลกับ DB จริง */
export const EVAL_DB_NAME = process.env.EVAL_DB_NAME ?? 'fixbot_eval';

/** แปลงค่า device ใน real-cases.json → DeviceCategory ของ backend · ไม่รู้จัก = โยน error (ไม่เดา) */
const DEVICE_TH_TO_CATEGORY: Record<string, DeviceCategory> = {
  'ไมโครเวฟ': 'Microwave',
  'ตู้เย็น': 'Refrigerator',
  'เครื่องซักผ้า': 'Washing Machine',
};

export function deviceCategoryOf(deviceTh: string): DeviceCategory {
  const category = DEVICE_TH_TO_CATEGORY[deviceTh];
  if (category === undefined) {
    throw new Error(`ไม่รู้จัก device '${deviceTh}' — เพิ่มใน DEVICE_TH_TO_CATEGORY ของ engine.ts เองถ้าต้องการ`);
  }
  return category;
}

/** top-N ที่รายงาน (นิยาม top3_hit) */
export const TOP_N = 3;

/** SymptomSearchService คืนไม่เกิน 3 ผังต่อคู่มือ (MAX_RESULTS ใน symptom-search.service.ts ไม่ถูก export จึงบันทึกค่าไว้ตรงนี้) — ใช้บอกว่ากลุ่มที่เสมอกันอาจถูกตัด */
export const PER_MANUAL_CAP = 3;

const INDEX_READY_TIMEOUT_MS = 10 * 60 * 1000;

export interface DeviceMatch {
  flowId: string;
  manualId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  /** cosine similarity ปัด 3 ตำแหน่งตามที่ service ส่งออก (ค่าเต็มไม่ถูกส่งออกจาก SymptomSearchService) */
  score: number;
  matchedText: string;
}

export interface DeviceSearchResult {
  device: DeviceCategory;
  /** คู่มือของ device นี้ที่ค้น — บันทึกเป็นฟิลเตอร์ที่ใช้ (ไม่ส่ง brand/model) */
  manualsSearched: string[];
  /** เกณฑ์ที่ service ใช้จริง (อ่านจาก response ไม่ hard-code) */
  threshold: number;
  /** similarity สูงสุดของผังใดๆ ใน device นี้ แม้ต่ำกว่าเกณฑ์ · null = ไม่มีผังเลย */
  bestScore: number | null;
  /** ผังที่ score >= threshold เรียงมากไปน้อย ไม่เกิน TOP_N · ว่าง = refused */
  matches: DeviceMatch[];
  /** ผังที่ score >= threshold ทั้งหมดที่ service คืน (ไม่เกิน PER_MANUAL_CAP ต่อคู่มือ) เรียง score มากไปน้อย — ใช้หากลุ่มที่ score เสมอกัน */
  candidates: DeviceMatch[];
  refused: boolean;
}

export interface EvalEngine {
  dbName: string;
  embeddingModel: string;
  manuals: ManualSummary[];
  flowCount: number;
  searchDevice(query: string, device: DeviceCategory): Promise<DeviceSearchResult>;
  getFlow(flowId: string): TroubleshootingFlow | undefined;
  /** ผังทุกอันของ device นี้ (ใช้ตรวจ seed ว่าคำไหนไม่เคยโผล่ใน device นั้นเลย) */
  flowsOfDevice(device: DeviceCategory): TroubleshootingFlow[];
  close(): Promise<void>;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitUntilReady(search: SymptomSearchService): Promise<void> {
  const started = Date.now();
  for (;;) {
    const { state, error } = search.getStatus();
    if (state === 'ready') return;
    if (state === 'failed') throw new Error(`ดัชนีค้นหาโหลดไม่สำเร็จ: ${error}`);
    if (Date.now() - started > INDEX_READY_TIMEOUT_MS) {
      throw new Error(`ดัชนีค้นหายังไม่พร้อมหลัง ${INDEX_READY_TIMEOUT_MS / 1000} วินาที (สถานะ ${state})`);
    }
    await sleep(500);
  }
}

export async function createEvalEngine(): Promise<EvalEngine> {
  // ต้องตั้ง DB_NAME ก่อน dotenv — dotenv ไม่เขียนทับตัวแปรที่มีอยู่แล้ว จึงได้ fixbot_eval เสมอ
  process.env.DB_NAME = EVAL_DB_NAME;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(path.join(BACKEND_DIR, 'node_modules', 'dotenv')).config({ path: path.join(BACKEND_DIR, '.env') });
  // ปิดเป็นค่าเริ่มต้นใน production · ที่นี่ต้องเปิดเพื่อสร้างดัชนี embedding (ไม่มีผลกับเซิร์ฟเวอร์จริง เพราะตั้งใน process นี้เท่านั้น)
  process.env.SYMPTOM_SEARCH_ENABLED = 'true';

  const pool = await createDbPool();
  const flows = new FlowRepository(pool);
  await flows.load();

  const manuals = flows.listManuals();
  if (manuals.length === 0) {
    await pool.end();
    throw new Error(`ฐานข้อมูล '${EVAL_DB_NAME}' ไม่มีคู่มือเลย — seed ก่อน (backend: node scripts/seed-flows.js <ไฟล์>)`);
  }

  const search = new SymptomSearchService(new EmbeddingService(), flows);
  search.start();
  await waitUntilReady(search);

  return {
    dbName: EVAL_DB_NAME,
    embeddingModel: EMBEDDING_MODEL_ID,
    manuals,
    flowCount: flows.listAll().length,

    async searchDevice(query, device) {
      const manualIds = manuals.filter((m) => m.deviceCategory === device).map((m) => m.manualId);
      if (manualIds.length === 0) {
        throw new Error(`ไม่มีคู่มือของ ${device} ใน '${EVAL_DB_NAME}'`);
      }

      // search() รับได้แค่ manualId · ค้นทีละคู่มือแล้วรวม — top-N รวม ⊆ ผลของแต่ละคู่มือ (service คืน top-3 ต่อคู่มือ) จึงไม่ตกหล่น
      const merged: DeviceMatch[] = [];
      let threshold = Number.NaN;
      let bestScore: number | null = null;
      for (const manualId of manualIds) {
        const result = await search.search(query, manualId);
        threshold = result.threshold;
        if (result.bestScore !== null && (bestScore === null || result.bestScore > bestScore)) {
          bestScore = result.bestScore;
        }
        for (const m of result.matches) {
          merged.push({ ...m, manualId });
        }
      }

      merged.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.flowId < b.flowId ? -1 : a.flowId > b.flowId ? 1 : 0));
      const matches = merged.slice(0, TOP_N);

      return { device, manualsSearched: manualIds, threshold, bestScore, matches, candidates: merged, refused: matches.length === 0 };
    },

    getFlow: (flowId) => flows.findById(flowId),

    flowsOfDevice(device) {
      return flows
        .listAll()
        .filter((f) => f.deviceCategory === device)
        .map((f) => flows.findById(f.flowId))
        .filter((f): f is TroubleshootingFlow => f !== undefined);
    },

    close: () => pool.end(),
  };
}
