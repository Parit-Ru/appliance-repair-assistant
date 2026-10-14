// backend/src/traversal-engine/traversal-engine.spec.ts

/**
 * เทสพฤติกรรมของ traversal engine
 *
 * ใช้ "กราฟจำลอง" ขนาดเล็กที่สร้างในไฟล์นี้เอง ไม่ใช่กราฟจริงจากคู่มือ
 * เหตุผล: เทสหนึ่งเคสควรพิสูจน์กฎหนึ่งข้อ ถ้าใช้กราฟจริงที่มี 16 โหนด
 * เวลาเทสแดงจะแยกไม่ออกว่าพังเพราะ engine หรือเพราะข้อมูลกราฟเปลี่ยน
 *
 * ส่วนการเดินกราฟจริงอยู่ในไฟล์ path-coverage.spec.ts แยกต่างหาก
 */

import {
  startSession,
  getCurrentNode,
  submitAction,
} from './traversal-engine';

import {
  TroubleshootingGraph,
  TroubleshootingNode,
  SessionState,
  UnsupportedSchemaVersionError,
  NodeNotFoundError,
  InvalidActionError,
  SafetyConfirmationRequiredError,
  SessionAlreadyCompletedError,
} from './types';

// ============================================================
// ตัวช่วยสร้างกราฟจำลอง
// ============================================================

/**
 * สร้างกราฟที่ใส่ field บังคับครบตาม TroubleshootingGraph
 * ให้แต่ละเทสสนใจแค่ nodes กับ entry_node พอ
 */
function makeGraph(
  nodes: TroubleshootingNode[],
  entryNode: string,
  overrides: Partial<TroubleshootingGraph> = {},
): TroubleshootingGraph {
  return {
    schema_version: 2,
    graph_id: 'test_graph',
    device_category: 'Air Conditioner',
    brand: 'Samsung',
    model_pattern: 'TEST**',
    entry_symptom: 'อาการทดสอบ',
    source: 'TEST_MANUAL',
    page_range: [43, 44],
    source_chunk_id: 'test_chunk',
    entry_node: entryNode,
    nodes,
    ...overrides,
  };
}

/** โหนดจบแบบแก้ได้ ใช้ปิดท้ายกราฟจำลองแทบทุกอัน */
const resolved: TroubleshootingNode = {
  node_id: 'n_end',
  type: 'resolution',
  content: 'แก้ปัญหาเรียบร้อย',
  outcome_kind: 'user_fixed',
};

/** โหนดจบแบบส่งต่อช่าง */
const escalated: TroubleshootingNode = {
  node_id: 'n_call',
  type: 'escalation',
  content: 'ติดต่อศูนย์บริการ',
  outcome_kind: 'handoff_unknown',
};

// ============================================================
// 1. startSession
// ============================================================

describe('startSession', () => {
  it('เริ่ม session ที่ entry_node พร้อมสถานะเริ่มต้นที่ถูกต้อง', () => {
    const graph = makeGraph([resolved], 'n_end');
    const { session, node } = startSession(graph);

    expect(session.currentNodeId).toBe('n_end');
    expect(session.graphId).toBe('test_graph');
    expect(session.variables).toEqual({});
    expect(session.history).toEqual([]);
    expect(node.nodeId).toBe('n_end');
  });

  it('สร้าง sessionId ไม่ซ้ำกันในแต่ละครั้ง', () => {
    const graph = makeGraph([resolved], 'n_end');
    const a = startSession(graph).session.sessionId;
    const b = startSession(graph).session.sessionId;

    expect(a).not.toBe(b);
  });

  it('แนบการอ้างอิงคู่มือมาจากระดับกราฟเสมอ ไม่ได้สร้างจากตัวโหนด', () => {
    const graph = makeGraph([resolved], 'n_end');
    const { node } = startSession(graph);

    expect(node.reference).toEqual({
      source: 'TEST_MANUAL',
      pageRange: [43, 44],
    });
  });

  it('โยน UnsupportedSchemaVersionError ถ้ากราฟไม่ใช่ schema v2', () => {
    // จำลองกรณีเผลอโหลดกราฟ v1 จาก JSON ซึ่ง TypeScript ตรวจไม่ได้ตอน compile
    const graph = makeGraph([resolved], 'n_end');
    (graph as unknown as { schema_version: number }).schema_version = 1;

    expect(() => startSession(graph)).toThrow(UnsupportedSchemaVersionError);
  });

  it('โยน NodeNotFoundError ถ้า entry_node ไม่มีอยู่ในกราฟ', () => {
    const graph = makeGraph([resolved], 'n_ไม่มีจริง');

    expect(() => startSession(graph)).toThrow(NodeNotFoundError);
  });
});

