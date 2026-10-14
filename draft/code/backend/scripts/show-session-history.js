// backend/scripts/show-session-history.js
//
// ขั้น T2 — อ่านประวัติ action ของ session จากตาราง session_history โดยตรง (SELECT อย่างเดียว)
//
// ทำไมต้องมี: API ไม่เปิดประวัติให้อ่าน แต่หลักฐานที่หนักแน่นที่สุดว่า "ด่านความปลอดภัยทำงานที่เซิร์ฟเวอร์"
// คือ action ที่ถูกปฏิเสธ (continue ที่ยังไม่ยืนยันคำเตือน) ต้อง **ไม่ทิ้งแถว** ในตารางนี้
// ตาราง session_history เก็บเฉพาะ action ที่ engine รับแล้ว
//
// วิธีรัน (ยืนที่โฟลเดอร์ backend/):
//   node scripts/show-session-history.js <sessionId>
//
// ผลที่ถูกต้องของสคริปต์สาธิต demo-safety-gate.ps1 มี 3 แถว:
//   answer yes  ·  answer yes  ·  confirm_safety      และ "ไม่มี" แถวของ continue
//
// ใช้ค่าเชื่อมต่อจาก backend/.env แบบเดียวกับ run-migrations.js ไม่พิมพ์ค่าเชื่อมต่อออกมา
// ไม่เพิ่ม dependency (ใช้ mysql2 กับ dotenv ที่มีอยู่แล้ว)
// รหัสออก: 0 = อ่านสำเร็จ · 2 = ไม่พบ session · 1 = ผิดพลาดอื่น

require('dotenv/config');
const mysql = require('mysql2/promise');

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId || !UUID.test(sessionId)) {
    console.error('ใช้: node scripts/show-session-history.js <sessionId>   (รูปแบบ UUID 36 ตัวอักษร)');
    return 1;
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  });

  try {
    const [sessions] = await conn.query(
      'SELECT session_id, graph_id, current_node_id, status FROM sessions WHERE session_id = ?',
      [sessionId],
    );
    if (sessions.length === 0) {
      console.log(`ไม่พบ session ${sessionId} (อาจถูกลบแล้ว — การลบ session ลบประวัติตามไปด้วย ON DELETE CASCADE)`);
      return 2;
    }
    const s = sessions[0];
    console.log(`session ${s.session_id}`);
    console.log(`  ผัง: ${s.graph_id}  ·  สถานะปัจจุบัน: ${s.current_node_id}  ·  status: ${s.status}`);

    const [rows] = await conn.query(
      `SELECT step_order, node_id, action_type, action_value
         FROM session_history
        WHERE session_id = ?
        ORDER BY step_order`,
      [sessionId],
    );

    console.log(`\nsession_history: ${rows.length} แถว`);
    console.log('  step_order | node_id (สถานะที่อยู่ตอนส่ง) | action_type    | action_value');
    for (const r of rows) {
      console.log(
        `  ${String(r.step_order).padStart(10)} | ${String(r.node_id).padEnd(28)} | ${String(r.action_type).padEnd(14)} | ${r.action_value ?? ''}`,
      );
    }

    const hasContinue = rows.some((r) => r.action_type === 'continue');
    console.log(`\nมีแถวของ action_type = continue หรือไม่: ${hasContinue ? 'มี (ผิดคาด: การข้ามด่านถูกบันทึกเป็นการเดิน)' : 'ไม่มี'}`);
    return 0;
  } finally {
    await conn.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // ไม่พิมพ์ err ทั้งก้อน เพราะข้อความของ driver อาจมีค่าเชื่อมต่อ
    console.error('อ่านฐานข้อมูลไม่สำเร็จ:', err.code || err.name);
    process.exit(1);
  });
