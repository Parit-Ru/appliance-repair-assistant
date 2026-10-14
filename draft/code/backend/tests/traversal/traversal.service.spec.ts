// backend/src/traversal/traversal.service.spec.ts

/**
 * เทสตรรกะของ TraversalService โดยใช้ repository/store ปลอมที่เก็บในหน่วยความจำ
 * เท่านั้น — รันได้โดยไม่ต้องต่อ MySQL เลย
 *
 * ตัวปลอมสร้างจากไฟล์ข้อมูลจริงชุดเดียวกับที่ mockServer.ts ใช้
 * (data/manuals/samsung_ac_ar70h.json, data/equipment/equipment.json)
 * แล้วลอกทั้ง 10 กรณีจาก frontend/src/mocks/mockServer.test.ts มาตรงๆ
 *
 * เหตุผลที่ต้องลอกให้ตรง: mock กับ service ตัวจริงต้อง "พฤติกรรมเดียวกันทุกกรณี"
 * เพราะ mock คือสิ่งที่หน้าจอใช้พัฒนามาตลอด ถ้าสองฝั่งเพี้ยนกัน หน้าจอจะโกหกผู้ใช้
 * เรื่องด่านความปลอดภัยระหว่างพัฒนา โดยไม่มีใครรู้จนกว่าจะต่อเซิร์ฟเวอร์จริง
 *
 * หมายเหตุ: เทสชุดนี้พิสูจน์แค่ตรรกะของ TraversalService เท่านั้น
 * ไม่ได้พิสูจน์ transaction ของ SessionStore กับ MySQL จริง (พิสูจน์แล้วแยกต่างหาก
 * ด้วยตารางตรวจ A.10 กับสคริปต์ A.12)
 *
 * ตรวจผ่านเมื่อ: npm test "ล้ม" ในตอนนี้ เพราะยังไม่มีไฟล์ traversal.service.ts
 * (เป็นขั้นตอนที่ตั้งใจ — เขียนเทสก่อนเขียนโค้ดจริงตามที่ตกลงกันไว้)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import type { GraphRepository, GraphSummary } from './graph.repository';
import type { EquipmentRepository } from './equipment.repository';
import type { SessionStore } from './session.store';
import type { SymptomSearchService } from '../symptom-search/symptom-search.service';
import type { EquipmentItemDto } from './traversal.dto';
import {
  GraphNotFoundError,
  OutcomeAlreadySubmittedError,
  SessionNotCompletedError,
  SessionNotFoundError,
  TraversalService,
} from './traversal.service';
import {
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
} from '../traversal-engine/types';
import type {
  ManualFile,
  SessionState,
  TraversalAction,
  TroubleshootingGraph,
} from '../traversal-engine/types';

// ============================================================
// ข้อมูลจริง — ไฟล์เดียวกับที่ backend จริงและ mockServer.ts ใช้
//
// อ่านด้วย fs.readFileSync + JSON.parse (ไม่ใช่ import แบบ TS)
// เพราะ backend/tsconfig.json ไม่ได้เปิด resolveJsonModule และ rootDir
// ผูกไว้กับ backend/src เท่านั้น จึง import ข้ามไปที่ data/ (นอก backend/)
// ด้วยไวยากรณ์ import ตรงๆ แบบที่ mockServer.ts ทำไม่ได้
// (สคริปต์ seed-graphs.js / seed-equipment.js ของโปรเจกต์นี้ก็ใช้วิธีเดียวกันนี้)
// ============================================================

const manualPath = path.resolve(__dirname, '../../../data/manuals/samsung_ac_ar70h.json');
const equipmentPath = path.resolve(__dirname, '../../../data/equipment/equipment.json');

const manual = JSON.parse(fs.readFileSync(manualPath, 'utf-8')) as ManualFile;

/** รูปร่างของ data/equipment/equipment.json เฉพาะ field ที่ใช้ (ลอกจาก mockServer.ts) */
interface EquipmentFile {
  equipment: { equipment_id: string; name_th: string }[];
  usage: {
    device_category: string;
    items: {
      equipment_id: string;
      purpose_th: string;
      source_page?: number;
      author_note?: string;
    }[];
  }[];
}

