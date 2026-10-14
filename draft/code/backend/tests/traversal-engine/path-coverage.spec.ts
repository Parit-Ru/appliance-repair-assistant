// backend/src/traversal-engine/path-coverage.spec.ts

/**
 * เดินทุกเส้นทางของกราฟอ้างอิงจริงทั้ง 13 กราฟ (data/manuals/samsung_ac_ar70h.json)
 *
 * ต่างจาก traversal-engine.spec.ts ตรงที่ไฟล์นั้นเทส "กฎของ engine" ด้วยกราฟจำลอง
 * ส่วนไฟล์นี้เทส "ข้อมูลจริงเดินได้จริง" — ไม่มีทางตัน ไม่มีลูปไม่จบ
 * ไม่มีโหนดกำพร้า และด่านความปลอดภัยทุกจุดทำงาน
 *
 * ─────────────────────────────────────────────────────────────
 * 🔴 นิยามของคำว่า "1 เส้นทาง" (สำคัญ ต้องอธิบายได้ตอนสอบ)
 * ─────────────────────────────────────────────────────────────
 * เส้นทาง = ลำดับ action จาก entry_node จนถึงโหนดจบ (resolution/escalation)
 * โดยห้ามใช้คู่ (node_id, action) เดิมซ้ำภายในเส้นทางเดียวกัน
 *
 * ทำไมต้องมีข้อห้ามนี้: กราฟมีลูปโดยตั้งใจ เช่น
 *     n_fix_power (บอกให้เสียบปลั๊ก) → n_recheck_power → ถ้ายังไม่ได้ กลับไป n1
 * ถ้าไม่ห้ามอะไรเลย จำนวนเส้นทางจะเป็นอนันต์
 *
 * กิ่งที่ถูกตัดเพราะวนซ้ำ "ไม่ถูกนับเป็นเส้นทาง" เพราะยังไปไม่ถึงโหนดจบ
 *
 * ผลลัพธ์ตามนิยามนี้ = 106 เส้นทาง
 * (ตัวจำลองฝั่ง Python simulate_paths.py รายงาน 104 เพราะไม่ได้เดินกิ่งกรอกค่าผิด
 *  ตัวเลขที่ใช้อ้างอิงคือ 106 เพราะมาจาก engine ตัวที่ผู้ใช้ใช้งานจริง)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { startSession, submitAction } from './traversal-engine';
import {
  ManualFile,
  TroubleshootingGraph,
  TroubleshootingNode,
  TraversalAction,
  SessionState,
  RenderedNode,
  SafetyConfirmationRequiredError,
} from './types';

// ============================================================
// โหลดกราฟอ้างอิง
// ============================================================

const MANUAL_PATH = path.resolve(
  __dirname,
  '../../../data/manuals/samsung_ac_ar70h.json',
);

const manual: ManualFile = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf-8'));
const graphs: TroubleshootingGraph[] = manual.graphs;

/** ตัวเลขที่คาดไว้ ถ้าแก้กราฟแล้วเลขเปลี่ยน เทสจะแดงเพื่อเตือนให้แก้เอกสารตาม */
const EXPECTED_GRAPH_COUNT = 13;
const EXPECTED_NODE_COUNT = 95;
const EXPECTED_PATH_COUNT = 106;

/** ค่าที่ใช้ทดสอบโหนด input: ตัวแรกตั้งใจให้ผ่าน ตัวที่สองตั้งใจให้ไม่ผ่าน */
const VALID_INPUT = 'E1';
const INVALID_INPUT = '###';

// ============================================================
// ตัวเดินกราฟ
// ============================================================

/** action ทั้งหมดที่ "ถูกต้อง" สำหรับโหนดหนึ่ง ตามชนิดของมัน */
function validActionsFor(node: TroubleshootingNode): TraversalAction[] {
  switch (node.type) {
    case 'checkpoint':
      return [
        { type: 'answer', value: 'yes' },
        { type: 'answer', value: 'no' },
      ];

    case 'instruction':
      // safety_critical รับได้เฉพาะ confirm_safety เท่านั้น
      return node.safety_critical ? [{ type: 'confirm_safety' }] : [{ type: 'continue' }];

    case 'input': {
      const actions: TraversalAction[] = [{ type: 'input', value: VALID_INPUT }];
      // เดินกิ่งกรอกผิดด้วย เฉพาะเมื่อโหนดมี pattern ให้ผิดได้
      if (node.pattern) {
        actions.push({ type: 'input', value: INVALID_INPUT });
      }
      return actions;
    }

    case 'resolution':
    case 'escalation':
      return [];
  }
}

