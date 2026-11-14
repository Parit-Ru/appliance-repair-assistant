// QA API test — รันกับ backend ทดสอบที่ชี้ fixbot_qa_test บน localhost เท่านั้น
// ใช้: BASE=http://localhost:3999 ADMIN_EMAIL=... ADMIN_PASSWORD=... JWT_SECRET=... node qa-tests/api-qa.mjs
import crypto from 'node:crypto';

const BASE = process.env.BASE ?? 'http://localhost:3999';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('BASE ต้องเป็น localhost เท่านั้น');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  if (!ok) console.log(`FAIL  ${name}  ${detail}`);
};

async function call(method, path, { body, token, cid, raw, headers } = {}) {
  const h = { ...(headers ?? {}) };
  if (body !== undefined && !raw) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (cid) h['X-Client-Id'] = cid;
  const res = await fetch(BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* ไม่ใช่ JSON */ }
  return { status: res.status, json, text };
}

const rnd = crypto.randomBytes(4).toString('hex');
const email = `qa-${rnd}@example.test`;
const email2 = `qa2-${rnd}@example.test`;
const pw = 'QaPassword123';

// ---------- AUTH ----------
let r = await call('POST', '/auth/register', { body: { email, password: pw, displayName: 'ทดสอบ QA' } });
check('register ปกติ → 201', r.status === 201, JSON.stringify(r.json));
const userToken = r.json?.accessToken;
const userId = r.json?.user?.id;
check('register ได้ role=user', r.json?.user?.role === 'user');
check('register ไม่คืน password_hash', !/password/i.test(JSON.stringify(r.json?.user ?? {})));

r = await call('POST', '/auth/register', { body: { email, password: pw, displayName: 'x' } });
check('register อีเมลซ้ำ → 409', r.status === 409, `status=${r.status}`);
r = await call('POST', '/auth/register', { body: { email: email.toUpperCase(), password: pw, displayName: 'x' } });
check('register อีเมลซ้ำต่างตัวพิมพ์ → 409', r.status === 409, `status=${r.status}`);
for (const [n, b] of [
  ['email ผิดรูป', { email: 'abc', password: pw, displayName: 'a' }],
  ['password สั้น', { email: `a${rnd}@example.test`, password: '123', displayName: 'a' }],
  ['displayName ว่าง', { email: `b${rnd}@example.test`, password: pw, displayName: '   ' }],
  ['password เป็นตัวเลข', { email: `c${rnd}@example.test`, password: 12345678, displayName: 'a' }],
]) {
  r = await call('POST', '/auth/register', { body: b });
  check(`register ${n} → 400`, r.status === 400, `status=${r.status}`);
}
r = await call('POST', '/auth/register', { raw: '{bad json', headers: { 'Content-Type': 'application/json' } });
check('register JSON พัง → 400 (ไม่ใช่ 500)', r.status === 400, `status=${r.status} ${r.text.slice(0, 120)}`);
r = await call('POST', '/auth/register', { raw: '[]', headers: { 'Content-Type': 'application/json' } });
check('register body เป็นอาร์เรย์ → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/auth/register', { body: { email: email2, password: 'ก'.repeat(30), displayName: 'a' } });
check('register รหัสผ่านไทย 30 ตัว (90 ไบต์) → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/auth/register', { body: { email: `e${rnd}@example.test`, password: pw, displayName: 'สมชาย 😀 <script>alert(1)</script>' } });
check('register ชื่อมีอีโมจิ/HTML → 201 และเก็บถูกต้อง', r.status === 201 && r.json?.user?.displayName.includes('😀'), `status=${r.status} ${r.text.slice(0, 150)}`);