const equipmentFile = JSON.parse(fs.readFileSync(equipmentPath, 'utf-8')) as EquipmentFile;

// ============================================================
// ตัวปลอมของชั้นข้อมูล
//
// ไม่ extends GraphRepository/EquipmentRepository/SessionStore ของจริง เพราะทุกตัว
// มี field ส่วนตัว (private pool) ที่ต้องมี mysql2 Pool จริงตอนสร้าง — เทสนี้ไม่ต้อง
// แตะฐานข้อมูลเลย จึงสร้าง "หน้าตาเดียวกัน" ขึ้นมาใหม่ทั้งคลาส แล้ว cast ผ่าน unknown
// ตอนส่งให้ TraversalService (เทคนิคมาตรฐานสำหรับใส่ของปลอมแทนของจริงตอนเทส)
//
// TraversalService เองไม่รู้และไม่สนใจว่าได้รับของจริงหรือของปลอม — เห็นแค่ว่า
// มีเมธอด findById/listAll/findByCategory/create/find/update/delete ให้เรียก
// ============================================================

class FakeGraphRepository {
  private readonly graphs = new Map<string, TroubleshootingGraph>(
    manual.graphs.map((graph) => [graph.graph_id, graph]),
  );

  findById(graphId: string): TroubleshootingGraph | undefined {
    return this.graphs.get(graphId);
  }

  /** ลอกตรงจากเมธอด listAll() ของ graph.repository.ts จริง */
  listAll(): GraphSummary[] {
    return [...this.graphs.values()].map((g) => ({
      graphId: g.graph_id,
      entrySymptom: g.entry_symptom,
      entrySymptomTh: g.entry_symptom_th,
      deviceCategory: g.device_category,
      brand: g.brand,
      modelPattern: g.model_pattern,
      severity: g.severity,
      difficulty: g.difficulty,
    }));
  }
}

class FakeEquipmentRepository {
  private readonly names = new Map(
    equipmentFile.equipment.map((item) => [item.equipment_id, item.name_th]),
  );

  /** ลอกตรงจากฟังก์ชัน equipmentFor() ของ mockServer.ts */
  findByCategory(category: string): EquipmentItemDto[] {
    const usage = equipmentFile.usage.find((entry) => entry.device_category === category);
    if (!usage) return [];

    return usage.items.map((item) => ({
      equipmentId: item.equipment_id,
      nameTh: this.names.get(item.equipment_id) ?? item.equipment_id,
      purposeTh: item.purpose_th,
      sourcePage: item.source_page,
      authorNote: item.author_note,
    }));
  }
}

/** เก็บ session ไว้ใน Map ธรรมดา ไม่มีเรื่องหมดอายุหรือ transaction เพราะไม่ใช่สิ่งที่เทสชุดนี้ตรวจ */
class FakeSessionStore {
  private readonly sessions = new Map<string, SessionState>();

  /**
   * ผลลัพธ์ที่ผู้ใช้กรอก เก็บแยกจาก session โดยตั้งใจ เหมือนของจริง
   * (SessionStore จริงไม่ใส่ค่านี้ใน SessionState ที่ส่งเข้า engine)
   */
  private readonly outcomes = new Map<string, string>();

  /** นับว่า findOutcome ถูกเรียกกี่ครั้ง ไว้ตรวจว่าการเดินขั้นตอนปกติไม่เสียคำสั่งเพิ่ม */
  findOutcomeCalls = 0;

  async create(session: SessionState): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async find(sessionId: string): Promise<SessionState | undefined> {
    return this.sessions.get(sessionId);
  }

