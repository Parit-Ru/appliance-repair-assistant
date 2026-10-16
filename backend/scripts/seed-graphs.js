require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const DEFAULT_MANUAL = path.resolve(__dirname, '../../data/manuals/samsung_ac_ar70h.json');
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

  if (manual.schema_version !== 2) {
    problems.push(`schema_version เป็น ${manual.schema_version} ไม่ใช่ 2`);
  }

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

  for (const graph of manual.graphs) {
    const ids = new Set(graph.nodes.map((n) => n.node_id));

    if (!ids.has(graph.entry_node)) {
      problems.push(`${graph.graph_id}: entry_node '${graph.entry_node}' ไม่มีอยู่ในกราฟ`);
    }

    for (const node of graph.nodes) {
      const targets = [
        ['on_yes', node.on_yes],
        ['on_no', node.on_no],
        ['next', node.next],
        ['on_invalid', node.on_invalid],
      ].filter(([, value]) => value !== undefined && value !== null);

      for (const [field, target] of targets) {
        if (!ids.has(target)) {
          problems.push(`${graph.graph_id}/${node.node_id}: ${field} ชี้ไป '${target}' ที่ไม่มีอยู่`);
        }
      }

      if (node.safety_critical === true) {
        if (node.type !== 'instruction') {
          problems.push(`${graph.graph_id}/${node.node_id}: safety_critical อยู่บนโหนด ${node.type}`);
        }
        if (!node.safety_warning || node.safety_warning.trim() === '') {
          problems.push(`${graph.graph_id}/${node.node_id}: safety_critical แต่ไม่มี safety_warning`);
        }
      }
    }
  }

  return problems;
}

/** ข้อความของโหนด อยู่คนละ field ตามชนิด แต่เก็บลงคอลัมน์เดียวกัน */
function textOf(node) {
  switch (node.type) {
    case 'checkpoint':
      return node.question;
    case 'instruction':
    case 'resolution':
    case 'escalation':
      return node.content;
    case 'input':
      return node.prompt;
    default:
      throw new Error(`ไม่รู้จักชนิดโหนด '${node.type}'`);
  }
}

function nodeToRow(graphId, node, order) {
  return [
    graphId,
    node.node_id,
    node.type,
    textOf(node),
    node.on_yes ?? null,
    node.on_no ?? null,
    node.next ?? null,
    node.on_invalid ?? null,
    node.input_type ?? null,
    node.pattern ?? null,
    node.store_as ?? null,
    node.outcome_kind ?? null,
    node.safety_critical === true,
    node.safety_warning ?? null,
    node.has_image === true,
    node.image_url ?? null,
    node.author_note ?? null,
    node.external_reference ? JSON.stringify(node.external_reference) : null,
    order,
  ];
}

async function seedManual(conn, manual) {
  await conn.execute(
    `INSERT INTO manuals
       (manual_id, device_category, brand, model_pattern, source_manual, graph_count,
        display_name, model_aliases)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       device_category = VALUES(device_category),
       brand           = VALUES(brand),
       model_pattern   = VALUES(model_pattern),
       source_manual   = VALUES(source_manual),
       graph_count     = VALUES(graph_count),
       display_name    = VALUES(display_name),
       model_aliases   = VALUES(model_aliases)`,
    [
      manual.manual_id,
      manual.device_category,
      manual.brand,
      manual.model_pattern,
      manual.source_manual,
      manual.graphs.length,
      manual.display_name ?? null,
      manual.model_aliases ? JSON.stringify(manual.model_aliases) : null,
    ],
  );

  let nodeCount = 0;

  for (const graph of manual.graphs) {
    await conn.execute(
      `INSERT INTO graphs
         (graph_id, manual_id, entry_symptom, entry_symptom_th, entry_symptom_aliases,
          source, page_start, page_end, source_chunk_id,
          severity, difficulty, config, entry_node, schema_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         entry_node            = VALUES(entry_node)`,
      [
        graph.graph_id,
        manual.manual_id,
        graph.entry_symptom,
        graph.entry_symptom_th || null,
        graph.entry_symptom_aliases ? JSON.stringify(graph.entry_symptom_aliases) : null,
        graph.source,
        graph.page_range[0],
        graph.page_range[1],
        graph.source_chunk_id,
        graph.severity ?? null,
        graph.difficulty ?? null,
        graph.config ? JSON.stringify(graph.config) : null,
        graph.entry_node,
        graph.schema_version ?? manual.schema_version,
      ],
    );
    await conn.execute('DELETE FROM nodes WHERE graph_id = ?', [graph.graph_id]);

    const rows = graph.nodes.map((node, i) => nodeToRow(graph.graph_id, node, i));

    await conn.query(
      `INSERT INTO nodes
         (graph_id, node_id, node_type, text_content,
          on_yes, on_no, next_node, on_invalid,
          input_type, input_pattern, store_as, outcome_kind,
          safety_critical, safety_warning,
          has_image, image_url, author_note, external_reference, display_order)
       VALUES ?`,
      [rows],
    );

    nodeCount += rows.length;
  }

  return { graphs: manual.graphs.length, nodes: nodeCount };
}

async function report(conn) {
  const [[counts]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM manuals) AS manuals,
      (SELECT COUNT(*) FROM graphs)  AS graphs,
      (SELECT COUNT(*) FROM nodes)   AS nodes
  `);

  const [byType] = await conn.query(
    'SELECT node_type, COUNT(*) AS n FROM nodes GROUP BY node_type ORDER BY n DESC',
  );

  const [safety] = await conn.query(
    'SELECT graph_id, node_id FROM nodes WHERE safety_critical = TRUE ORDER BY graph_id, node_id',
  );

  console.log(`\nในฐานข้อมูลตอนนี้: ${counts.manuals} คู่มือ · ${counts.graphs} กราฟ · ${counts.nodes} โหนด`);
  console.log('\nแยกตามชนิดโหนด:');
  for (const row of byType) {
    console.log(`  ${row.node_type.padEnd(12)} ${String(row.n).padStart(4)}`);
  }

  console.log(`\nโหนดที่ต้องยืนยันความปลอดภัย ${safety.length} โหนด:`);
  for (const row of safety) {
    console.log(`  ${row.graph_id} / ${row.node_id}`);
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
  console.log(`คู่มือ: ${manual.manual_id} · ${manual.graphs.length} กราฟ`);

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

    console.log(`\nนำเข้าสำเร็จ: ${result.graphs} กราฟ · ${result.nodes} โหนด`);
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