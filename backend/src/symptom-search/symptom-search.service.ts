import { createLogger } from '../common/logger';
import { ApiError } from '../common/api-error';
import { round3 } from '../common/helpers';
import { FlowRepository } from '../execution/flow.repository';
import type { DeviceCategory } from '../state-machine/types';
import {EMBEDDING_DTYPE,EMBEDDING_MODEL_ID,EmbeddingService,} from '../embedding/embedding.service'
import {buildSymptomTexts,rankFlows,selectMatches, type IndexedSymptom,type SymptomSource } from './symptom-matcher';
import type {SearchState,SearchStatusDto,SymptomSearchResponseDto,} from './symptom-search.dto';


const MATCH_THRESHOLD = 0.55;
const MAX_RESULTS = 3;
const ENABLE_ENV_NAME = 'SYMPTOM_SEARCH_ENABLED';

const searchNotReady = () => new ApiError(503, 'SEARCH_NOT_READY', 'ระบบค้นหากำลังเริ่มทำงาน');
const searchUnavailable = () => new ApiError(503, 'SEARCH_UNAVAILABLE', 'ระบบค้นหาไม่พร้อมใช้งาน');

interface FlowInfo {
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  manualId: string;
}

export class SymptomSearchService {
  private readonly logger = createLogger('SymptomSearchService');

