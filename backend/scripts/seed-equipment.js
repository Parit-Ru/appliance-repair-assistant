require('dotenv/config');

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

const DEFAULT_FILE = path.resolve(__dirname, '../../data/equipment/equipment.json');
const VALID_CATEGORIES = [
  'Air Conditioner',
  'Microwave',
  'Refrigerator',
  'Television',
  'Washing Machine',
];
// การเชื่อมต่อ
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
function validate(data) {
  const problems = [];

  if (data.schema_version !== 1) {
    problems.push(`schema_version เป็น ${data.schema_version} ไม่ใช่ 1`);
  }

  // ตาราง equipment
  const ids = new Set();

  for (const item of data.equipment ?? []) {
    if (!item.equipment_id) {
      problems.push('มีรายการที่ไม่มี equipment_id');
      continue;
    }
    if (ids.has(item.equipment_id)) {
      problems.push(`equipment_id '${item.equipment_id}' ซ้ำ`);
    }
    ids.add(item.equipment_id);

    if (!item.name_th || item.name_th.trim() === '') {
      problems.push(`${item.equipment_id}: ไม่มี name_th`);
    }
    if (!item.name_en || item.name_en.trim() === '') {
      problems.push(`${item.equipment_id}: ไม่มี name_en`);
    }
  }

  // --- ตาราง equipment_usage ---
  const seenCategories = new Set();

  for (const group of data.usage ?? []) {
    if (!VALID_CATEGORIES.includes(group.device_category)) {
      problems.push(
        `ประเภทเครื่อง '${group.device_category}' ไม่อยู่ใน 5 ค่าที่กำหนด — ` +
          `สะกดให้ตรงกับ ENUM: ${VALID_CATEGORIES.join(' / ')}`,
      );
    }

    if (seenCategories.has(group.device_category)) {
      problems.push(`ประเภทเครื่อง '${group.device_category}' ถูกประกาศซ้ำ`);
    }
    seenCategories.add(group.device_category);

    const seenInGroup = new Set();

    for (const use of group.items ?? []) {
      const where = `${group.device_category}/${use.equipment_id}`;

      // ต้องอ้างถึงอุปกรณ์ที่ประกาศไว้จริง
      if (!ids.has(use.equipment_id)) {
        problems.push(`${where}: อ้างถึง equipment_id ที่ไม่ได้ประกาศไว้`);
      }

      if (seenInGroup.has(use.equipment_id)) {
        problems.push(`${where}: อุปกรณ์ซ้ำในประเภทเดียวกัน`);
      }
      seenInGroup.add(use.equipment_id);

      if (!use.purpose_th || use.purpose_th.trim() === '') {
        problems.push(`${where}: ไม่มี purpose_th`);
      }

      // 🔴 กฎเดียวกับ CHECK constraint ในฐานข้อมูล
      // ตรวจซ้ำที่นี่เพื่อให้ข้อความ error อ่านรู้เรื่องกว่า
      // 'Check constraint chk_usage_provenance is violated'
      const hasPage = use.source_page !== undefined && use.source_page !== null;
      const hasNote = use.author_note && use.author_note.trim() !== '';

      if (!hasPage && !hasNote) {
        problems.push(
          `${where}: ไม่ระบุที่มา — ต้องมี source_page (อ้างคู่มือ) ` +
            `หรือ author_note (ผู้พัฒนาเขียนเอง) อย่างน้อยหนึ่งอย่าง`,
        );
      }
    }
  }

  return problems;
}

async function seed(conn, data) {
  // 1) แคตตาล็อกอุปกรณ์ — upsert
  //    ใช้ upsert เพราะ equipment_usage อ้างถึงแบบ FOREIGN KEY
  //    ลบทิ้งแล้วเขียนใหม่จะลบ usage ตามไปด้วย (CASCADE)
  for (const item of data.equipment) {
    await conn.execute(
      `INSERT INTO equipment (equipment_id, name_th, name_en)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name_th = VALUES(name_th),
         name_en = VALUES(name_en)`,
      [item.equipment_id, item.name_th, item.name_en],
    );
  }

  // 2) เส้นเชื่อม — ลบของประเภทนั้นทิ้งแล้วเขียนใหม่
  //    ทำได้เพราะไม่มีตารางไหนอ้าง equipment_usage
  //    และต้องทำ เพื่อให้รายการที่ถูกลบออกจากไฟล์ JSON หายจากฐานข้อมูลด้วย
  let usageCount = 0;

  for (const group of data.usage) {
    await conn.execute('DELETE FROM equipment_usage WHERE device_category = ?', [
      group.device_category,
    ]);

    const rows = group.items.map((use, i) => [
      group.device_category,
      use.equipment_id,
      use.purpose_th,
      use.source_page ?? null,
      use.author_note ?? null,
      i,
    ]);

    if (rows.length > 0) {
      await conn.query(
        `INSERT INTO equipment_usage
           (device_category, equipment_id, purpose_th, source_page, author_note, display_order)
         VALUES ?`,
        [rows],
      );
    }

    usageCount += rows.length;
  }

  return { equipment: data.equipment.length, usage: usageCount };
}