interface WalkResult {
  /** จำนวนเส้นทางที่เดินถึงโหนดจบได้จริง */
  paths: number;
  /** node_id ทั้งหมดที่เดินไปถึงได้ */
  visited: Set<string>;
  /** จำนวนกิ่งที่ถูกตัดเพราะวนกลับที่เดิม */
  loopsPruned: number;
}

function walkAllPaths(graph: TroubleshootingGraph): WalkResult {
  const nodeById = new Map(graph.nodes.map((n) => [n.node_id, n]));
  const result: WalkResult = { paths: 0, visited: new Set(), loopsPruned: 0 };

  function step(session: SessionState, rendered: RenderedNode, usedEdges: Set<string>): void {
    result.visited.add(rendered.nodeId);

    if (rendered.isTerminal) {
      result.paths += 1;
      return;
    }

    const raw = nodeById.get(rendered.nodeId);
    if (!raw) {
      throw new Error(`กราฟ ${graph.graph_id} อ้างถึงโหนด ${rendered.nodeId} ที่ไม่มีอยู่`);
    }

    for (const action of validActionsFor(raw)) {
      const edgeKey = `${rendered.nodeId}|${JSON.stringify(action)}`;

      if (usedEdges.has(edgeKey)) {
        result.loopsPruned += 1;
        continue;
      }

      const next = submitAction(session, graph, action);
      step(next.session, next.node, new Set([...usedEdges, edgeKey]));
    }
  }

  const start = startSession(graph);
  step(start.session, start.node, new Set());

  return result;
}

// ============================================================
// 1. ความสมบูรณ์ของไฟล์กราฟ
// ============================================================