  private state: SearchState = 'disabled';
  private index: IndexedSymptom[] = [];
  private flowInfo = new Map<string, FlowInfo>();
  private loadMs: number | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly embedding: EmbeddingService,
    private readonly flows: FlowRepository,
  ) {}

  /**
   * เริ่มระบบค้นหา — app.ts เรียกตอนบูต
   * คืน void (ไม่รอ) โดยตั้งใจ: โหลดโมเดลช้ามาก ถ้ารอ เซิร์ฟเวอร์จะเปิดรับคำขอไม่ได้ (/health ตอบไม่ได้)
   * จึงสั่งโหลดเบื้องหลัง แล้วให้ /symptom-search/status บอกความคืบหน้าแทน
   * ปิดเป็นค่าเริ่มต้น: ต้องตั้ง SYMPTOM_SEARCH_ENABLED=true จึงโหลดโมเดล
   */
  start(): void {
    if (process.env[ENABLE_ENV_NAME] !== 'true') {
      this.state = 'disabled';
      this.logger.log(`ระบบค้นหาอาการปิดอยู่ (ตั้ง ${ENABLE_ENV_NAME}=true เพื่อเปิด)`);
      return;
    }

    this.state = 'loading';
    void this.prepareIndex();
  }

  private async prepareIndex(): Promise<void> {
    this.state = 'loading';
    this.lastError = null;
    const started = Date.now();

    try {
      await this.embedding.load();

      const fullFlows: SymptomSource[] = [];
      const info = new Map<string, FlowInfo>();
      for (const summary of this.flows.listAll()) {
        const flow = this.flows.findById(summary.flowId);
        if (!flow) continue;
        fullFlows.push(flow);
        info.set(flow.flow_id, {
          entrySymptom: flow.entry_symptom,
          entrySymptomTh: flow.entry_symptom_th,
          deviceCategory: flow.device_category,
          manualId: flow.manual_id,
        });
      }

      // ข้อความเดียวกันจากหลายคู่มือ (เช่น "ทีวีปิดเอง") ทำเวกเตอร์ครั้งเดียวแล้วใช้ร่วมกัน
      const vectors = new Map<string, Float32Array>();
      const index: IndexedSymptom[] = [];
      for (const item of buildSymptomTexts(fullFlows)) {
        let vector = vectors.get(item.text);
        if (vector === undefined) {
          vector = await this.embedding.embed(item.text);
          vectors.set(item.text, vector);
        }
        index.push({ ...item, vector });
      }

      this.index = index;
      this.flowInfo = info;
      this.loadMs = Date.now() - started;
      this.state = 'ready';
      this.logger.log(
        `ระบบค้นหาพร้อม: ${index.length} ข้อความ จาก ${info.size} ผัง ใน ${this.loadMs} ms`,
      );
    } catch (err) {
      this.state = 'failed';
      this.lastError = err instanceof Error ? err.message : String(err);
      this.logger.error(`ระบบค้นหาโหลดไม่สำเร็จ: ${this.lastError}`);
    }
  }

  async addFlows(flowIds: string[]): Promise<{ indexed: boolean; addedTexts: number; reason?: string }> {
    if (this.state !== 'ready') {
      const reason =
        this.state === 'disabled' ? 'ระบบค้นหาปิดอยู่ (SYMPTOM_SEARCH_ENABLED ไม่ใช่ true)' : `ดัชนียังไม่พร้อม (สถานะ ${this.state})`;
      return { indexed: false, addedTexts: 0, reason };
    }

    try {
      const wanted = new Set(flowIds);
      const flows: SymptomSource[] = [];
      const info = new Map(this.flowInfo);
      for (const id of wanted) {
        const flow = this.flows.findById(id);
        if (!flow) continue;
        flows.push(flow);
        info.set(flow.flow_id, {
          entrySymptom: flow.entry_symptom,
          entrySymptomTh: flow.entry_symptom_th,
          deviceCategory: flow.device_category,
          manualId: flow.manual_id,
        });
      }

      // ข้อความเดิมที่ embed ไว้แล้วใช้เวกเตอร์ซ้ำได้ (ข้อความเดียวกัน = เวกเตอร์เดียวกัน)
      const known = new Map<string, ArrayLike<number>>();
      for (const item of this.index) known.set(item.text, item.vector);

      const added: IndexedSymptom[] = [];
      for (const item of buildSymptomTexts(flows)) {
        let vector = known.get(item.text);
        if (vector === undefined) {
          vector = await this.embedding.embed(item.text);
          known.set(item.text, vector);
        }
        added.push({ ...item, vector });
      }

      this.index = [...this.index.filter((item) => !wanted.has(item.flowId)), ...added];
      this.flowInfo = info;
      this.logger.log(`เพิ่มผังเข้าดัชนีค้นหา ${flows.length} ผัง (${added.length} ข้อความ)`);
      return { indexed: true, addedTexts: added.length };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`เพิ่มผังเข้าดัชนีค้นหาไม่สำเร็จ: ${reason}`);
      return { indexed: false, addedTexts: 0, reason };
    }
  }

  async search(query: string, manualId?: string): Promise<SymptomSearchResponseDto> {
    if (this.state === 'loading') throw searchNotReady();
    if (this.state !== 'ready') throw searchUnavailable();

    const queryVector = await this.embedding.embed(query);
    const candidates =
      manualId === undefined
        ? this.index
        : this.index.filter((item) => this.flowInfo.get(item.flowId)?.manualId === manualId);
    const ranked = rankFlows(queryVector, candidates);

    // เทียบเกณฑ์ด้วยค่าเต็ม แล้วค่อยปัดเศษตอนส่งออก
    const matches = selectMatches(ranked, MATCH_THRESHOLD, MAX_RESULTS).map(
      (r) => {
        const info = this.flowInfo.get(r.flowId) as FlowInfo;
        return {
          flowId: r.flowId,
          entrySymptom: info.entrySymptom,
          entrySymptomTh: info.entrySymptomTh,
          deviceCategory: info.deviceCategory,
          score: round3(r.score),
          matchedText: r.matchedText,
        };
      },
    );

    return {
      query,
      threshold: MATCH_THRESHOLD,
      bestScore: ranked.length > 0 ? round3(ranked[0].score) : null,
      matches,
    };
  }
  async scoreFlow(query: string, flowId: string): Promise<number | null> {
    if (this.state !== 'ready') return null;

    const ranked = rankFlows(await this.embedding.embed(query), this.index);
    const hit = ranked.find((r) => r.flowId === flowId);
    return hit ? round3(hit.score) : null;
  }
  getStatus(): SearchStatusDto {
    return {
      state: this.state,
      model: EMBEDDING_MODEL_ID,
      dtype: EMBEDDING_DTYPE,
      indexedTexts: this.index.length,
      indexedFlows: this.flowInfo.size,
      loadMs: this.loadMs,
      modelFilesFoundLocally: this.embedding.modelFilesFoundLocally,
      error: this.lastError,
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  }
}