// ============================================================
// 2. checkpoint — คำถามใช่/ไม่ใช่
// ============================================================

describe('โหนด checkpoint', () => {
  const graph = makeGraph(
    [
      {
        node_id: 'n1',
        type: 'checkpoint',
        question: 'เครื่องได้รับไฟฟ้าอยู่หรือไม่?',
        on_yes: 'n_end',
        on_no: 'n_call',
      },
      resolved,
      escalated,
    ],
    'n1',
  );

  it('ตอบ yes ไปทาง on_yes', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'answer', value: 'yes' });

    expect(result.session.currentNodeId).toBe('n_end');
  });

  it('ตอบ no ไปทาง on_no', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'answer', value: 'no' });

    expect(result.session.currentNodeId).toBe('n_call');
  });

  it('ส่ง continue มาให้ checkpoint ไม่ได้', () => {
    const { session } = startSession(graph);

    expect(() => submitAction(session, graph, { type: 'continue' })).toThrow(InvalidActionError);
  });

  it('ส่ง input มาให้ checkpoint ไม่ได้', () => {
    const { session } = startSession(graph);

    expect(() =>
      submitAction(session, graph, { type: 'input', value: 'E1' }),
    ).toThrow(InvalidActionError);
  });

  it('ใช้ question เป็นข้อความที่แสดง', () => {
    const { node } = startSession(graph);

    expect(node.text).toBe('เครื่องได้รับไฟฟ้าอยู่หรือไม่?');
    expect(node.isTerminal).toBe(false);
  });
});

// ============================================================
// 3. instruction ธรรมดา
// ============================================================

describe('โหนด instruction ที่ไม่ใช่ safety_critical', () => {
  const graph = makeGraph(
    [
      {
        node_id: 'n_do',
        type: 'instruction',
        content: 'เสียบปลั๊กให้แน่น',
        next: 'n_end',
      },
      resolved,
    ],
    'n_do',
  );

  it('ส่ง continue แล้วไปโหนดถัดไป', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'continue' });

    expect(result.session.currentNodeId).toBe('n_end');
  });

  it('ส่ง answer มาให้ instruction ไม่ได้', () => {
    const { session } = startSession(graph);

    expect(() =>
      submitAction(session, graph, { type: 'answer', value: 'yes' }),
    ).toThrow(InvalidActionError);
  });

  it('requiresSafetyConfirmation เป็น false และไม่มีคำเตือน', () => {
    const { node } = startSession(graph);

    expect(node.requiresSafetyConfirmation).toBe(false);
    expect(node.safetyCritical).toBe(false);
    expect(node.safetyWarning).toBeUndefined();
  });
});

// ============================================================
// 4. 🔴 ด่านความปลอดภัย — ส่วนที่สำคัญที่สุดของไฟล์นี้
// ============================================================

