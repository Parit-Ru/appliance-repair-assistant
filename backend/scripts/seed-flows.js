require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const DEFAULT_MANUAL = path.resolve(__dirname, '../../data/manuals/samsung_ge83mdt_um_de68_04111e.json');
function connectionConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  };
}

function validateManual(manual) {
  const problems = [];

  // ชื่อรุ่นที่ผู้ใช้รู้จัก (migration 006) ไม่บังคับ ไม่มี = หน้าเว็บแสดง model_pattern แทน
  if (
    manual.display_name !== undefined &&
    (typeof manual.display_name !== 'string' ||
      manual.display_name.trim() === '' ||
      manual.display_name.length > 120)
  ) {
    problems.push('display_name ต้องเป็นข้อความที่ไม่ว่างและไม่เกิน 120 ตัวอักษร');
  }
  if (
    manual.model_aliases !== undefined &&
    !(Array.isArray(manual.model_aliases) && manual.model_aliases.every((a) => typeof a === 'string'))
  ) {
    problems.push('model_aliases ต้องเป็นอาร์เรย์ของข้อความ');
  }

  for (const flow of manual.flows) {
    const ids = new Set(flow.states.map((n) => n.state_id));

    if (!ids.has(flow.initial_state)) {
      problems.push(`${flow.flow_id}: initial_state '${flow.initial_state}' ไม่มีอยู่ในผังขั้นตอน`);
    }

    for (const state of flow.states) {
      const targets = [
        ['on_yes', state.on_yes],
        ['on_no', state.on_no],
        ['next', state.next],
        ['on_invalid', state.on_invalid],
      ].filter(([, value]) => value !== undefined && value !== null);

      for (const [field, target] of targets) {
        if (!ids.has(target)) {
          problems.push(`${flow.flow_id}/${state.state_id}: ${field} ชี้ไป '${target}' ที่ไม่มีอยู่`);
        }
      }

      if (state.safety_critical === true) {
        if (state.type !== 'instruction') {
          problems.push(`${flow.flow_id}/${state.state_id}: safety_critical อยู่บนสถานะ ${state.type}`);
        }
        if (!state.safety_warning || state.safety_warning.trim() === '') {
          problems.push(`${flow.flow_id}/${state.state_id}: safety_critical แต่ไม่มี safety_warning`);
        }
      }
    }
  }

  return problems;
}

/** ข้อความของสถานะ อยู่คนละ field ตามชนิด แต่เก็บลงคอลัมน์เดียวกัน */
function textOf(state) {
  switch (state.type) {
    case 'checkpoint':
      return state.question;
    case 'instruction':
    case 'resolution':
    case 'escalation':
      return state.content;
    case 'input':
      return state.prompt;
    default:
      throw new Error(`ไม่รู้จักชนิดสถานะ '${state.type}'`);
  }
}

function stateToRow(flowId, state, order) {
  return [
    flowId,
    state.state_id,
    state.type,
    textOf(state),
    state.input_type ?? null,
    state.pattern ?? null,
    state.store_as ?? null,
    state.outcome_kind ?? null,
    state.safety_critical === true,
    state.safety_warning ?? null,
    state.has_image === true,
    state.image_url ?? null,
    state.author_note ?? null,
    state.external_reference ? JSON.stringify(state.external_reference) : null,
    order,
  ];
}

/**
 * δ ของสถานะหนึ่ง → แถวของ state_transitions: [flow_id, from_state_id, input_symbol, to_state_id]
 * field ในไฟล์คู่มือ (on_yes/on_no/next/on_invalid) ↔ input_symbol (yes/no/next/invalid) · ค่า NULL/ว่าง = ไม่มีแถว
 */
const TRANSITION_FIELDS = [
  ['yes', 'on_yes'],
  ['no', 'on_no'],
  ['next', 'next'],
  ['invalid', 'on_invalid'],
];

function transitionRows(flowId, state) {
  return TRANSITION_FIELDS
    .filter(([, field]) => state[field] !== undefined && state[field] !== null && state[field] !== '')
    .map(([symbol, field]) => [flowId, state.state_id, symbol, state[field]]);
}