  async update(session: SessionState): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.outcomes.delete(sessionId);
  }

  /**
   * ลอกเงื่อนไขของ UPDATE จริง (session.store.ts): บันทึกได้เฉพาะ session ที่จบแล้วและยังไม่มีผลลัพธ์
   * คืน true เมื่อบันทึก false เมื่อไม่ตรงเงื่อนไข เนื้อเมธอดไม่มี await ระหว่างเช็คกับเขียน
   * ความ atomic ของจริงอยู่ที่ฐานข้อมูล (ดูเอกสาร 13) เทสนี้พิสูจน์แค่ตรรกะของ service
   */
  async saveOutcome(sessionId: string, text: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'completed' || this.outcomes.has(sessionId)) return false;
    this.outcomes.set(sessionId, text);
    return true;
  }

  async findOutcome(sessionId: string): Promise<string | null> {
    this.findOutcomeCalls++;
    return this.outcomes.get(sessionId) ?? null;
  }

  /** ให้เทสดูตรงๆ ว่าเก็บอะไรไว้ (ไม่นับเป็นการเรียก findOutcome) */
  storedOutcome(sessionId: string): string | undefined {
    return this.outcomes.get(sessionId);
  }
}

/**
 * ระบบค้นหาอาการปลอม: มีเมธอดเดียวที่ TraversalService ใช้ (scoreGraph)
 * เก็บประวัติการเรียกไว้ให้เทสตรวจว่าถูกเรียกหรือไม่ และเรียกด้วยอะไร
 */
class FakeSymptomSearch {
  calls: Array<{ query: string; graphId: string }> = [];

  constructor(private readonly behavior: (query: string, graphId: string) => Promise<number | null>) {}

  async scoreGraph(query: string, graphId: string): Promise<number | null> {
    this.calls.push({ query, graphId });
    return this.behavior(query, graphId);
  }
}

function makeService(
  search: FakeSymptomSearch = new FakeSymptomSearch(async () => null),
  store: FakeSessionStore = new FakeSessionStore(),
): TraversalService {
  return new TraversalService(
    new FakeGraphRepository() as unknown as GraphRepository,
    new FakeEquipmentRepository() as unknown as EquipmentRepository,
    store as unknown as SessionStore,
    search as unknown as SymptomSearchService,
  );
}

// ============================================================
// ค่าคงที่ใช้ร่วมกันในเทส (ตรงกับ mockServer.test.ts)
// ============================================================

const STOPS_WORKING = 'samsung_ac_ar70h_stops_working';
const ERROR_MESSAGE = 'samsung_ac_ar70h_error_message';
const WATER_DRIPS = 'samsung_ac_ar70h_water_drips_outdoor';

const YES: TraversalAction = { type: 'answer', value: 'yes' };

/** เดินตาม action ที่ให้มาทีละขั้น แล้วคืน session ที่หยุดอยู่ (ลอกจาก mockServer.test.ts) */
async function walk(service: TraversalService, graphId: string, actions: TraversalAction[]) {
  let session = await service.startSession(graphId);
  for (const action of actions) {
    session = await service.submitAction(session.sessionId, action);
  }
  return session;
}

// ============================================================
// เทส — ลอกทั้ง 10 ข้อจาก mockServer.test.ts
// ============================================================