describe('ด่านความปลอดภัยบน instruction ที่ safety_critical', () => {
  const graph = makeGraph(
    [
      {
        node_id: 'n_breaker',
        type: 'instruction',
        content: 'สับเบรกเกอร์กลับขึ้น',
        safety_critical: true,
        safety_warning: 'ตรวจสอบว่ามือแห้งและยืนบนพื้นแห้งก่อนแตะเบรกเกอร์',
        next: 'n_end',
      },
      resolved,
    ],
    'n_breaker',
  );

  it('ส่ง continue เพื่อข้ามคำเตือน ถูกบล็อกด้วย SafetyConfirmationRequiredError', () => {
    const { session } = startSession(graph);

    expect(() => submitAction(session, graph, { type: 'continue' })).toThrow(
      SafetyConfirmationRequiredError,
    );
  });

  it('session ไม่ขยับเลยเมื่อถูกบล็อก', () => {
    // นี่คือหัวใจของข้ออ้าง "บังคับที่เซิร์ฟเวอร์"
    // ถ้า engine เผลอบันทึกสถานะก่อนโยน error ผู้ใช้จะข้ามด่านได้ด้วยการยิงซ้ำ
    const { session } = startSession(graph);

    try {
      submitAction(session, graph, { type: 'continue' });
    } catch {
      // ตั้งใจกลืน error ไว้ เพราะเทสนี้สนใจสถานะหลังจากนั้น
    }

    expect(session.currentNodeId).toBe('n_breaker');
    expect(session.status).toBe('in_progress');
    expect(session.history).toHaveLength(0);
  });

  it('ส่ง confirm_safety แล้วเดินต่อได้', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'confirm_safety' });

    expect(result.session.currentNodeId).toBe('n_end');
  });

  it('ส่ง answer มาก็ยังผ่านไม่ได้ (ไม่ใช่แค่ continue ที่ถูกกัน)', () => {
    const { session } = startSession(graph);

    expect(() =>
      submitAction(session, graph, { type: 'answer', value: 'yes' }),
    ).toThrow(InvalidActionError);
  });

  it('ส่ง requiresSafetyConfirmation และ safetyWarning ให้ฝั่งหน้าจอครบ', () => {
    // บทเรียนจาก demo ครั้งก่อน: กล่องเตือนขึ้นแต่ว่างเปล่า
    const { node } = startSession(graph);

    expect(node.requiresSafetyConfirmation).toBe(true);
    expect(node.safetyCritical).toBe(true);
    expect(node.safetyWarning).toBe('ตรวจสอบว่ามือแห้งและยืนบนพื้นแห้งก่อนแตะเบรกเกอร์');
  });

  it('checkpoint ที่เผลอตั้ง safety_critical ไม่ทำให้ต้องยืนยันความปลอดภัย', () => {
    // กฎที่ล็อกไว้: safety_critical มีผลกับ instruction เท่านั้น
    // เพราะการ "ตอบคำถาม" ไม่มีอันตราย อันตรายอยู่ที่การลงมือทำ
    const odd = makeGraph(
      [
        {
          node_id: 'n_q',
          type: 'checkpoint',
          question: 'เบรกเกอร์ตกหรือไม่?',
          safety_critical: true,
          on_yes: 'n_end',
          on_no: 'n_end',
        },
        resolved,
      ],
      'n_q',
    );

    const { session, node } = startSession(odd);

    expect(node.requiresSafetyConfirmation).toBe(false);
    expect(() =>
      submitAction(session, odd, { type: 'answer', value: 'yes' }),
    ).not.toThrow();
  });
});

// ============================================================
// 5. โหนด input
// ============================================================

describe('โหนด input', () => {
  const graph = makeGraph(
    [
      {
        node_id: 'n_code',
        type: 'input',
        prompt: 'กรอกรหัสข้อผิดพลาดที่เห็นบนหน้าจอ',
        input_type: 'error_code',
        pattern: '^[A-Za-z]{1,2}[0-9]{1,3}$',
        store_as: 'error_code',
        next: 'n_end',
        on_invalid: 'n_call',
      },
      resolved,
      escalated,
    ],
    'n_code',
  );

  it('ค่าที่ตรง pattern เดินต่อและถูกเก็บลง variables', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'input', value: 'E1' });

    expect(result.session.currentNodeId).toBe('n_end');
    expect(result.session.variables).toEqual({ error_code: 'E1' });
  });

  it('ค่าที่ไม่ตรง pattern ไปทาง on_invalid และไม่ถูกเก็บ', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'input', value: 'ไม่รู้' });

    expect(result.session.currentNodeId).toBe('n_call');
    expect(result.session.variables).toEqual({});
  });

  it('ถ้าไม่ระบุ on_invalid จะวนกลับมาถามโหนดเดิม', () => {
    const noFallback = makeGraph(
      [
        {
          node_id: 'n_code',
          type: 'input',
          prompt: 'กรอกรหัส',
          input_type: 'error_code',
          pattern: '^[A-Z][0-9]$',
          store_as: 'code',
          next: 'n_end',
        },
        resolved,
      ],
      'n_code',
    );

    const { session } = startSession(noFallback);
    const result = submitAction(session, noFallback, { type: 'input', value: 'xxx' });

    expect(result.session.currentNodeId).toBe('n_code');
  });

  it('ถ้าไม่ระบุ pattern จะรับทุกค่า', () => {
    const anyValue = makeGraph(
      [
        {
          node_id: 'n_free',
          type: 'input',
          prompt: 'พิมพ์อะไรก็ได้',
          input_type: 'text',
          store_as: 'note',
          next: 'n_end',
        },
        resolved,
      ],
      'n_free',
    );

    const { session } = startSession(anyValue);
    const result = submitAction(session, anyValue, { type: 'input', value: '???' });

    expect(result.session.currentNodeId).toBe('n_end');
    expect(result.session.variables).toEqual({ note: '???' });
  });

  it('บอกชนิดคีย์บอร์ดที่ควรใช้ผ่าน inputType', () => {
    const { node } = startSession(graph);

    expect(node.inputType).toBe('error_code');
  });
});