async function seedManual(conn, manual) {
  await conn.execute(
    `INSERT INTO manuals
       (manual_id, device_category, brand, model_pattern, source_manual, flow_count,
        display_name, model_aliases)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       device_category = VALUES(device_category),
       brand           = VALUES(brand),
       model_pattern   = VALUES(model_pattern),
       source_manual   = VALUES(source_manual),
       flow_count     = VALUES(flow_count),
       display_name    = VALUES(display_name),
       model_aliases   = VALUES(model_aliases)`,
    [
      manual.manual_id,
      manual.device_category,
      manual.brand,
      manual.model_pattern,
      manual.source_manual,
      manual.flows.length,
      manual.display_name ?? null,
      manual.model_aliases ? JSON.stringify(manual.model_aliases) : null,
    ],
  );

  let stateCount = 0;
  let transitionCount = 0;

  for (const flow of manual.flows) {
    await conn.execute(
      `INSERT INTO flows
         (flow_id, manual_id, entry_symptom, entry_symptom_th, entry_symptom_aliases,
          source, page_start, page_end, source_chunk_id,
          severity, difficulty, config, initial_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         entry_symptom         = VALUES(entry_symptom),
         entry_symptom_th      = VALUES(entry_symptom_th),
         entry_symptom_aliases = VALUES(entry_symptom_aliases),
         source                = VALUES(source),
         page_start            = VALUES(page_start),
         page_end              = VALUES(page_end),
         source_chunk_id       = VALUES(source_chunk_id),
         severity              = VALUES(severity),
         difficulty            = VALUES(difficulty),
         config                = VALUES(config),
         initial_state         = VALUES(initial_state)`,
      [
        flow.flow_id,
        manual.manual_id,
        flow.entry_symptom,
        flow.entry_symptom_th || null,
        flow.entry_symptom_aliases ? JSON.stringify(flow.entry_symptom_aliases) : null,
        flow.source,
        flow.page_range[0],
        flow.page_range[1],
        flow.source_chunk_id,
        flow.severity ?? null,
        flow.difficulty ?? null,
        flow.config ? JSON.stringify(flow.config) : null,
        flow.initial_state,
      ],
    );
    await conn.execute('DELETE FROM states WHERE flow_id = ?', [flow.flow_id]);

    const rows = flow.states.map((state, i) => stateToRow(flow.flow_id, state, i));

    await conn.query(
      `INSERT INTO states
         (flow_id, state_id, state_type, text_content,
          input_type, input_pattern, store_as, outcome_kind,
          safety_critical, safety_warning,
          has_image, image_url, author_note, external_reference, display_order)
       VALUES ?`,
      [rows],
    );

    // state_transitions อ้างอิง states (FK) จึงต้อง INSERT หลัง states ครบทั้งผังแล้วเท่านั้น
    // (DELETE FROM states ด้านบนลบ transition เดิมของผังนี้ตามไปด้วย ผ่าน ON DELETE CASCADE)
    const transitions = flow.states.flatMap((state) => transitionRows(flow.flow_id, state));
    if (transitions.length > 0) {
      await conn.query(
        `INSERT INTO state_transitions (flow_id, from_state_id, input_symbol, to_state_id) VALUES ?`,
        [transitions],
      );
    }

    stateCount += rows.length;
    transitionCount += transitions.length;
  }

  return { flows: manual.flows.length, states: stateCount, transitions: transitionCount };
}

async function report(conn) {
  const [[counts]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM manuals) AS manuals,
      (SELECT COUNT(*) FROM flows)   AS flows,
      (SELECT COUNT(*) FROM states)  AS states,
      (SELECT COUNT(*) FROM state_transitions) AS transitions
  `);

  const [byType] = await conn.query(
    'SELECT state_type, COUNT(*) AS n FROM states GROUP BY state_type ORDER BY n DESC',
  );

  const [safety] = await conn.query(
    'SELECT flow_id, state_id FROM states WHERE safety_critical = TRUE ORDER BY flow_id, state_id',
  );

  console.log(`\nในฐานข้อมูลตอนนี้: ${counts.manuals} คู่มือ · ${counts.flows} ผังขั้นตอน · ${counts.states} สถานะ · ${counts.transitions} transition`);
  console.log('\nแยกตามชนิดสถานะ:');
  for (const row of byType) {
    console.log(`  ${row.state_type.padEnd(12)} ${String(row.n).padStart(4)}`);
  }

  console.log(`\nสถานะที่ต้องยืนยันความปลอดภัย ${safety.length} สถานะ:`);
  for (const row of safety) {
    console.log(`  ${row.flow_id} / ${row.state_id}`);
  }
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const verifyOnly = process.argv.includes('--verify');
  const manualPath = args[0] ? path.resolve(args[0]) : DEFAULT_MANUAL;

  if (!fs.existsSync(manualPath)) {
    throw new Error(`ไม่พบไฟล์ ${manualPath}`);
  }

  const manual = JSON.parse(fs.readFileSync(manualPath, 'utf-8'));

  console.log(`อ่านไฟล์: ${path.basename(manualPath)}`);
  console.log(`คู่มือ: ${manual.manual_id} · ${manual.flows.length} ผังขั้นตอน`);

  const problems = validateManual(manual);
  if (problems.length > 0) {
    console.error(`\nพบปัญหา ${problems.length} จุด ยกเลิกการนำเข้า:`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log('ตรวจโครงสร้างผ่าน');
  if (!manual.display_name) {
    console.log('หมายเหตุ: ไม่มี display_name (หน้าเว็บจะแสดง model_pattern แทน ไม่เดาชื่อ)');
  }

  if (verifyOnly) {
    console.log('(โหมด --verify ไม่เขียนอะไรลงฐานข้อมูล)');
    return;
  }

  const conn = await mysql.createConnection(connectionConfig());

  try {
    await conn.beginTransaction();

    const result = await seedManual(conn, manual);

    await conn.commit();

    console.log(`\nนำเข้าสำเร็จ: ${result.flows} ผังขั้นตอน · ${result.states} สถานะ · ${result.transitions} transition`);
    await report(conn);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nseed ล้มเหลว:', err.message);
  process.exit(1);
});