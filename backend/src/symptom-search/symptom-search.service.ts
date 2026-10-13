import {Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { GraphRepository } from '../traversal/graph.repository';
import type { DeviceCategory } from '../traversal-engine/types';
import {EMBEDDING_DTYPE,EMBEDDING_MODEL_ID,EmbeddingService,} from '../embedding/embedding.service'
import {buildSymptomTexts,rankGraphs,selectMatches,
  type IndexedSymptom,type SymptomSource, } from './symptom-matcher';
import type {SearchState,SearchStatusDto,SymptomSearchResponseDto,} from './symptom-search.dto';


export const MATCH_THRESHOLD = 0.55;
const MAX_RESULTS = 3;
export const ENABLE_ENV_NAME = 'SYMPTOM_SEARCH_ENABLED';

export class SearchNotReadyError extends Error {
  constructor() {
    super('ระบบค้นหากำลังเริ่มทำงาน');
    this.name = this.constructor.name;
  }
}

export class SearchUnavailableError extends Error {
  constructor() {
    super('ระบบค้นหาไม่พร้อมใช้งาน');
    this.name = this.constructor.name;
  }
}

interface GraphInfo {
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

@Injectable()
export class SymptomSearchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SymptomSearchService.name);

  private state: SearchState = 'disabled';
  private index: IndexedSymptom[] = [];
  private graphInfo = new Map<string, GraphInfo>();
  private loadMs: number | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly embedding: EmbeddingService,
    private readonly graphs: GraphRepository,
  ) {}

  /**
   * NestJS เรียกตอนแอปบูตเสร็จ
   *
   * ⚠️ คืน void ไม่ใช่ Promise โดยตั้งใจ
   * ถ้าคืน Promise NestJS จะรอโหลดโมเดลเสร็จก่อนเปิดรับ request
   * ระหว่างนั้น /health และด่านความปลอดภัยจะตอบไม่ได้ (Render free โหลดช้ามาก)
   * จึงสั่งโหลดแบบไม่รอ แล้วให้ /symptom-search/status บอกความคืบหน้าแทน
   *
   * ปิดไว้เป็นค่าเริ่มต้น: ต้องตั้ง SYMPTOM_SEARCH_ENABLED=true จึงโหลดโมเดล
   * กันกรณีหน่วยความจำเกินแล้วเซิร์ฟเวอร์ล่มทั้งตัว
   */
  onApplicationBootstrap(): void {
    if (process.env[ENABLE_ENV_NAME] !== 'true') {
      this.state = 'disabled';
      this.logger.log(`ระบบค้นหาอาการปิดอยู่ (ตั้ง ${ENABLE_ENV_NAME}=true เพื่อเปิด)`);
      return;
    }

    this.state = 'loading';
    void this.prepareIndex();
  }

  /**
   * โหลดโมเดล แล้วแปลงข้อความอาการทุกข้อความเป็นเวกเตอร์เก็บในหน่วยความจำ
   *
   * ไม่โยน error ออกไป: ล้มเหลวแล้วสถานะเป็น 'failed' เซิร์ฟเวอร์ที่เหลือทำงานต่อได้
   * (public เพื่อให้เทสเรียกและรอผลได้)
   */
  async prepareIndex(): Promise<void> {
    this.state = 'loading';
    this.lastError = null;
    const started = Date.now();

    try {
      await this.embedding.load();

      // listAll() ไม่มีคำพ้อง จึงเอา id มาเรียก findById() เพื่อได้ผังเต็ม
      const fullGraphs: SymptomSource[] = [];
      const info = new Map<string, GraphInfo>();
      for (const summary of this.graphs.listAll()) {
        const graph = this.graphs.findById(summary.graphId);
        if (!graph) continue;
        fullGraphs.push(graph);
        info.set(graph.graph_id, {
          entrySymptom: graph.entry_symptom,
          entrySymptomTh: graph.entry_symptom_th,
          deviceCategory: graph.device_category,
        });
      }

      // ทีละข้อความ (ไม่ขนาน) เพราะ CPU มีน้อยและอยากให้ใช้หน่วยความจำคงที่
      const index: IndexedSymptom[] = [];
      for (const item of buildSymptomTexts(fullGraphs)) {
        index.push({ ...item, vector: await this.embedding.embed(item.text) });
      }

      this.index = index;
      this.graphInfo = info;
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

  /**
   * ค้นหาผังขั้นตอนที่ตรงกับคำค้น
   * รับข้อความที่ผ่าน parseSearchBody แล้ว (ตัดช่องว่าง ตรวจความยาวแล้ว)
   */
  async search(query: string): Promise<SymptomSearchResponseDto> {
    if (this.state === 'loading') throw new SearchNotReadyError();
    if (this.state !== 'ready') throw new SearchUnavailableError();

    const queryVector = await this.embedding.embed(query);
    const ranked = rankGraphs(queryVector, this.index);

    // เทียบเกณฑ์ด้วยค่าเต็ม แล้วค่อยปัดเศษตอนส่งออก
    const matches = selectMatches(ranked, MATCH_THRESHOLD, MAX_RESULTS).map(
      (r) => {
        const info = this.graphInfo.get(r.graphId) as GraphInfo;
        return {
          graphId: r.graphId,
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
      // ส่งเสมอแม้ไม่มีผังผ่านเกณฑ์ (null = ไม่มีผังให้เทียบเลย)
      bestScore: ranked.length > 0 ? round3(ranked[0].score) : null,
      matches,
    };
  }

  /**
   * คะแนนความคล้ายระหว่างคำค้นกับผัง "ที่ระบุ" (ปัด 3 ตำแหน่ง) ไว้เป็นคะแนนความมั่นใจของ session
   *
   * คืน null (ไม่โยน error) เมื่อระบบค้นหาไม่พร้อม หรือผังนี้ไม่อยู่ในดัชนี
   * เพราะคะแนนเป็นข้อมูลเสริมที่แสดงผลอย่างเดียว ห้ามทำให้การเริ่ม session ล้มเหลว
   * ไม่แต่งตัวเลขแทน: ไม่มีค่าที่วัดได้ = null
   */
  async scoreGraph(query: string, graphId: string): Promise<number | null> {
    if (this.state !== 'ready') return null;

    const ranked = rankGraphs(await this.embedding.embed(query), this.index);
    const hit = ranked.find((r) => r.graphId === graphId);
    return hit ? round3(hit.score) : null;
  }

  /** สถานะของระบบค้นหา (ไว้ตรวจหน่วยความจำและความคืบหน้าบน Render) */
  getStatus(): SearchStatusDto {
    return {
      state: this.state,
      model: EMBEDDING_MODEL_ID,
      dtype: EMBEDDING_DTYPE,
      indexedTexts: this.index.length,
      indexedGraphs: this.graphInfo.size,
      loadMs: this.loadMs,
      modelFilesFoundLocally: this.embedding.modelFilesFoundLocally,
      error: this.lastError,
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  }
}