// ============================================================
// 6. การแทนค่าตัวแปรในข้อความ
// ============================================================

describe('การแทน {{ตัวแปร}} ในข้อความ', () => {
  const graph = makeGraph(
    [
      {
        node_id: 'n_code',
        type: 'input',
        prompt: 'กรอกรหัส',
        input_type: 'error_code',
        store_as: 'error_code',
        next: 'n_show',
      },
      {
        node_id: 'n_show',
        type: 'escalation',
        content: 'รหัส {{error_code}} ต้องให้ช่างตรวจสอบ',
        outcome_kind: 'handoff_informed',
      },
    ],
    'n_code',
  );

  it('แทนค่าที่ผู้ใช้กรอกลงในข้อความโหนดถัดไป', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'input', value: 'E5' });

    expect(result.node.text).toBe('รหัส E5 ต้องให้ช่างตรวจสอบ');
  });

  it('ตัวแปรที่ไม่มีค่า ปล่อย {{key}} ไว้ให้เห็น ไม่แทนด้วยช่องว่าง', () => {
    // ตั้งใจให้บั๊กเห็นชัด ดีกว่าซ่อนไว้จนผู้ใช้เห็นประโยคขาดคำ
    const orphan = makeGraph(
      [
        {
          node_id: 'n_x',
          type: 'resolution',
          content: 'ค่าคือ {{ไม่เคยเก็บ}}',
          outcome_kind: 'user_fixed',
        },
      ],
      'n_x',
    );

    const { node } = startSession(orphan);

    expect(node.text).toBe('ค่าคือ {{ไม่เคยเก็บ}}');
  });
});

// ============================================================
// 7. โหนดจบ
// ============================================================

describe('โหนดจบ (resolution / escalation)', () => {
  const graph = makeGraph(
    [
      {
        node_id: 'n1',
        type: 'checkpoint',
        question: 'แก้ได้แล้วหรือยัง?',
        on_yes: 'n_end',
        on_no: 'n_call',
      },
      resolved,
      escalated,
    ],
    'n1',
  );

  it('ถึง resolution แล้ว session เปลี่ยนเป็น completed', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'answer', value: 'yes' });

    expect(result.session.status).toBe('completed');
    expect(result.node.isTerminal).toBe(true);
    expect(result.node.outcomeKind).toBe('user_fixed');
  });

  it('ถึง escalation แล้ว session เปลี่ยนเป็น completed เช่นกัน', () => {
    const { session } = startSession(graph);
    const result = submitAction(session, graph, { type: 'answer', value: 'no' });

    expect(result.session.status).toBe('completed');
    expect(result.node.outcomeKind).toBe('handoff_unknown');
  });

  it('ส่ง action เพิ่มหลังจบแล้ว โยน SessionAlreadyCompletedError', () => {
    const { session } = startSession(graph);
    const done = submitAction(session, graph, { type: 'answer', value: 'yes' }).session;

    expect(() => submitAction(done, graph, { type: 'continue' })).toThrow(
      SessionAlreadyCompletedError,
    );
  });

  it('เช็คสถานะจบก่อนเช็คความถูกต้องของ action', () => {
    // ส่ง action ที่ผิดชนิดเข้าไปตอน session จบแล้ว
    // ต้องได้ SessionAlreadyCompletedError ไม่ใช่ InvalidActionError
    // เพราะ "จบแล้ว" เป็นเหตุผลที่ตรงกับสิ่งที่ผู้ใช้ทำผิดมากกว่า
    const { session } = startSession(graph);
    const done = submitAction(session, graph, { type: 'answer', value: 'yes' }).session;

    expect(() =>
      submitAction(done, graph, { type: 'input', value: 'x' }),
    ).toThrow(SessionAlreadyCompletedError);
  });
});

// ============================================================
// 8. ความเป็น pure function
// ============================================================

