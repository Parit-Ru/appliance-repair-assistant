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
  manualId: string;
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
   * (public: เดิมเปิดไว้ให้เทสต์เรียกและรอผล ตอนนี้ถูกเรียกจาก onApplicationBootstrap เท่านั้น)
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
          manualId: graph.manual_id,
        });
      }

      // ทีละข้อความ (ไม่ขนาน) เพราะ CPU มีน้อยและอยากให้ใช้หน่วยความจำคงที่
      // ข้อความเดียวกันจากหลายคู่มือ (เช่น "ทีวีปิดเอง") ทำเวกเตอร์ครั้งเดียวแล้วใช้ร่วมกัน
      const vectors = new Map<string, Float32Array>();
      const index: IndexedSymptom[] = [];
      for (const item of buildSymptomTexts(fullGraphs)) {
        let vector = vectors.get(item.text);
        if (vector === undefined) {
          vector = await this.embedding.embed(item.text);
          vectors.set(item.text, vector);
        }
        index.push({ ...item, vector });
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
   * เพิ่มผังที่เพิ่ง publish เข้าดัชนีที่ทำงานอยู่ โดย embed เฉพาะข้อความของผังเหล่านั้น (ไม่ทำ 600+ ผังใหม่)
   *
   * เรียกหลัง GraphRepository.reload() แล้ว (findById ต้องเห็นผังใหม่)
   * ไม่โยน error: ดัชนีไม่พร้อม/embed ล้ม → คืน indexed=false พร้อมเหตุผล และดัชนีเดิมไม่เปลี่ยน
   * (ผังนั้นถูก publish ไปแล้ว ค้นหาด้วยข้อความจะเจอหลังรีสตาร์ต · เลือกจากรายการอาการเจอทันที)
   * สลับดัชนีใหม่ในครั้งเดียวหลัง embed ครบ จึงไม่มีช่วงที่ค้นหาเห็นผังครึ่งๆ กลางๆ
   */
  async addGraphs(graphIds: string[]): Promise<{ indexed: boolean; addedTexts: number; reason?: string }> {
    if (this.state !== 'ready') {
      const reason =
        this.state === 'disabled' ? 'ระบบค้นหาปิดอยู่ (SYMPTOM_SEARCH_ENABLED ไม่ใช่ true)' : `ดัชนียังไม่พร้อม (สถานะ ${this.state})`;
      return { indexed: false, addedTexts: 0, reason };
    }

    try {
      const wanted = new Set(graphIds);
      const graphs: SymptomSource[] = [];
      const info = new Map(this.graphInfo);
      for (const id of wanted) {
        const graph = this.graphs.findById(id);
        if (!graph) continue;
        graphs.push(graph);
        info.set(graph.graph_id, {
          entrySymptom: graph.entry_symptom,
          entrySymptomTh: graph.entry_symptom_th,
          deviceCategory: graph.device_category,
          manualId: graph.manual_id,
        });
      }

      // ข้อความเดิมที่ embed ไว้แล้วใช้เวกเตอร์ซ้ำได้ (ข้อความเดียวกัน = เวกเตอร์เดียวกัน)
      const known = new Map<string, ArrayLike<number>>();
      for (const item of this.index) known.set(item.text, item.vector);

      const added: IndexedSymptom[] = [];
      for (const item of buildSymptomTexts(graphs)) {
        let vector = known.get(item.text);
        if (vector === undefined) {
          vector = await this.embedding.embed(item.text);
          known.set(item.text, vector);
        }
        added.push({ ...item, vector });
      }

      this.index = [...this.index.filter((item) => !wanted.has(item.graphId)), ...added];
      this.graphInfo = info;
      this.logger.log(`เพิ่มผังเข้าดัชนีค้นหา ${graphs.length} ผัง (${added.length} ข้อความ)`);
      return { indexed: true, addedTexts: added.length };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(`เพิ่มผังเข้าดัชนีค้นหาไม่สำเร็จ: ${reason}`);
      return { indexed: false, addedTexts: 0, reason };
    }
  }

  /**
   * ค้นหาผังขั้นตอนที่ตรงกับคำค้น
   * รับข้อความที่ผ่าน parseSearchBody แล้ว (ตัดช่องว่าง ตรวจความยาวแล้ว)
   * manualId (ไม่บังคับ): ค้นเฉพาะผังของคู่มือ/รุ่นนั้น โดยกรองดัชนีก่อนจัดอันดับ
   * (กรองหลังเลือก top-3 อาจเหลือ 0 ผัง) ไม่ส่ง = ค้นทุกรุ่นเหมือนเดิม · ไม่พบรุ่นนั้น = ไม่มีผลลัพธ์
   */
  async search(query: string, manualId?: string): Promise<SymptomSearchResponseDto> {
    if (this.state === 'loading') throw new SearchNotReadyError();
    if (this.state !== 'ready') throw new SearchUnavailableError();

    const queryVector = await this.embedding.embed(query);
    const candidates =
      manualId === undefined
        ? this.index
        : this.index.filter((item) => this.graphInfo.get(item.graphId)?.manualId === manualId);
    const ranked = rankGraphs(queryVector, candidates);

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