// backend/src/symptom-search/symptom-search.service.spec.ts

/**
 * เทสตรรกะของ SymptomSearchService
 *
 * ไม่โหลดโมเดลจริง ไม่ต่อ MySQL:
 *   - ตัวแปลงข้อความปลอมแบบ one-hot: ข้อความตัวแทนลำดับที่ i ได้เวกเตอร์ที่มี 1 ในมิติ i
 *     ค้นด้วยข้อความตัวแทนตรงๆ จึงได้คะแนน 1 กับผังของมัน และ 0 กับผังอื่น
 *     (คะแนน 1 และ 0 ไม่ขึ้นกับค่าเกณฑ์ที่จะปรับในขั้น 1.9)
 *   - GraphRepository ปลอม สร้างจากไฟล์ผังแอร์จริง 13 ชุด
 *
 * เทสนี้พิสูจน์ "การต่อสาย" (ลำดับการเรียก สถานะ การแปลง error)
 * ไม่ได้พิสูจน์คุณภาพการค้นหาของโมเดลจริง (นั่นคือขั้น 1.9)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '@nestjs/common';

import type { GraphRepository } from '../traversal/graph.repository';
import type { ManualFile, TroubleshootingGraph } from '../traversal-engine/types';
import type { EmbeddingService } from '../embedding/embedding.service';
import { buildSymptomTexts } from './symptom-matcher';
import {
  ENABLE_ENV_NAME,
  MATCH_THRESHOLD,
  SearchNotReadyError,
  SearchUnavailableError,
  SymptomSearchService,
} from './symptom-search.service';

// ============================================================
// ข้อมูลจริง + ตัวปลอม
// ============================================================

const manualPath = path.resolve(
  __dirname,
  '../../../data/manuals/samsung_ac_ar70h.json',
);
const realGraphs = (JSON.parse(fs.readFileSync(manualPath, 'utf-8')) as ManualFile)
  .graphs;

/** GraphRepository ปลอม มีเฉพาะ 2 เมธอดที่ service ใช้ */
function fakeRepo(graphs: TroubleshootingGraph[]): GraphRepository {
  return {
    listAll: () =>
      graphs.map((g) => ({
        graphId: g.graph_id,
        entrySymptom: g.entry_symptom,
        entrySymptomTh: g.entry_symptom_th,
        deviceCategory: g.device_category,
        brand: g.brand,
        modelPattern: g.model_pattern,
      })),
    findById: (id: string) => graphs.find((g) => g.graph_id === id),
  } as unknown as GraphRepository;
}

/** EmbeddingService ปลอม: embedFn กำหนดเวกเตอร์ · loadFn ควบคุมได้ว่าโหลดเสร็จเมื่อไร */
function fakeEmbedding(
  embedFn: (text: string) => number[],
  loadFn: () => Promise<void> = async () => undefined,
): EmbeddingService {
  return {
    load: loadFn,
    embed: async (text: string) => Float32Array.from(embedFn(text)),
    modelFilesFoundLocally: true,
  } as unknown as EmbeddingService;
}

/** one-hot ของข้อความตัวแทนจริง 36 ข้อความ · ข้อความที่ไม่รู้จัก = เวกเตอร์ศูนย์ */
const repTexts = buildSymptomTexts(realGraphs).map((t) => t.text);
const oneHot = (text: string): number[] => {
  const v = new Array<number>(repTexts.length).fill(0);
  const i = repTexts.indexOf(text);
  if (i >= 0) v[i] = 1;
  return v;
};

/** ตัวหน่วง: ให้เทสควบคุมได้ว่า load() เสร็จเมื่อไร */
function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

