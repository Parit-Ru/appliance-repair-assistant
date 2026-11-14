// QA admin test — localhost + fixbot_qa_test เท่านั้น
import crypto from 'node:crypto';

const BASE = process.env.BASE ?? 'http://localhost:3999';
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('BASE ต้องเป็น localhost เท่านั้น');

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); if (!ok) console.log(`FAIL  ${name}  ${detail}`); };
async function call(method, path, { body, token, cid, form } = {}) {
  const h = {};
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (cid) h['X-Client-Id'] = cid;
  const res = await fetch(BASE + path, { method, headers: h, body: form ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}

const login = await call('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
const T = login.json.accessToken;

// ---------- flows ----------
let r = await call('GET', '/admin/flows?status=all&pageSize=50', { token: T });
check('list flows', r.status === 200 && r.json.items.length > 0, `status=${r.status}`);
const items = r.json.items;
const flowId = items.find((f) => f.flowId.endsWith('code_se')).flowId;
for (const q of ['page=0', 'pageSize=999', 'status=weird', 'deviceCategory=Toaster', 'q=' + 'x'.repeat(101)]) {
  r = await call('GET', `/admin/flows?${q}`, { token: T });
  check(`admin list ?${q.slice(0, 30)} → 400`, r.status === 400, `status=${r.status}`);
}
r = await call('GET', "/admin/flows?q=%25%27%22%5C_", { token: T });
check('admin list q มีอักขระพิเศษ → 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 100)}`);
r = await call('GET', '/admin/flows/no_such', { token: T });
check('GET flow ไม่มี → 404', r.status === 404, `status=${r.status}`);

r = await call('GET', `/admin/flows/${flowId}`, { token: T });
check('GET flow detail', r.status === 200, `status=${r.status}`);
const detail = r.json;
const rev0 = detail.revision;
const states = detail.states ?? detail.flow?.states ?? [];
const textState = states.find((s) => s.content || s.question || s.prompt);
const key = textState.question ? 'question' : textState.prompt ? 'prompt' : 'content';
const original = textState[key];

const put = (b) => call('PUT', `/admin/flows/${flowId}`, { token: T, body: b });
r = await put({});
check('PUT ไม่มี body ที่ครบ → 400', r.status === 400, `status=${r.status}`);
r = await put({ expectedRevision: rev0, states: [{ state_id: textState.state_id, [key]: '' }] });
check('PUT ข้อความว่าง → 400/422', r.status >= 400 && r.status < 500, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await put({ expectedRevision: rev0, states: [{ state_id: textState.state_id, [key]: 'x'.repeat(2001) }] });
check('PUT ข้อความ 2001 ตัว → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`);
r = await put({ expectedRevision: rev0, states: [{ state_id: 'ไม่มีจริง', content: 'x' }] });
check('PUT state_id ไม่มี → 4xx', r.status >= 400 && r.status < 500, `status=${r.status} ${r.text.slice(0, 160)}`);
// ข้ามคำเตือน safety: ลบ safety_warning ของ state ที่ safety_critical ต้องไม่ได้
const safe = states.find((s) => s.safety_critical);
if (safe) {
  r = await put({ expectedRevision: rev0, states: [{ state_id: safe.state_id, safety_warning: '' }] });
  check(`PUT ลบ safety_warning ของ ${safe.state_id} (safety_critical) ต้องไม่ผ่าน`, r.status >= 400 && r.status < 500, `status=${r.status} ${r.text.slice(0, 160)}`);
  r = await put({ expectedRevision: rev0, states: [{ state_id: safe.state_id, safety_warning: '   ' }] });
  check(`PUT safety_warning เป็นช่องว่าง ต้องไม่ผ่าน`, r.status >= 400 && r.status < 500, `status=${r.status} ${r.text.slice(0, 160)}`);
}
r = await put({ expectedRevision: rev0, states: [{ state_id: textState.state_id, [key]: `${original} (แก้โดย QA 😀 <b>)` }] });
check('PUT แก้ข้อความปกติ → 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await put({ expectedRevision: rev0, states: [{ state_id: textState.state_id, [key]: 'แอดมินอีกคนแก้พร้อมกัน' }] });
check('PUT revision เก่า (แก้พร้อมกัน) → 409', r.status === 409, `status=${r.status}`);

// ผู้ใช้ฝั่งแชตเห็นข้อความใหม่ทันทีหรือไม่ (flows ถูกโหลดค้างในหน่วยความจำ)
const cid = crypto.randomUUID();
r = await call('POST', '/execution/sessions', { body: { flowId }, cid });
const sid = r.json?.sessionId;
const shown = JSON.stringify(r.json?.state);
console.log(`INFO  เริ่ม session หลังแก้ผัง: state แรก=${r.json?.state?.stateId} ข้อความเปลี่ยนแล้ว=${shown.includes('แก้โดย QA')} (ถ้าแก้ state แรก)`);

// ลบ flow ที่มี session ค้าง
r = await call('GET', `/admin/flows/${flowId}`, { token: T });
console.log(`INFO  ก่อนลบ activeSessionCount=${r.json?.activeSessionCount ?? r.json?.flow?.activeSessionCount}`);
r = await call('DELETE', `/admin/flows/${flowId}`, { token: T });
check('DELETE flow ที่มี session ค้าง → 204 (soft delete)', r.status === 204, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await call('GET', '/execution/flows');
check('flow ที่ลบไม่โผล่ฝั่งผู้ใช้', !r.json.some((f) => f.flowId === flowId));
r = await call('POST', '/execution/sessions', { body: { flowId }, cid });
check('เริ่ม session ใหม่บน flow ที่ลบ → 404', r.status === 404, `status=${r.status}`);
r = await call('POST', `/execution/sessions/${sid}/actions`, { body: { type: 'continue' }, cid });
console.log(`INFO  ส่ง action เข้า session เดิมของ flow ที่ถูกลบ → ${r.status} ${r.text.slice(0, 140)}`);
r = await call('GET', `/history`, { cid });
console.log(`INFO  history หลังลบ flow → ${r.status} ${JSON.stringify(r.json?.items?.[0]?.flow)?.slice(0, 120)}`);
r = await call('DELETE', `/admin/flows/${flowId}`, { token: T });
check('DELETE ซ้ำ → 4xx (ไม่ใช่ 500)', r.status >= 400 && r.status < 500, `status=${r.status}`);
r = await call('POST', `/admin/flows/${flowId}/restore`, { token: T });
check('restore → 200', r.status === 200, `status=${r.status} ${r.text.slice(0, 160)}`);
r = await call('POST', `/admin/flows/${flowId}/restore`, { token: T });
check('restore ซ้ำ → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`);
r = await call('GET', '/execution/flows');
check('flow ที่กู้คืนกลับมาฝั่งผู้ใช้', r.json.some((f) => f.flowId === flowId));

// ---------- drafts ----------
const fields = { manualId: 'qa_manual', deviceCategory: 'Microwave', brand: 'QA', modelPattern: 'QA1', sourceManual: 'QA manual', pageFrom: '1', pageTo: '2' };
const mkForm = (buf, name = 'a.pdf', type = 'application/pdf', f = fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.append(k, v);
  if (buf) fd.append('file', new Blob([buf], { type }), name);
  return fd;
};
r = await call('POST', '/admin/drafts', { token: T, form: mkForm(null) });
check('upload ไม่มีไฟล์ → 400', r.status === 400, `status=${r.status} ${r.text.slice(0, 120)}`);
r = await call('POST', '/admin/drafts', { token: T, form: mkForm(Buffer.alloc(0)) });
check('upload ไฟล์ว่าง → 4xx', r.status >= 400 && r.status < 500, `status=${r.status} ${r.text.slice(0, 120)}`);
r = await call('POST', '/admin/drafts', { token: T, form: mkForm(Buffer.from('hello not a pdf'), 'a.txt', 'text/plain') });
console.log(`INFO  upload ไฟล์ข้อความธรรมดา → ${r.status} ${r.text.slice(0, 200)}`);
const badId = r.json?.id;
r = await call('POST', '/admin/drafts', { token: T, form: mkForm(Buffer.alloc(11 * 1024 * 1024, 1)) });
check('upload 11MB → 413', r.status === 413, `status=${r.status}`);
r = await call('POST', '/admin/drafts', { token: T, form: mkForm(Buffer.from('%PDF-1.4 x'), 'a.pdf', 'application/pdf', { ...fields, pageFrom: '5', pageTo: '2' }) });
check('upload pageFrom > pageTo → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/admin/drafts', { token: T, form: mkForm(Buffer.from('%PDF-1.4 x'), 'a.pdf', 'application/pdf', { ...fields, deviceCategory: 'Toaster' }) });
check('upload deviceCategory ผิด → 400', r.status === 400, `status=${r.status}`);
r = await call('POST', '/admin/drafts', { token: T, form: mkForm(Buffer.from('%PDF-1.4 x'), 'a.pdf', 'application/pdf', { ...fields, manualId: 'samsung_ge83mdt_um_de68_04111e' }) });
console.log(`INFO  upload manualId ซ้ำกับของจริง → ${r.status} ${r.text.slice(0, 200)}`);
await new Promise((res) => setTimeout(res, 1500));
r = await call('GET', '/admin/drafts', { token: T });
console.log(`INFO  drafts หลังอัปโหลดผิด ๆ: ${JSON.stringify((r.json?.items ?? r.json ?? []).map?.((d) => `${d.id}:${d.status}:${d.errorCode ?? ''}`))}`);
r = await call('GET', '/admin/drafts/999999', { token: T });
check('GET draft ไม่มี → 404', r.status === 404, `status=${r.status}`);
r = await call('GET', '/admin/drafts/abc', { token: T });
check('GET draft id ไม่ใช่เลข → 4xx', r.status >= 400 && r.status < 500, `status=${r.status}`);
r = await call('POST', '/admin/drafts/999999/publish', { token: T, body: {} });
check('publish draft ไม่มี → 404', r.status === 404, `status=${r.status}`);
if (badId) {
  r = await call('POST', `/admin/drafts/${badId}/publish`, { token: T, body: {} });
  check('publish draft ที่ failed → 409', r.status === 409, `status=${r.status} ${r.text.slice(0, 120)}`);
}
r = await call('GET', '/execution/flows');
check('ไม่มี flow ของ qa_manual โผล่ฝั่งผู้ใช้ (draft ยังไม่ publish)', !r.json.some((f) => f.manualId === 'qa_manual'));

console.log(`\nสรุป: ผ่าน ${results.filter(Boolean).length}/${results.length}`);