async function report(conn) {
  const [[counts]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM equipment)       AS equipment,
      (SELECT COUNT(*) FROM equipment_usage) AS usage_rows
  `);

  const [byCategory] = await conn.query(`
    SELECT device_category,
           COUNT(*) AS total,
           SUM(source_page IS NOT NULL) AS from_manual,
           SUM(author_note IS NOT NULL) AS from_author
      FROM equipment_usage
     GROUP BY device_category
     ORDER BY device_category
  `);

  console.log(`\nในฐานข้อมูลตอนนี้: ${counts.equipment} อุปกรณ์ · ${counts.usage_rows} รายการใช้งาน`);
  console.log('\nแยกตามประเภทเครื่อง:');
  console.log('  ประเภท                 รวม  อ้างคู่มือ  เขียนเอง');

  for (const row of byCategory) {
    console.log(
      `  ${row.device_category.padEnd(20)} ${String(row.total).padStart(4)}` +
        `${String(row.from_manual).padStart(11)}${String(row.from_author).padStart(10)}`,
    );
  }

  // ประเภทที่ยังไม่มีข้อมูล — เตือนไว้ไม่ให้ลืม
  const done = new Set(byCategory.map((r) => r.device_category));
  const missing = VALID_CATEGORIES.filter((c) => !done.has(c));

  if (missing.length > 0) {
    console.log(`\n⬜ ยังไม่มีข้อมูล ${missing.length} ประเภท: ${missing.join(', ')}`);
  }
}
async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const verifyOnly = process.argv.includes('--verify');
  const filePath = args[0] ? path.resolve(args[0]) : DEFAULT_FILE;

  if (!fs.existsSync(filePath)) {
    throw new Error(`ไม่พบไฟล์ ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`อ่านไฟล์: ${path.basename(filePath)}`);
  console.log(
    `อุปกรณ์ ${data.equipment?.length ?? 0} ชิ้น · ` +
      `ประเภทเครื่อง ${data.usage?.length ?? 0} ประเภท`,
  );

  const problems = validate(data);
  if (problems.length > 0) {
    console.error(`\nพบปัญหา ${problems.length} จุด ยกเลิกการนำเข้า:`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log('ตรวจโครงสร้างผ่าน');

  // 🔴 ด่านสุดท้ายก่อนแตะฐานข้อมูล
  if (data.reviewed_by_author !== true) {
    console.error('');
    console.error('══════════════════════════════════════════════════════════════');
    console.error(' ❌ ยกเลิก: ข้อมูลยังไม่ผ่านการตรวจของผู้พัฒนา');
    console.error('══════════════════════════════════════════════════════════════');
    console.error('');
    console.error(' ไฟล์นี้มี "reviewed_by_author": false');
    console.error('');
    console.error(' รายการอุปกรณ์เป็นร่างที่ AI ช่วยดึงจากข้อความในคู่มือ');
    console.error(' ตามกฎของโครงงาน ข้อมูลนี้ต้องเป็นสิ่งที่ผู้พัฒนากำกับเอง');
    console.error('');
    console.error(' สิ่งที่ต้องทำก่อน:');
    console.error('   1. อ่านทุกรายการ ตัดอันที่ไม่จำเป็น เพิ่มอันที่ขาด');
    console.error('   2. ตรวจว่า source_page ที่กำกับไว้ เปิดคู่มือแล้วเจอจริง');
    console.error('   3. แก้คำอธิบายให้เป็นภาษาของตัวเอง');
    console.error('   4. เปลี่ยนเป็น "reviewed_by_author": true แล้วรันใหม่');
    console.error('');
    process.exit(1);
  }

  if (verifyOnly) {
    console.log('(โหมด --verify ไม่เขียนอะไรลงฐานข้อมูล)');
    return;
  }

  const conn = await mysql.createConnection(connectionConfig());

  try {
    // ครอบ transaction ได้จริง เพราะเป็น DML ไม่ใช่ DDL
    await conn.beginTransaction();
    const result = await seed(conn, data);
    await conn.commit();

    console.log(`\nนำเข้าสำเร็จ: ${result.equipment} อุปกรณ์ · ${result.usage} รายการใช้งาน`);
    await report(conn);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nseed อุปกรณ์ล้มเหลว:', err.message);
  process.exit(1);
});