describe('TraversalService', () => {
  it('listGraphs คืน 13 อาการ และทุกอาการมีชื่อไทย', () => {
    const service = makeService();
    const graphs = service.listGraphs();

    expect(graphs).toHaveLength(13);
    expect(graphs.every((g) => g.entrySymptomTh)).toBe(true);
  });

  it('เริ่ม session แล้วได้โหนดแรกของกราฟ พร้อมรายการอุปกรณ์', async () => {
    const service = makeService();
    const session = await service.startSession(STOPS_WORKING);

    expect(session.node.nodeId).toBe('n1');
    expect(session.status).toBe('in_progress');
    expect(session.graphId).toBe(STOPS_WORKING);
    expect(session.equipment).toHaveLength(7);
  });

  it('ส่ง continue ที่ด่านความปลอดภัยถูกปฏิเสธ และสถานะไม่ขยับ', async () => {
    // เทสที่สำคัญที่สุดของไฟล์นี้ — เป็นข้อสอบหลักของโครงงาน
    const service = makeService();
    const session = await walk(service, STOPS_WORKING, [YES, YES]);
    expect(session.node.nodeId).toBe('n_fix_breaker');
    expect(session.node.requiresSafetyConfirmation).toBe(true);

    // ต้องโยน error ชนิดเดิมของ engine ตรงๆ ไม่ใช่ error ที่ service ห่อเอง
    // เพราะ filter ใน A.6 จะจับด้วย instanceof ตัวนี้แล้วแปลงเป็น 400 SAFETY_CONFIRMATION_REQUIRED
    await expect(
      service.submitAction(session.sessionId, { type: 'continue' }),
    ).rejects.toBeInstanceOf(SafetyConfirmationRequiredError);

    // อ่านสถานะซ้ำ ต้องยังอยู่โหนดเดิม
    // ระบบที่ตอบ error แล้วแอบเดินต่อ จะแย่กว่าระบบที่ไม่มีด่านเลย
    const after = await service.getSession(session.sessionId);
    expect(after.node.nodeId).toBe('n_fix_breaker');
  });

  it('ยืนยันคำเตือนแล้วเดินต่อได้', async () => {
    // ด่านที่บล็อกทุกอย่างก็ผิดเหมือนกัน ต้องผ่านได้เมื่อยืนยันถูกวิธี
    const service = makeService();
    const session = await walk(service, STOPS_WORKING, [YES, YES, { type: 'confirm_safety' }]);

    expect(session.node.nodeId).toBe('n_recheck_breaker');
  });

  it('กรอกรหัสผิดรูปแบบ พาไปโหนดอธิบายรูปแบบ ไม่ใช่ error', async () => {
    // สำคัญ: การกรอกผิดไม่ใช่ข้อผิดพลาดของระบบ แต่เป็นเส้นทางหนึ่งในกราฟ
    // service จึงห้ามตรวจรูปแบบเอง ต้องปล่อยให้ engine ตัดสินเหมือนที่ mock ทำ
    const service = makeService();
    const session = await walk(service, ERROR_MESSAGE, [YES, { type: 'input', value: '12' }]);

    expect(session.node.nodeId).toBe('n_invalid_code');
    expect(session.status).toBe('in_progress');
  });

  it('กรอกรหัสถูกรูปแบบ พาไปหน้าจบที่แทนค่ารหัสในข้อความแล้ว', async () => {
    const service = makeService();
    const session = await walk(service, ERROR_MESSAGE, [YES, { type: 'input', value: 'E1' }]);

    expect(session.node.isTerminal).toBe(true);
    expect(session.node.outcomeKind).toBe('handoff_informed');
    expect(session.node.text).toContain('E1');
    // ถ้ายังมี {{ ค้างอยู่ แปลว่าการแทนค่าพัง และผู้ใช้จะเห็น {{error_code}} บนหน้าจอ
    expect(session.node.text).not.toContain('{{');
  });

  it('ส่ง action ต่อหลังจบแล้ว ถูกปฏิเสธ', async () => {
    const service = makeService();
    const session = await walk(service, WATER_DRIPS, [YES]);
    expect(session.status).toBe('completed');

    await expect(service.submitAction(session.sessionId, YES)).rejects.toBeInstanceOf(
      SessionAlreadyCompletedError,
    );
  });

  it('ใช้ sessionId ที่ไม่มีอยู่ ได้ SessionNotFoundError', async () => {
    const service = makeService();

    await expect(service.getSession('ไม่มี-session-นี้')).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('ยกเลิกการตรวจแล้ว session หายไปจริง', async () => {
    const service = makeService();
    const session = await service.startSession(STOPS_WORKING);

    await service.abandonSession(session.sessionId);

    await expect(service.getSession(session.sessionId)).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('ใช้ graphId ที่ไม่มีอยู่ ได้ GraphNotFoundError', async () => {
    const service = makeService();

    await expect(service.startSession('ไม่มีกราฟนี้')).rejects.toBeInstanceOf(GraphNotFoundError);
  });
});

// ============================================================
// คะแนนความมั่นใจของ session (ขั้น 1.8)
//
// เซิร์ฟเวอร์คำนวณเอง · null = ไม่มีการจับคู่ให้วัด · แสดงผลอย่างเดียว
// ใช้ระบบค้นหาปลอม จึงไม่ได้พิสูจน์คุณภาพของคะแนนจากโมเดลจริง
// ============================================================

describe('TraversalService — คะแนนความมั่นใจของ session', () => {
  it('ไม่ส่ง query (เลือกจากรายการเอง) → confidence เป็น null และไม่เรียกระบบค้นหา', async () => {
    const search = new FakeSymptomSearch(async () => 0.9);
    const service = makeService(search);

    const session = await service.startSession(STOPS_WORKING);

    expect(session.confidence).toBeNull();
    expect(search.calls).toHaveLength(0);
  });

  it('ส่ง query → confidence คือคะแนนที่ระบบค้นหาคิดให้ผังที่เลือก', async () => {
    const search = new FakeSymptomSearch(async () => 0.812);
    const service = makeService(search);

    const session = await service.startSession(STOPS_WORKING, 'แอร์ดับ');

    expect(session.confidence).toBe(0.812);
    expect(search.calls).toEqual([{ query: 'แอร์ดับ', graphId: STOPS_WORKING }]);
  });

  it('getSession ภายหลังได้ confidence เดิมที่บันทึกไว้', async () => {
    const service = makeService(new FakeSymptomSearch(async () => 0.812));
    const started = await service.startSession(STOPS_WORKING, 'แอร์ดับ');

    const again = await service.getSession(started.sessionId);

    expect(again.confidence).toBe(0.812);
  });

  it('ระบบค้นหาไม่พร้อม (คืน null) → confidence เป็น null ไม่แต่งตัวเลข', async () => {
    const service = makeService(new FakeSymptomSearch(async () => null));

    const session = await service.startSession(STOPS_WORKING, 'แอร์ดับ');

    expect(session.confidence).toBeNull();
  });

  it('คำนวณคะแนนล้มเหลว → ยังเริ่ม session ได้ และ confidence เป็น null', async () => {
    const service = makeService(
      new FakeSymptomSearch(async () => {
        throw new Error('embed ล้มเหลว');
      }),
    );

    const session = await service.startSession(STOPS_WORKING, 'แอร์ดับ');

    expect(session.confidence).toBeNull();
    expect(session.node).toBeDefined();
  });

  it('graphId ไม่มีอยู่ → GraphNotFoundError และไม่เสียเวลาคำนวณคะแนน', async () => {
    const search = new FakeSymptomSearch(async () => 0.9);
    const service = makeService(search);

    await expect(service.startSession('ไม่มีกราฟนี้', 'แอร์ดับ')).rejects.toBeInstanceOf(
      GraphNotFoundError,
    );
    expect(search.calls).toHaveLength(0);
  });

  it('คะแนนสูงสุด (1) ก็ไม่ช่วยข้ามด่านความปลอดภัย: confidence ไม่มีผลต่อการเปลี่ยนสถานะ', async () => {
    const service = makeService(new FakeSymptomSearch(async () => 1));

    // เดินเส้นทางเดียวกับเทสด่านความปลอดภัยด้านบน แต่เริ่มด้วย query จึงได้ confidence = 1
    let session = await service.startSession(STOPS_WORKING, 'แอร์ดับ');
    expect(session.confidence).toBe(1);
    for (const action of [YES, YES]) {
      session = await service.submitAction(session.sessionId, action);
    }
    expect(session.node.nodeId).toBe('n_fix_breaker');
    expect(session.node.requiresSafetyConfirmation).toBe(true);

    await expect(
      service.submitAction(session.sessionId, { type: 'continue' }),
    ).rejects.toBeInstanceOf(SafetyConfirmationRequiredError);
  });
});

// ============================================================
// ผลลัพธ์ที่ผู้ใช้กรอกตอนการตรวจจบ
//
// ข้อมูลบันทึกอย่างเดียว: ไม่ผ่าน engine ไม่เปลี่ยนสถานะ ไม่บังคับ ส่งได้ครั้งเดียว
// ใช้ store ปลอมที่ลอกเงื่อนไขของ SQL จริง จึงพิสูจน์ตรรกะของ service เท่านั้น
// ไม่พิสูจน์ความ atomic ของ UPDATE กับ MySQL จริง (ตรวจแยก ดูเอกสาร 13)
// ============================================================

/** ถึงสถานะสิ้นสุดแบบ resolution: ตอบ "ใช่" ที่คำถามแรกของผังน้ำหยดเครื่องนอก → n_normal */
const REACH_RESOLUTION = (service: TraversalService) => walk(service, WATER_DRIPS, [YES]);

/** ถึงสถานะสิ้นสุดแบบ escalation: ผังรหัสข้อผิดพลาด ตอบใช่ แล้วกรอก E1 → n_escalate_with_code */
const REACH_ESCALATION = (service: TraversalService) =>
  walk(service, ERROR_MESSAGE, [YES, { type: 'input', value: 'E1' }]);

describe('TraversalService — ผลลัพธ์ที่ผู้ใช้กรอก', () => {
  it('ข้อมูลที่เทสใช้: สองเส้นทางจบที่สถานะคนละชนิดจริง (resolution กับ escalation)', async () => {
    // กันเทสข้างล่างอ้างว่าครอบคลุมทั้งสองแบบทั้งที่ข้อมูลผังเปลี่ยนไปจนเป็นชนิดเดียวกัน
    const service = makeService();
    const typeOf = (graphId: string, nodeId: string) =>
      manual.graphs.find((g) => g.graph_id === graphId)?.nodes.find((n) => n.node_id === nodeId)?.type;

    const resolution = await REACH_RESOLUTION(service);
    const escalation = await REACH_ESCALATION(service);

    expect(typeOf(WATER_DRIPS, resolution.node.nodeId)).toBe('resolution');
    expect(typeOf(ERROR_MESSAGE, escalation.node.nodeId)).toBe('escalation');
  });

  it.each([
    ['resolution', REACH_RESOLUTION],
    ['escalation', REACH_ESCALATION],
  ])('บันทึกที่สถานะสิ้นสุดแบบ %s ได้ และ response มี outcome เป็นข้อความที่บันทึก', async (_kind, reach) => {
    const store = new FakeSessionStore();
    const service = makeService(undefined, store);
    const done = await reach(service);
    expect(done.outcome).toBeNull(); // ถึงสถานะสิ้นสุดแล้วแต่ยังไม่ได้กรอก

    const res = await service.submitOutcome(done.sessionId, 'ทำตามแล้วหายแล้ว');

    expect(res.outcome).toBe('ทำตามแล้วหายแล้ว');
    expect(res.status).toBe('completed');
    expect(res.node.isTerminal).toBe(true);
    expect(store.storedOutcome(done.sessionId)).toBe('ทำตามแล้วหายแล้ว');
  });

  it('รีโหลด (getSession) หลังบันทึก ได้ข้อความเดิม และสถานะ/โหนดไม่เปลี่ยน', async () => {
    const service = makeService();
    const done = await REACH_RESOLUTION(service);
    await service.submitOutcome(done.sessionId, 'ยังไม่หาย แต่เบาลง');

    const again = await service.getSession(done.sessionId);

    expect(again.outcome).toBe('ยังไม่หาย แต่เบาลง');
    expect(again.node.nodeId).toBe(done.node.nodeId);
    expect(again.status).toBe('completed');
  });

  it('ไม่บังคับ: session ที่จบแล้วแต่ไม่กรอก getSession ได้ outcome เป็น null', async () => {
    const service = makeService();
    const done = await REACH_ESCALATION(service);

    expect((await service.getSession(done.sessionId)).outcome).toBeNull();
  });

  it('ไม่มี session → SessionNotFoundError', async () => {
    const service = makeService();

    await expect(service.submitOutcome('ไม่มี-session-นี้', 'x')).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('session ยังเดินอยู่ → SessionNotCompletedError และไม่มีอะไรถูกบันทึก', async () => {
    const store = new FakeSessionStore();
    const service = makeService(undefined, store);
    const midway = await service.startSession(STOPS_WORKING);
    expect(midway.status).toBe('in_progress');

    await expect(service.submitOutcome(midway.sessionId, 'ยังไม่จบ')).rejects.toBeInstanceOf(
      SessionNotCompletedError,
    );
    expect(store.storedOutcome(midway.sessionId)).toBeUndefined();
  });

  it('ส่งซ้ำ → OutcomeAlreadySubmittedError และข้อความแรกไม่ถูกเขียนทับ', async () => {
    const store = new FakeSessionStore();
    const service = makeService(undefined, store);
    const done = await REACH_RESOLUTION(service);
    await service.submitOutcome(done.sessionId, 'ข้อความแรก');

    await expect(service.submitOutcome(done.sessionId, 'ข้อความที่สอง')).rejects.toBeInstanceOf(
      OutcomeAlreadySubmittedError,
    );

    expect(store.storedOutcome(done.sessionId)).toBe('ข้อความแรก');
    expect((await service.getSession(done.sessionId)).outcome).toBe('ข้อความแรก');
  });

  it('สองคำขอพร้อมกัน → สำเร็จหนึ่ง ถูกปฏิเสธหนึ่ง (ตรรกะของ service ความ atomic ของจริงอยู่ที่ UPDATE)', async () => {
    const service = makeService();
    const done = await REACH_RESOLUTION(service);

    const results = await Promise.allSettled([
      service.submitOutcome(done.sessionId, 'คำขอ A'),
      service.submitOutcome(done.sessionId, 'คำขอ B'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(OutcomeAlreadySubmittedError);
  });

  it('ไม่ผ่าน engine: หลังบันทึก action ใหม่ยังถูกปฏิเสธด้วย SessionAlreadyCompletedError ตามเดิม', async () => {
    const service = makeService();
    const done = await REACH_RESOLUTION(service);
    await service.submitOutcome(done.sessionId, 'บันทึกแล้ว');

    await expect(service.submitAction(done.sessionId, YES)).rejects.toBeInstanceOf(
      SessionAlreadyCompletedError,
    );
    expect((await service.getSession(done.sessionId)).outcome).toBe('บันทึกแล้ว');
  });

  it('ผลลัพธ์ไม่มีผลต่อเส้นทาง: เดินเส้นเดียวกัน มี/ไม่มี outcome จบที่สถานะเดียวกัน', async () => {
    const serviceA = makeService();
    const serviceB = makeService();
    const a = await REACH_RESOLUTION(serviceA);
    const b = await REACH_RESOLUTION(serviceB);

    await serviceA.submitOutcome(a.sessionId, 'มีผลลัพธ์');

    const aAfter = await serviceA.getSession(a.sessionId);
    const bAfter = await serviceB.getSession(b.sessionId);
    expect(aAfter.node.nodeId).toBe(bAfter.node.nodeId);
    expect(aAfter.status).toBe(bAfter.status);
  });

  it('response ทุกชนิดมี outcome: start/action เป็น null · การเดินขั้นตอนปกติไม่เรียก findOutcome เลย', async () => {
    const store = new FakeSessionStore();
    const service = makeService(undefined, store);

    const started = await service.startSession(STOPS_WORKING);
    const stepped = await service.submitAction(started.sessionId, YES);
    const reloaded = await service.getSession(started.sessionId);

    for (const r of [started, stepped, reloaded]) {
      expect('outcome' in r).toBe(true);
      expect(r.outcome).toBeNull();
    }
    // session ยังเดินอยู่ไม่มีทางมีผลลัพธ์ จึงไม่เสียคำสั่ง SQL เพิ่ม
    expect(store.findOutcomeCalls).toBe(0);
  });

  it('getSession ที่จบแล้วอ่านผลลัพธ์ 1 ครั้ง', async () => {
    const store = new FakeSessionStore();
    const service = makeService(undefined, store);
    const done = await REACH_RESOLUTION(service);

    await service.getSession(done.sessionId);

    expect(store.findOutcomeCalls).toBe(1);
  });

  it('confidence กับผลลัพธ์เป็นข้อมูลคนละอย่าง: บันทึกผลลัพธ์แล้ว confidence เดิมไม่เปลี่ยน', async () => {
    const service = makeService(new FakeSymptomSearch(async () => 0.812));
    let s = await service.startSession(WATER_DRIPS, 'น้ำหยด');
    s = await service.submitAction(s.sessionId, YES);
    expect(s.status).toBe('completed');

    const res = await service.submitOutcome(s.sessionId, 'ผลลัพธ์');

    expect(res.confidence).toBe(0.812);
    expect(res.outcome).toBe('ผลลัพธ์');
  });
});