r = await call('POST', '/auth/login', { body: { email, password: 'wrong-password' } });
check('login รหัสผิด → 401', r.status === 401, `status=${r.status}`);
const wrongPwMsg = r.json?.message;
r = await call('POST', '/auth/login', { body: { email: `nobody${rnd}@example.test`, password: pw } });
check('login อีเมลไม่มี → 401 ข้อความเดียวกับรหัสผิด (ไม่เปิดเผยว่ามีบัญชี)', r.status === 401 && r.json?.message === wrongPwMsg, `${r.status} ${r.json?.message} vs ${wrongPwMsg}`);
r = await call('POST', '/auth/login', { body: { email: email.toUpperCase(), password: pw } });
check('login อีเมลตัวพิมพ์ใหญ่ → 200', r.status === 200, `status=${r.status}`);
r = await call('POST', '/auth/login', { body: {} });
check('login body ว่าง → 400', r.status === 400, `status=${r.status}`);

r = await call('GET', '/auth/me');
check('/auth/me ไม่มี token → 401', r.status === 401);
r = await call('GET', '/auth/me', { token: 'abc.def.ghi' });
check('/auth/me token มั่ว → 401', r.status === 401);
r = await call('GET', '/auth/me', { headers: { Authorization: 'Basic xxx' } });
check('/auth/me scheme ผิด → 401', r.status === 401);
r = await call('GET', '/auth/me', { token: userToken });
check('/auth/me token ถูก → 200', r.status === 200 && r.json?.email === email, `status=${r.status}`);

// สร้าง token แบบเซ็นเอง (ใช้ JWT_SECRET ของ server ทดสอบ)
const secret = process.env.JWT_SECRET;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (payload, key = secret, alg = 'HS256') => {
  const head = b64({ alg, typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createHmac('sha256', key).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};
if (secret) {
  const now = Math.floor(Date.now() / 1000);
  r = await call('GET', '/auth/me', { token: sign({ sub: userId, role: 'user', iat: now - 100, exp: now - 10 }) });
  check('token หมดอายุ → 401', r.status === 401, `status=${r.status}`);
  r = await call('GET', '/auth/me', { token: sign({ sub: userId, role: 'user', exp: now + 100 }, 'wrong-secret-wrong-secret-wrong-secret') });
  check('token เซ็นด้วย secret ผิด → 401', r.status === 401, `status=${r.status}`);
  const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: userId, role: 'admin', exp: now + 100 })}.`;
  r = await call('GET', '/admin/feedback', { token: none });
  check('token alg=none → 401', r.status === 401, `status=${r.status}`);
  r = await call('GET', '/admin/feedback', { token: sign({ sub: userId, role: 'admin', exp: now + 100 }) });
  check('token เคลมตัวเองเป็น admin (เซ็นถูก) แต่ DB เป็น user → 403', r.status === 403, `status=${r.status}`);
  r = await call('GET', '/auth/me', { token: sign({ sub: '99999999', role: 'user', exp: now + 100 }) });
  check('token ของ user ที่ไม่มีใน DB → 401', r.status === 401, `status=${r.status}`);
}

// ---------- ADMIN GUARD ----------
for (const [m, p] of [['GET', '/admin/feedback'], ['GET', '/admin/analytics/summary'], ['GET', '/admin/flows'], ['GET', '/admin/drafts'], ['POST', '/admin/drafts/1/publish']]) {
  r = await call(m, p);
  check(`${m} ${p} ไม่มี token → 401`, r.status === 401, `status=${r.status}`);
  r = await call(m, p, { token: userToken });
  check(`${m} ${p} user ธรรมดา → 403`, r.status === 403, `status=${r.status}`);
}

// ---------- CHAT (guest) ----------
const cidA = crypto.randomUUID();
const cidB = crypto.randomUUID();
r = await call('GET', '/execution/flows');
check('list flows → 200 มีข้อมูล', r.status === 200 && r.json.length > 0);
const flows = r.json ?? [];
r = await call('GET', '/execution/flows?manualId=nope');
check('list flows manualId ไม่มีจริง → 200 []', r.status === 200 && Array.isArray(r.json) && r.json.length === 0, `status=${r.status}`);
r = await call('GET', '/execution/flows?manualId=a&manualId=b');
check('list flows manualId เป็นอาร์เรย์ → 400', r.status === 400, `status=${r.status}`);

r = await call('POST', '/execution/sessions', { body: {} , cid: cidA });
check('start session ไม่มี flowId → 400', r.status === 400);
r = await call('POST', '/execution/sessions', { body: { flowId: 'no_such_flow' }, cid: cidA });
check('start session flow ไม่มี → 404', r.status === 404, `status=${r.status}`);
r = await call('POST', '/execution/sessions', { body: { flowId: flows[0].flowId }, cid: 'not-a-uuid' });
check('start session X-Client-Id ไม่ใช่ UUID → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/execution/sessions', { body: { flowId: flows[0].flowId, modelSelection: 'bogus' }, cid: cidA });
check('start session modelSelection ผิด → 400', r.status === 400);

const arcing = flows.find((f) => f.flowId.endsWith('arcing')) ?? flows[0];
r = await call('POST', '/execution/sessions', { body: { flowId: arcing.flowId, modelSelection: 'selected' }, cid: cidA });
check('start session guest → 201', r.status === 201, `status=${r.status}`);
let sid = r.json?.sessionId;

r = await call('GET', `/execution/sessions/${sid}`, { cid: cidA });
check('GET session ของตัวเอง → 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 200)}`);
r = await call('GET', `/execution/sessions/${sid}`, { cid: cidB });
check('GET session ของคนอื่น (guest อื่น) → 404', r.status === 404, `status=${r.status}`);
r = await call('GET', `/execution/sessions/${sid}`);
check('GET session ไม่ส่ง client id → 400', r.status === 400, `status=${r.status}`);
r = await call('GET', `/execution/sessions/${sid}`, { token: userToken });
check('GET session ของ guest ด้วย token user อื่น → 404', r.status === 404, `status=${r.status}`);