describe('ความเป็น pure function ของ submitAction', () => {
  const graph = makeGraph(
    [
      {
        node_id: 'n1',
        type: 'checkpoint',
        question: 'ถามอะไรสักอย่าง',
        on_yes: 'n_end',
        on_no: 'n_call',
      },
      resolved,
      escalated,
    ],
    'n1',
  );

  it('ไม่แก้ session เดิม แต่คืน object ใหม่', () => {
    const { session } = startSession(graph);
    const before = JSON.parse(JSON.stringify(session)) as SessionState;

    const result = submitAction(session, graph, { type: 'answer', value: 'yes' });

    expect(session).toEqual(before);
    expect(result.session).not.toBe(session);
  });

  it('ส่ง action เดิมซ้ำจาก session เดิม ได้ผลเหมือนเดิมทุกครั้ง', () => {
    // คุณสมบัตินี้คือสิ่งที่ทำให้ระบบ "ผลลัพธ์ซ้ำได้" ต่างจาก LLM
    const { session } = startSession(graph);

    const a = submitAction(session, graph, { type: 'answer', value: 'yes' });
    const b = submitAction(session, graph, { type: 'answer', value: 'yes' });

    expect(a.session.currentNodeId).toBe(b.session.currentNodeId);
    expect(a.node).toEqual(b.node);
  });

  it('บันทึกประวัติสะสมตามลำดับที่เดินจริง', () => {
    const chain = makeGraph(
      [
        { node_id: 'a', type: 'instruction', content: 'ขั้นที่ 1', next: 'b' },
        { node_id: 'b', type: 'instruction', content: 'ขั้นที่ 2', next: 'n_end' },
        resolved,
      ],
      'a',
    );

    let { session } = startSession(chain);
    session = submitAction(session, chain, { type: 'continue' }).session;
    session = submitAction(session, chain, { type: 'continue' }).session;

    expect(session.history).toEqual([
      { nodeId: 'a', action: { type: 'continue' } },
      { nodeId: 'b', action: { type: 'continue' } },
    ]);
  });
});

// ============================================================
// 9. getCurrentNode
// ============================================================

describe('getCurrentNode', () => {
  it('อ่านโหนดปัจจุบันซ้ำได้โดยไม่เปลี่ยนสถานะ (เช่น ตอนผู้ใช้ refresh หน้าจอ)', () => {
    const graph = makeGraph(
      [
        {
          node_id: 'n1',
          type: 'checkpoint',
          question: 'คำถาม',
          on_yes: 'n_end',
          on_no: 'n_end',
        },
        resolved,
      ],
      'n1',
    );

    const { session, node } = startSession(graph);
    const again = getCurrentNode(session, graph);

    expect(again).toEqual(node);
    expect(session.currentNodeId).toBe('n1');
  });

  it('แทนค่าตัวแปรที่เก็บไว้แล้วด้วย', () => {
    const graph = makeGraph(
      [
        {
          node_id: 'n_show',
          type: 'resolution',
          content: 'รหัสที่กรอกคือ {{code}}',
          outcome_kind: 'handoff_informed',
        },
      ],
      'n_show',
    );

    const session: SessionState = {
      sessionId: 'fixed-id',
      graphId: 'test_graph',
      currentNodeId: 'n_show',
      status: 'in_progress',
      variables: { code: 'E7' },
      history: [],
    };

    expect(getCurrentNode(session, graph).text).toBe('รหัสที่กรอกคือ E7');
  });

  it('โยน NodeNotFoundError ถ้า currentNodeId ชี้ไปโหนดที่ไม่มีอยู่', () => {
    const graph = makeGraph([resolved], 'n_end');

    const broken: SessionState = {
      sessionId: 'fixed-id',
      graphId: 'test_graph',
      currentNodeId: 'n_หาย',
      status: 'in_progress',
      variables: {},
      history: [],
    };

    expect(() => getCurrentNode(broken, graph)).toThrow(NodeNotFoundError);
  });
});

// ============================================================
// 10. กราฟเสีย
// ============================================================

describe('กราฟที่มีเส้นชี้ไปโหนดที่ไม่มีอยู่', () => {
  it('โยน NodeNotFoundError แทนที่จะเงียบหรือค้าง', () => {
    const broken = makeGraph(
      [
        {
          node_id: 'n1',
          type: 'checkpoint',
          question: 'คำถาม',
          on_yes: 'n_ไม่มีจริง',
          on_no: 'n_end',
        },
        resolved,
      ],
      'n1',
    );

    const { session } = startSession(broken);

    expect(() =>
      submitAction(session, broken, { type: 'answer', value: 'yes' }),
    ).toThrow(NodeNotFoundError);
  });
});