/** รอจนสถานะไม่ใช่ loading (มีเพดานกันค้าง) */
async function waitUntilSettled(service: SymptomSearchService): Promise<void> {
  for (let i = 0; i < 200 && service.getStatus().state === 'loading'; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

// ============================================================
// เทส
// ============================================================

describe('SymptomSearchService', () => {
  const savedEnv = process.env[ENABLE_ENV_NAME];

  beforeAll(() => Logger.overrideLogger(false)); // ไม่ให้ log รก
  afterAll(() => Logger.overrideLogger(['log', 'error', 'warn']));
  afterEach(() => {
    if (savedEnv === undefined) delete process.env[ENABLE_ENV_NAME];
    else process.env[ENABLE_ENV_NAME] = savedEnv;
  });

  it('prepareIndex: สร้างดัชนีครบ 36 ข้อความ จาก 13 ผัง แล้วสถานะเป็น ready', async () => {
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot),
      fakeRepo(realGraphs),
    );
    await service.prepareIndex();

    const status = service.getStatus();
    expect(status.state).toBe('ready');
    expect(status.indexedTexts).toBe(36);
    expect(status.indexedGraphs).toBe(13);
    expect(status.loadMs).not.toBeNull();
    expect(status.error).toBeNull();
    expect(status.modelFilesFoundLocally).toBe(true);
  });

  it('search: ค้นด้วยข้อความตัวแทนของผังหนึ่ง → ผังนั้นอันดับ 1 คะแนน 1 พร้อมข้อมูลครบ', async () => {
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot),
      fakeRepo(realGraphs),
    );
    await service.prepareIndex();

    const target = realGraphs[0];
    const query = buildSymptomTexts([target])[0].text;
    const res = await service.search(query);

    expect(res.query).toBe(query);
    expect(res.threshold).toBe(MATCH_THRESHOLD);
    expect(res.bestScore).toBe(1);
    expect(res.matches).toHaveLength(1); // ผังอื่นได้ 0 จึงไม่ผ่านเกณฑ์
    expect(res.matches[0]).toEqual({
      graphId: target.graph_id,
      entrySymptom: target.entry_symptom,
      entrySymptomTh: target.entry_symptom_th,
      deviceCategory: target.device_category,
      score: 1,
      matchedText: query,
    });
  });

  it('search: คำค้นที่ไม่ตรงผังไหนเลย → matches ว่าง แต่ยังส่ง bestScore', async () => {
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot),
      fakeRepo(realGraphs),
    );
    await service.prepareIndex();

    const res = await service.search('ข้อความที่ไม่มีในดัชนี');
    expect(res.matches).toEqual([]);
    expect(res.bestScore).toBe(0);
  });

  it('search: คะแนนที่ส่งออกปัด 3 ตำแหน่ง แต่เทียบเกณฑ์ด้วยค่าเต็ม', async () => {
    // ผังเดียว ดัชนี [1,0] · คำค้น [1,1] → cosine = 0.70710678… → ส่งออก 0.707
    const one = [realGraphs[0]];
    const text = buildSymptomTexts(one)[0].text;
    const service = new SymptomSearchService(
      fakeEmbedding((t) => (t === 'query' ? [1, 1] : t === text ? [1, 0] : [0, 1])),
      fakeRepo(one),
    );
    await service.prepareIndex();

    const res = await service.search('query');
    expect(res.bestScore).toBe(0.707);
    expect(res.matches[0].score).toBe(0.707);
  });

  it('search ตอนกำลังโหลด → SearchNotReadyError', async () => {
    const g = gate();
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot, () => g.promise),
      fakeRepo(realGraphs),
    );
    const preparing = service.prepareIndex();

    expect(service.getStatus().state).toBe('loading');
    await expect(service.search('แอร์')).rejects.toThrow(SearchNotReadyError);

    g.open();
    await preparing;
    expect(service.getStatus().state).toBe('ready');
  });

  it('search ตอนปิดสวิตช์ (ยังไม่เคยโหลด) → SearchUnavailableError', async () => {
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot),
      fakeRepo(realGraphs),
    );
    expect(service.getStatus().state).toBe('disabled');
    await expect(service.search('แอร์')).rejects.toThrow(SearchUnavailableError);
  });

  it('โหลดโมเดลล้มเหลว → prepareIndex ไม่โยน error, สถานะ failed, search ได้ SearchUnavailableError', async () => {
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot, async () => {
        throw new Error('ไม่พบไฟล์โมเดล');
      }),
      fakeRepo(realGraphs),
    );

    await expect(service.prepareIndex()).resolves.toBeUndefined();

    const status = service.getStatus();
    expect(status.state).toBe('failed');
    expect(status.error).toBe('ไม่พบไฟล์โมเดล');
    expect(status.indexedTexts).toBe(0);
    await expect(service.search('แอร์')).rejects.toThrow(SearchUnavailableError);
  });

  it('onApplicationBootstrap: ไม่ตั้ง SYMPTOM_SEARCH_ENABLED=true → ไม่โหลดโมเดล สถานะ disabled', () => {
    delete process.env[ENABLE_ENV_NAME];
    const load = jest.fn(async () => undefined);
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot, load),
      fakeRepo(realGraphs),
    );

    const ret = service.onApplicationBootstrap();

    expect(ret).toBeUndefined();
    expect(load).not.toHaveBeenCalled();
    expect(service.getStatus().state).toBe('disabled');
  });

  it("onApplicationBootstrap: เปิดสวิตช์ → คืน void ทันที (ไม่รอโหลด) สถานะ loading แล้วเป็น ready", async () => {
    process.env[ENABLE_ENV_NAME] = 'true';
    const g = gate();
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot, () => g.promise),
      fakeRepo(realGraphs),
    );

    const ret = service.onApplicationBootstrap();

    // ต้องไม่ใช่ Promise: ไม่งั้น NestJS จะรอโหลดเสร็จก่อนเปิดรับ request
    expect(ret).toBeUndefined();
    expect(service.getStatus().state).toBe('loading');

    g.open();
    await waitUntilSettled(service);
    expect(service.getStatus().state).toBe('ready');
  });

  it('SYMPTOM_SEARCH_ENABLED ที่ไม่ใช่ข้อความ "true" เป๊ะๆ ถือว่าปิด', () => {
    for (const value of ['1', 'TRUE', 'yes', '']) {
      process.env[ENABLE_ENV_NAME] = value;
      const service = new SymptomSearchService(
        fakeEmbedding(oneHot),
        fakeRepo(realGraphs),
      );
      service.onApplicationBootstrap();
      expect(service.getStatus().state).toBe('disabled');
    }
  });

  it('scoreGraph: คืนคะแนนของผัง "ที่ระบุ" ไม่ใช่ผังที่คะแนนสูงสุด', async () => {
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot),
      fakeRepo(realGraphs),
    );
    await service.prepareIndex();

    const query = buildSymptomTexts([realGraphs[1]])[0].text;

    expect(await service.scoreGraph(query, realGraphs[1].graph_id)).toBe(1);
    expect(await service.scoreGraph(query, realGraphs[0].graph_id)).toBe(0);
  });

  it('scoreGraph: ระบบค้นหาไม่พร้อม (ปิด/กำลังโหลด/ล้มเหลว) → null ไม่โยน error', async () => {
    const disabled = new SymptomSearchService(fakeEmbedding(oneHot), fakeRepo(realGraphs));
    expect(await disabled.scoreGraph('แอร์', realGraphs[0].graph_id)).toBeNull();

    const g = gate();
    const loading = new SymptomSearchService(
      fakeEmbedding(oneHot, () => g.promise),
      fakeRepo(realGraphs),
    );
    const preparing = loading.prepareIndex();
    expect(await loading.scoreGraph('แอร์', realGraphs[0].graph_id)).toBeNull();
    g.open();
    await preparing;

    const failed = new SymptomSearchService(
      fakeEmbedding(oneHot, async () => {
        throw new Error('ไม่พบไฟล์โมเดล');
      }),
      fakeRepo(realGraphs),
    );
    await failed.prepareIndex();
    expect(await failed.scoreGraph('แอร์', realGraphs[0].graph_id)).toBeNull();
  });

  it('scoreGraph: graphId ที่ไม่อยู่ในดัชนี → null', async () => {
    const service = new SymptomSearchService(
      fakeEmbedding(oneHot),
      fakeRepo(realGraphs),
    );
    await service.prepareIndex();

    expect(await service.scoreGraph('แอร์', 'ไม่มีผังนี้')).toBeNull();
  });
});