describe('ไฟล์กราฟอ้างอิง samsung_ac_ar70h.json', () => {
  it(`มี ${EXPECTED_GRAPH_COUNT} กราฟ ตรงกับ field count ในไฟล์`, () => {
    expect(graphs).toHaveLength(EXPECTED_GRAPH_COUNT);
    expect(manual.count).toBe(EXPECTED_GRAPH_COUNT);
  });

  it(`มี ${EXPECTED_NODE_COUNT} โหนดรวมทุกกราฟ`, () => {
    const total = graphs.reduce((sum, g) => sum + g.nodes.length, 0);

    expect(total).toBe(EXPECTED_NODE_COUNT);
  });

  it('ทุกกราฟเป็น schema v2', () => {
    for (const graph of graphs) {
      expect(graph.schema_version).toBe(2);
    }
  });

  it('ทุกกราฟมี source และ page_range สำหรับสร้างการอ้างอิง', () => {
    for (const graph of graphs) {
      expect(graph.source).toBeTruthy();
      expect(graph.page_range).toHaveLength(2);
    }
  });

  it('graph_id ไม่ซ้ำกัน', () => {
    const ids = graphs.map((g) => g.graph_id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('node_id ไม่ซ้ำกันภายในกราฟเดียวกัน', () => {
    for (const graph of graphs) {
      const ids = graph.nodes.map((n) => n.node_id);

      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

// ============================================================
// 2. เดินได้ทุกกราฟ
// ============================================================

describe('เดินกราฟจริงทีละกราฟ', () => {
  it.each(graphs.map((g) => [g.graph_id, g] as const))(
    '%s เดินจบทุกเส้นทางโดยไม่มี error',
    (_id, graph) => {
      const result = walkAllPaths(graph);

      expect(result.paths).toBeGreaterThan(0);
    },
  );

  it.each(graphs.map((g) => [g.graph_id, g] as const))(
    '%s ไม่มีโหนดกำพร้า (ทุกโหนดเดินไปถึงได้)',
    (_id, graph) => {
      const { visited } = walkAllPaths(graph);
      const unreachable = graph.nodes
        .map((n) => n.node_id)
        .filter((id) => !visited.has(id));

      expect(unreachable).toEqual([]);
    },
  );
});

// ============================================================
// 3. จำนวนเส้นทางรวม — ตัวเลขที่ใช้อ้างอิงในเล่ม
// ============================================================

describe('จำนวนเส้นทางรวมทุกกราฟ', () => {
  it(`เดินได้ ${EXPECTED_PATH_COUNT} เส้นทาง และทุกเส้นจบที่โหนดจบ`, () => {
    const total = graphs.reduce((sum, g) => sum + walkAllPaths(g).paths, 0);

    expect(total).toBe(EXPECTED_PATH_COUNT);
  });

  it('ไม่มีกราฟไหนที่เดินแล้วไปไม่ถึงโหนดจบเลย', () => {
    for (const graph of graphs) {
      expect(walkAllPaths(graph).paths).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 4. 🔴 ด่านความปลอดภัยบนข้อมูลจริง
// ============================================================

describe('ด่านความปลอดภัยบนโหนดจริงทุกตัว', () => {
  /** รวมโหนด safety_critical ทั้งหมดจากทุกกราฟ */
  const safetyNodes = graphs.flatMap((graph) =>
    graph.nodes
      .filter((n) => n.safety_critical === true)
      .map((node) => ({ graph, node })),
  );

  it('มีโหนด safety_critical อยู่จริงในข้อมูล', () => {
    expect(safetyNodes.length).toBeGreaterThan(0);
  });

  it('safety_critical อยู่บนโหนด instruction เท่านั้น', () => {
    // กฎที่ล็อกไว้ ถ้าใครเผลอไปตั้งบน checkpoint เทสนี้จะจับได้
    const misplaced = safetyNodes
      .filter(({ node }) => node.type !== 'instruction')
      .map(({ node }) => node.node_id);

    expect(misplaced).toEqual([]);
  });

  it('ทุกโหนด safety_critical มีข้อความเตือนที่ไม่ว่างเปล่า', () => {
    // บทเรียนจาก demo ครั้งก่อน: กล่องเตือนสีแดงขึ้นมาแต่ไม่มีข้อความข้างใน
    const missing = safetyNodes
      .filter(({ node }) => !node.safety_warning || node.safety_warning.trim() === '')
      .map(({ node }) => node.node_id);

    expect(missing).toEqual([]);
  });

  it.each(safetyNodes.map((s) => [s.node.node_id, s] as const))(
    '%s บล็อก continue และสถานะไม่ขยับ',
    (_id, { graph, node }) => {
      const session: SessionState = {
        sessionId: 'test-session',
        graphId: graph.graph_id,
        currentNodeId: node.node_id,
        status: 'in_progress',
        variables: {},
        history: [],
      };

      expect(() => submitAction(session, graph, { type: 'continue' })).toThrow(
        SafetyConfirmationRequiredError,
      );

      // ยืนยันว่า session เดิมไม่ถูกแก้ระหว่างทาง
      expect(session.currentNodeId).toBe(node.node_id);
      expect(session.history).toHaveLength(0);
    },
  );

  it.each(safetyNodes.map((s) => [s.node.node_id, s] as const))(
    '%s ผ่านได้เมื่อส่ง confirm_safety',
    (_id, { graph, node }) => {
      const session: SessionState = {
        sessionId: 'test-session',
        graphId: graph.graph_id,
        currentNodeId: node.node_id,
        status: 'in_progress',
        variables: {},
        history: [],
      };

      const result = submitAction(session, graph, { type: 'confirm_safety' });

      expect(result.session.currentNodeId).not.toBe(node.node_id);
    },
  );
});

// ============================================================
// 5. โหนดจบทุกตัวต้องระบุผลลัพธ์
// ============================================================

describe('โหนดจบในข้อมูลจริง', () => {
  const terminals = graphs.flatMap((g) =>
    g.nodes.filter((n) => n.type === 'resolution' || n.type === 'escalation'),
  );

  it('ทุกโหนดจบมี outcome_kind', () => {
    const missing = terminals
      .filter((n) => !('outcome_kind' in n) || !n.outcome_kind)
      .map((n) => n.node_id);

    expect(missing).toEqual([]);
  });

  it('outcome_kind ใช้ค่าที่กำหนดไว้ 4 แบบเท่านั้น', () => {
    const allowed = ['user_fixed', 'normal_behavior', 'handoff_informed', 'handoff_unknown'];
    const invalid = terminals
      .filter((n) => 'outcome_kind' in n && !allowed.includes(n.outcome_kind))
      .map((n) => n.node_id);

    expect(invalid).toEqual([]);
  });
});