// เดินผังจนจบ: ตอบ no/yes สลับ, ยืนยัน safety, ใส่ input
const trace = [];
let cur = null;
r = await call('POST', '/execution/sessions', { body: { flowId: arcing.flowId }, cid: cidA });
sid = r.json.sessionId; cur = r.json;
let guard = 0;
while (cur.status === 'in_progress' && guard++ < 40) {
  const s = cur.state;
  trace.push(`${s.stateId}:${s.type}${s.safetyCritical ? '(safety)' : ''}`);
  let action;
  if (s.requiresSafetyConfirmation) {
    // ลองข้ามคำเตือนด้วย answer ก่อน ต้องไม่ผ่าน
    const skip = await call('POST', `/execution/sessions/${sid}/actions`, { body: { type: 'continue' }, cid: cidA });
    check(`ข้ามคำเตือน safety ที่ ${s.stateId} ด้วย continue ต้องไม่ผ่าน`, skip.status >= 400 && skip.status < 500, `status=${skip.status}`);
    action = { type: 'confirm_safety' };
  } else if (s.type === 'checkpoint') action = { type: 'answer', value: 'no' };
  else if (s.type === 'input') action = { type: 'input', value: 'E-01' };
  else action = { type: 'continue' };
  r = await call('POST', `/execution/sessions/${sid}/actions`, { body: action, cid: cidA });
  if (r.status !== 201) { check(`action ${JSON.stringify(action)} ที่ ${s.stateId}`, false, `status=${r.status} ${r.text.slice(0, 160)}`); break; }
  cur = r.json;
}
check('เดินผังจนจบ (completed)', cur.status === 'completed', `trace=${trace.join(' > ')}`);
check('จบแล้วมี displayText/ข้อความสุดท้าย', typeof cur.state?.text === 'string' && cur.state.text.length > 0);
r = await call('POST', `/execution/sessions/${sid}/actions`, { body: { type: 'continue' }, cid: cidA });
check('ส่ง action หลัง session จบ → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`);
for (const [n, b] of [['type แปลก', { type: 'hack' }], ['answer ไม่มี value', { type: 'answer' }], ['body ว่าง', {}]]) {
  r = await call('POST', `/execution/sessions/${sid}/actions`, { body: b, cid: cidA });
  check(`action ${n} → 400`, r.status === 400, `status=${r.status}`);
}
r = await call('POST', `/execution/sessions/${sid}/actions`, { body: { type: 'continue' }, cid: cidB });
check('ส่ง action เข้า session คนอื่น → 404', r.status === 404, `status=${r.status}`);

r = await call('POST', `/execution/sessions/${sid}/outcome`, { body: { text: '   ' }, cid: cidA });
check('outcome ว่าง → 400', r.status === 400);
r = await call('POST', `/execution/sessions/${sid}/outcome`, { body: { text: 'ก'.repeat(1001) }, cid: cidA });
check('outcome ยาว 1001 → 400', r.status === 400);
r = await call('POST', `/execution/sessions/${sid}/outcome`, { body: { text: 'แก้ได้แล้ว ขอบคุณ 🙏' }, cid: cidA });
check('outcome ปกติ → 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 160)}`);

// ---------- HISTORY / FEEDBACK ----------
r = await call('GET', '/history', { cid: cidA });
check('history list ของตัวเอง → 200 มี 1 รายการ+', r.status === 200 && r.json?.total >= 1, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await call('GET', '/history', { cid: cidB });
check('history ของ guest อื่นไม่เห็นรายการของ A', r.status === 200 && r.json?.total === 0, `total=${r.json?.total}`);
r = await call('GET', `/history/${sid}`, { cid: cidB });
check('history detail ของคนอื่น → 404', r.status === 404, `status=${r.status}`);
r = await call('GET', `/history/${sid}`, { token: userToken });
check('history detail ด้วย token user อื่น → 404', r.status === 404, `status=${r.status}`);
r = await call('GET', `/history/${sid}`, { cid: cidA });
check('history detail ของตัวเอง → 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 160)}`);
for (const q of ['page=0', 'page=abc', 'pageSize=51', 'pageSize=0', 'page=-1', 'page=1.5', 'page=99999999999999999999']) {
  r = await call('GET', `/history?${q}`, { cid: cidA });
  check(`history ?${q} → 400 หรือ 200 ที่ไม่พัง`, r.status === 400 || r.status === 200, `status=${r.status}`);
}
r = await call('GET', '/history?page=999', { cid: cidA });
check('history หน้าเกิน → 200 items ว่าง', r.status === 200 && r.json?.items?.length === 0, `status=${r.status}`);
r = await call('GET', '/history');
check('history ไม่มี client id/token → 400', r.status === 400, `status=${r.status}`);

const fb = (b, cid = cidA) => call('POST', `/history/${sid}/feedback`, { body: b, cid });
r = await fb({ helpful: true });
check('feedback 👍 → 2xx', r.status >= 200 && r.status < 300, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await fb({ helpful: true });
check('feedback 👍 ซ้ำ → 2xx ไม่ error', r.status >= 200 && r.status < 300, `status=${r.status}`);
r = await fb({ helpful: false, comment: 'ไม่ช่วย' });
check('feedback เปลี่ยนใจเป็น 👎 + comment → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
r = await call('GET', `/history/${sid}`, { cid: cidA });
check('feedback ล่าสุดคือ 👎 เก็บ comment', r.json?.feedback?.helpful === false && r.json?.feedback?.comment === 'ไม่ช่วย', JSON.stringify(r.json?.feedback));
r = await fb({ helpful: true, comment: `ทดสอบ '"; DROP TABLE users;-- <b>x</b> 😀 \\n` });
check('feedback comment อักขระพิเศษ/SQL → 2xx', r.status >= 200 && r.status < 300, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await call('GET', `/history/${sid}`, { cid: cidA });
check('comment พิเศษถูกเก็บครบไม่เพี้ยน', r.json?.feedback?.comment?.includes('DROP TABLE') && r.json.feedback.comment.includes('😀'), JSON.stringify(r.json?.feedback));
r = await fb({ helpful: true, comment: 'ก'.repeat(501) });
check('feedback comment 501 ตัว → 400', r.status === 400, `status=${r.status}`);
r = await fb({ helpful: 'yes' });
check('feedback helpful ไม่ใช่ boolean → 400', r.status === 400, `status=${r.status}`);
r = await fb({});
check('feedback body ว่าง → 400', r.status === 400, `status=${r.status}`);
r = await fb({ helpful: true }, cidB);
check('feedback ใส่ session คนอื่น → 404', r.status === 404, `status=${r.status}`);

// ลบ session ของคนอื่น/ของตัวเอง
r = await call('DELETE', `/history/${sid}`, { cid: cidB });
check('DELETE history ของคนอื่น → 404', r.status === 404, `status=${r.status}`);
r = await call('DELETE', `/execution/sessions/${sid}`, { cid: cidB });
check('DELETE execution session ของคนอื่น → 404', r.status === 404, `status=${r.status}`);
r = await call('GET', `/history/${sid}`, { cid: cidA });
check('หลังโดนลองลบโดยคนอื่น session ยังอยู่', r.status === 200, `status=${r.status}`);
r = await call('DELETE', `/history/${sid}`, { cid: cidA });
check('DELETE history ของตัวเอง → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
r = await call('GET', `/history/${sid}`, { cid: cidA });
check('หลังลบ → 404', r.status === 404, `status=${r.status}`);

// session ว่าง (เริ่มแล้วยังไม่ตอบ) ต้องโผล่ในประวัติโดยไม่พัง
r = await call('POST', '/execution/sessions', { body: { flowId: arcing.flowId }, cid: cidA });
const emptySid = r.json?.sessionId;
r = await call('GET', `/history/${emptySid}`, { cid: cidA });
check('history detail ของ session ที่ยังไม่เดินสักขั้น → 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await call('POST', `/history/${emptySid}/feedback`, { body: { helpful: true }, cid: cidA });
console.log(`INFO  feedback บน session ที่ยังไม่จบ → ${r.status}`);

// ผู้ใช้ที่ login แล้ว: session ผูก user ไม่ใช่ client id
r = await call('POST', '/execution/sessions', { body: { flowId: arcing.flowId }, token: userToken });
const usid = r.json?.sessionId;
check('user login เริ่ม session โดยไม่ส่ง client id → 201', r.status === 201, `status=${r.status}`);
r = await call('GET', `/execution/sessions/${usid}`, { token: userToken });
check('user อ่าน session ของตัวเอง → 200', r.status === 200, `status=${r.status}`);
r = await call('GET', `/history/${usid}`, { cid: cidA });
check('guest ไม่เห็น session ของ user → 404', r.status === 404, `status=${r.status}`);

// ข้อความไทย/ยาวมากใน query
r = await call('POST', '/execution/sessions', { body: { flowId: arcing.flowId, query: 'ก'.repeat(5000) }, cid: cidA });
check('start session query ยาว 5000 → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/execution/sessions', { body: { flowId: arcing.flowId, query: '   ' }, cid: cidA });
check('start session query ว่าง → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/symptom-search', { body: { query: 'ไมโครเวฟมีประกายไฟ' } });
console.log(`INFO  symptom-search (ปิดอยู่) → ${r.status} ${r.text.slice(0, 120)}`);
r = await call('GET', '/nope');
check('route ไม่มี → 404 JSON', r.status === 404);

// ---------- ADMIN ----------
const adminLogin = await call('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
const adminToken = adminLogin.json?.accessToken;
check('admin login → 200 role=admin', adminLogin.status === 200 && adminLogin.json?.user?.role === 'admin', `status=${adminLogin.status}`);
for (const p of ['/admin/feedback', '/admin/analytics/summary', '/admin/flows', '/admin/drafts']) {
  r = await call('GET', p, { token: adminToken });
  check(`admin GET ${p} → 200`, r.status === 200, `status=${r.status} ${r.text.slice(0, 160)}`);
}
console.log('INFO  analytics:', JSON.stringify((await call('GET', '/admin/analytics/summary', { token: adminToken })).json).slice(0, 600));

const passed = results.filter((x) => x.ok).length;
console.log(`\nสรุป: ผ่าน ${passed}/${results.length} · ไม่ผ่าน ${results.length - passed}`);
