// run-real-cases.ts — รันเคสจริงทีละเคสผ่าน service จริง (โหมด B) แล้วเขียน .json / .csv / seed-review.md / สรุป
//
// รัน:  cd backend && ./node_modules/.bin/ts-node-cwd --transpile-only ../eval/run-real-cases.ts [--ids MW01,RF11] [--limit 10] [--out-dir <dir>] [--overwrite]
//
// ไม่แก้ real-cases.json · ไม่แก้ cause_tags_seed · ไม่เรียก LLM · ไม่เขียน DB · ไม่ส่ง brand/model (ค้นเฉพาะ device — ดูเหตุผลใน README)

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { EVAL_DB_NAME, PER_MANUAL_CAP, TOP_N, createEvalEngine, deviceCategoryOf } from './lib/engine';
import { baselineRate, buildSeedReport, renderSeedReport, scoreCase, scoreCrossDevice, stateText, validateCases } from './lib/scoring';
import type { CaseScore, CauseSeed, CrossDeviceScore, PooledFlow, RealCase } from './lib/scoring';
import type { TroubleshootingFlow } from '../backend/src/state-machine/types';

const EVAL_DIR = __dirname;
const MANUALS_DIR = path.resolve(EVAL_DIR, '../data/manuals');
const REFUSED_COMPARE_LABEL = 'ปฏิเสธ-แนะนำช่าง';

// ---------- ชนิดผลลัพธ์ ----------

interface CaseRecord {
  id: string;
  device: string;
  device_category: string;
  brand_model: string;
  query_th: string;
  confirmed_fix_th: string;
  cause_tag: string;
  alt_cause_tags: string[];
  fix_category: string;
  confirmation: string;
  filter: { mode: 'device_only'; device_category: string; manuals: string[]; brand_model_sent: false };
  /** เวลาของ searchDevice (embed query + ค้นทุกคู่มือของอุปกรณ์) ไม่รวมเวลาให้คะแนน */
  latency_ms: number;
  best_score: number | null;
  threshold: number;
  refused: boolean;
  citation_present: boolean;
  baseline_rate: number;
  baseline_rate_primary_only: number;
  baseline_flows: { matched: number; total: number };
  /** รายคู่มือของอุปกรณ์นี้ — หน้าเว็บค้นในคู่มือเดียวที่ผู้ใช้เลือก (no_match = หน้าเว็บจะแสดงข้อความแนะนำศูนย์บริการ) */
  per_manual: Array<{ manual_id: string; best_score: number | null; match_count: number }>;
  manuals_with_match: { with_match: number; total: number };
  /** ค้นข้ามทุกอุปกรณ์ (ไม่ใช่พฤติกรรมของหน้าเว็บ) — ตรวจการชี้อุปกรณ์ */
  cross_device: CrossDeviceScore;
  answer: { text: string; references: string[]; top1_first_flow: FlowDump | null };
  metrics: Omit<CaseScore, 'top1Pool' | 'top3Pool'>;
  top1_pool: PooledFlow[];
  top3_pool: PooledFlow[];
  compare: string;
  note: string;
}

interface FlowDump {
  flow_id: string;
  manual_id: string;
  score: number;
  entry_symptom_th: string | null;
  entry_symptom: string;
  source: string;
  page_range: [number, number];
  states: Array<{ state_id: string; type: string; text: string; safety_critical: boolean; safety_warning: string | null }>;
}

interface Rates {
  n: number;
  refused: number;
  refusal_pct: number | null;
  scored: number;
  cause_hit_pct: number | null;
  /** ถ้านับ refused เป็นพลาด (ตัวหาร = ทุกเคส) */
  cause_hit_pct_refused_as_miss: number | null;
  top3_hit_pct: number | null;
  top1_first_only_hit_pct: number | null;
  has_safety_pct: number | null;
  has_safety_first_only_pct: number | null;
  top1_escalation_only_pct: number | null;
  /** (เพิ่มหลังรันรอบแรก) ตัวหาร = เคสที่ไม่ refused */
  has_escalation_path_pct: number | null;
  has_escalation_path_first_only_pct: number | null;
  /** ตัวหาร = เคสที่การค้นข้ามอุปกรณ์ได้ผัง >= เกณฑ์ (cross_device_refused แยกรายงาน) */
  cross_device_refused: number;
  cross_device_top1_correct_pct: number | null;
  cross_device_top1_correct_pct_refused_as_miss: number | null;
  cross_device_first_only_correct_pct: number | null;
  cross_device_all_correct_pct: number | null;
  /** เฉลี่ยทุกเคส: สัดส่วนคู่มือของอุปกรณ์ที่ไม่มีผัง >= เกณฑ์ = โอกาสที่หน้าเว็บจะขึ้น "ไม่พบอาการ" ถ้าผู้ใช้เลือกคู่มือแบบสุ่ม */
  manual_no_match_mean_pct: number | null;
  citation_presence_pct_all: number | null;
  citation_presence_pct_scored: number | null;
  baseline_mean_pct: number | null;
  /** cause_hit_pct - baseline_mean_pct (จุดเปอร์เซ็นต์) บนเคสที่ไม่ refused ชุดเดียวกัน */
  lift_pp: number | null;
  tie_cases: number;
}

// ---------- ตัวช่วย ----------

const round1 = (x: number) => Math.round(x * 10) / 10;
const pct = (num: number, den: number): number | null => (den === 0 ? null : round1((num / den) * 100));
const fmt = (x: number | null) => (x === null ? '-' : x.toFixed(1));
const pageText = ([a, b]: [number, number]) => (a === b ? `หน้า ${a}` : `หน้า ${a}–${b}`);
const refText = (p: { source: string; pageRange: [number, number] }) => `${p.source} ${pageText(p.pageRange)}`;
const sha256 = (data: string | Buffer) => crypto.createHash('sha256').update(data).digest('hex');

function parseArgs(argv: string[]) {
  const get = (name: string) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    ids: get('--ids')?.split(',').map((s) => s.trim()).filter(Boolean),
    limit: get('--limit') !== undefined ? Number(get('--limit')) : undefined,
    outDir: path.resolve(get('--out-dir') ?? path.join(EVAL_DIR, 'results')),
    overwrite: argv.includes('--overwrite'),
  };
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8').replace(/^﻿/, '')) as T;
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

/** ชื่อไฟล์ผลลัพธ์: real-cases-YYYYMMDD.* · ถ้ามีอยู่แล้วและไม่ได้สั่ง --overwrite ต่อท้าย -HHMMSS (ไม่ทับผลรอบก่อน) */
function outputBase(dir: string, date: Date, overwrite: boolean): string {
  const base = `real-cases-${stamp(date)}`;
  const taken = ['.json', '.csv'].some((ext) => fs.existsSync(path.join(dir, base + ext)));
  if (!taken || overwrite) return base;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

const TYPE_LABEL: Record<string, string> = {
  checkpoint: 'คำถาม',
  instruction: 'ขั้นตอน',
  input: 'กรอก',
  resolution: 'จบ-แก้ได้/ปกติ',
  escalation: 'จบ-ส่งต่อ',
};

function dumpFlow(flow: TroubleshootingFlow, pooled: PooledFlow): FlowDump {
  return {
    flow_id: flow.flow_id,
    manual_id: flow.manual_id,
    score: pooled.score,
    entry_symptom_th: flow.entry_symptom_th ?? null,
    entry_symptom: flow.entry_symptom,
    source: flow.source,
    page_range: flow.page_range,
    states: flow.states.map((s) => ({
      state_id: s.state_id,
      type: s.type,
      text: stateText(s),
      safety_critical: s.safety_critical === true,
      safety_warning: s.safety_warning ?? null,
    })),
  };
}

/** service ปัด score เป็น 3 ตำแหน่ง ถ้า refused แต่ค่าที่เห็นเท่ากับเกณฑ์ แปลว่าค่าจริงต่ำกว่าเกณฑ์เล็กน้อย (บอกไว้กันสับสน) */
function roundedAtThreshold(score: CaseScore): string {
  return score.bestScore !== null && score.bestScore >= score.threshold ? ' · ค่าจริงต่ำกว่าเกณฑ์เล็กน้อย ที่เห็นเป็นค่าปัดเศษ' : '';
}

/** "ระบบตอบว่า": อาการที่จับคู่ + เนื้อหาทั้งผังของผังอันดับแรก (ไม่ตัดข้อความ) เพื่อให้คนให้คะแนนมือเห็นสิ่งที่ผู้ใช้จะได้รับ */
function answerText(dump: FlowDump | null, score: CaseScore): string {
  if (dump === null) {
    return `ไม่พบผังที่ตรงพอ (similarity สูงสุด ${score.bestScore ?? '-'} < เกณฑ์ ${score.threshold}${roundedAtThreshold(score)})`;
  }
  const outline = dump.states
    .map((s) => `[${TYPE_LABEL[s.type] ?? s.type}] ${s.text}${s.safety_warning ? ` ⚠ ${s.safety_warning}` : ''}`)
    .join(' ▸ ');
  return `อาการที่จับคู่: ${dump.entry_symptom_th ?? dump.entry_symptom} (score ${dump.score}) ▸ ${outline}`;
}

function noteText(c: RealCase, score: CaseScore, categoryManuals: number, manualsWithMatch: number): string {
  const parts = [`ค้นเฉพาะอุปกรณ์ ${deviceCategoryOf(c.device)} (${categoryManuals} คู่มือ) ไม่ส่งยี่ห้อ/รุ่น · คู่มือที่มีผัง >= เกณฑ์ ${manualsWithMatch}/${categoryManuals}`];
  if (score.refused) {
    parts.push(`best score ${score.bestScore ?? '-'} < ${score.threshold}${roundedAtThreshold(score)} ไม่คำนวณ cause_hit`);
    return parts.join(' ; ');
  }
  if ((score.top1_tie_count ?? 0) > 1) {
    parts.push(`top-1 เสมอกัน ${score.top1_tie_count}${score.tie_count_is_lower_bound ? '+' : ''} ผัง (cause_hit นับทั้งกลุ่ม · เฉพาะผังแรก=${score.top1_first_only_hit ? 'hit' : 'ไม่ hit'})`);
  }
  const hits = score.top1Pool.filter((p) => p.match.hit);
  if (hits.length > 0) {
    const shown = hits.slice(0, 5).map((p) => `${p.flowId}: ${p.match.allEvidence.map((e) => `${e.tag}/"${e.term}"@${e.stateId}(${e.stateType})`).join(', ')}`);
    parts.push(`hit ใน ${shown.join(' | ')}${hits.length > 5 ? ` (+${hits.length - 5} ผัง)` : ''}`);
    if (score.cause_hit_via === 'alt_cause_tag') parts.push('hit แรกมาจาก alt_cause_tag');
  } else if (score.top3_hit) {
    parts.push('ไม่ hit ที่ top-1 แต่ hit ใน top-3');
  }
  if (score.tie_count_is_lower_bound) parts.push(`จำนวนผังเสมออาจมากกว่าที่นับ (service คืนไม่เกิน ${PER_MANUAL_CAP} ผัง/คู่มือ)`);
  return parts.join(' ; ');
}

// ---------- สรุป ----------

function summarize(records: CaseRecord[]): Rates {
  const scored = records.filter((r) => !r.metrics.refused);
  const count = (pick: (m: CaseRecord['metrics']) => boolean | null) => scored.filter((r) => pick(r.metrics) === true).length;
  const causeHit = count((m) => m.cause_hit);
  const baselineMean = scored.length === 0 ? null : (scored.reduce((s, r) => s + r.baseline_rate, 0) / scored.length) * 100;
  const hitPct = pct(causeHit, scored.length);
  const crossScored = records.filter((r) => !r.cross_device.refused);
  const crossCount = (pick: (x: CrossDeviceScore) => boolean | null) => crossScored.filter((r) => pick(r.cross_device) === true).length;
  const manualNoMatch = records.length === 0 ? null : (records.reduce((s, r) => s + (1 - r.manuals_with_match.with_match / r.manuals_with_match.total), 0) / records.length) * 100;

  return {
    n: records.length,
    refused: records.length - scored.length,
    refusal_pct: pct(records.length - scored.length, records.length),
    scored: scored.length,
    cause_hit_pct: hitPct,
    cause_hit_pct_refused_as_miss: pct(causeHit, records.length),
    top3_hit_pct: pct(count((m) => m.top3_hit), scored.length),
    top1_first_only_hit_pct: pct(count((m) => m.top1_first_only_hit), scored.length),
    has_safety_pct: pct(count((m) => m.has_safety), scored.length),
    has_safety_first_only_pct: pct(count((m) => m.has_safety_first_only), scored.length),
    top1_escalation_only_pct: pct(count((m) => m.top1_escalation_only), scored.length),
    has_escalation_path_pct: pct(count((m) => m.has_escalation_path), scored.length),
    has_escalation_path_first_only_pct: pct(count((m) => m.has_escalation_path_first_only), scored.length),
    cross_device_refused: records.length - crossScored.length,
    cross_device_top1_correct_pct: pct(crossCount((x) => x.top1_correct), crossScored.length),
    cross_device_top1_correct_pct_refused_as_miss: pct(crossCount((x) => x.top1_correct), records.length),
    cross_device_first_only_correct_pct: pct(crossCount((x) => x.top1_first_only_correct), crossScored.length),
    cross_device_all_correct_pct: pct(crossCount((x) => x.top1_all_correct), crossScored.length),
    manual_no_match_mean_pct: manualNoMatch === null ? null : round1(manualNoMatch),
    citation_presence_pct_all: pct(records.filter((r) => r.citation_present).length, records.length),
    citation_presence_pct_scored: pct(scored.filter((r) => r.citation_present).length, scored.length),
    baseline_mean_pct: baselineMean === null ? null : round1(baselineMean),
    lift_pp: hitPct === null || baselineMean === null ? null : round1(hitPct - baselineMean),
    tie_cases: scored.filter((r) => (r.metrics.top1_tie_count ?? 0) > 1).length,
  };
}

function groupBy(records: CaseRecord[], key: (r: CaseRecord) => string): Record<string, Rates> {
  const keys = [...new Set(records.map(key))].sort();
  return Object.fromEntries(keys.map((k) => [k, summarize(records.filter((r) => key(r) === k))]));
}

function latencyStats(records: CaseRecord[]) {
  const xs = records.map((r) => r.latency_ms).sort((a, b) => a - b);
  const at = (q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))];
  return { n: xs.length, mean_ms: Math.round(xs.reduce((s, x) => s + x, 0) / xs.length), p50_ms: at(0.5), p95_ms: at(0.95), max_ms: xs[xs.length - 1] };
}

function printSummary(overall: Rates, byDevice: Record<string, Rates>, byFix: Record<string, Rates>, lat: ReturnType<typeof latencyStats>) {
  const head = ['กลุ่ม', 'เคส', 'refused%', 'cause_hit%', '(refused=พลาด)', 'top3%', 'first_only%', 'safety%', 'safety_1st%', 'esc_only%', 'cite%(ทั้งหมด)', 'เสมอ'];
  const row = (name: string, r: Rates) => [name, `${r.n}`, fmt(r.refusal_pct), fmt(r.cause_hit_pct), fmt(r.cause_hit_pct_refused_as_miss), fmt(r.top3_hit_pct), fmt(r.top1_first_only_hit_pct), fmt(r.has_safety_pct), fmt(r.has_safety_first_only_pct), fmt(r.top1_escalation_only_pct), fmt(r.citation_presence_pct_all), `${r.tie_cases}`];
  const table = (rows: string[][]) => rows.map((r) => r.join(' | ')).join('\n');

  console.log('\n===== สรุปผล (ตัวหารของ hit/top3/safety/esc_only = เคสที่ไม่ refused) =====');
  console.log(head.join(' | '));
  console.log(table([row('ทั้งหมด', overall)]));
  console.log('\n-- แยกตาม device --');
  console.log(table(Object.entries(byDevice).map(([k, v]) => row(k, v))));
  console.log('\n-- แยกตาม fix_category --');
  console.log(table(Object.entries(byFix).map(([k, v]) => row(k, v))));

  // ตัวชี้วัดที่เพิ่มหลังรันรอบแรก: has_escalation_path (ตัวหาร = ไม่ refused) · cross_device (ตัวหาร = เคสที่ค้นข้ามอุปกรณ์ได้ผัง >= เกณฑ์)
  console.log('\n-- เพิ่มหลังรันรอบแรก: เส้นทางไปศูนย์บริการ / ค้นข้ามอุปกรณ์ / ผลรายคู่มือ --');
  const head2 = ['กลุ่ม', 'esc_path%', 'esc_path_1st%', 'esc_only%', 'xdev_refused(เคส)', 'xdev_top1%', '(refused=พลาด)', 'xdev_1st%', 'xdev_ทุกผัง%', 'คู่มือไม่มีผล%(เฉลี่ย)'];
  const row2 = (name: string, r: Rates) => [name, fmt(r.has_escalation_path_pct), fmt(r.has_escalation_path_first_only_pct), fmt(r.top1_escalation_only_pct), `${r.cross_device_refused}`, fmt(r.cross_device_top1_correct_pct), fmt(r.cross_device_top1_correct_pct_refused_as_miss), fmt(r.cross_device_first_only_correct_pct), fmt(r.cross_device_all_correct_pct), fmt(r.manual_no_match_mean_pct)];
  console.log(head2.join(' | '));
  console.log(table([row2('ทั้งหมด', overall)]));
  console.log('-- แยกตาม device --');
  console.log(table(Object.entries(byDevice).map(([k, v]) => row2(k, v))));
  console.log('-- แยกตาม fix_category --');
  console.log(table(Object.entries(byFix).map(([k, v]) => row2(k, v))));

  console.log('\n-- top1_hit เทียบ baseline_rate (เฉลี่ยบนเคสที่ไม่ refused) --');
  console.log(['device', 'เคส(scored)', 'cause_hit%', 'baseline%', 'lift(pp)'].join(' | '));
  for (const [k, v] of [['ทั้งหมด', overall] as const, ...Object.entries(byDevice)]) {
    console.log([k, `${v.scored}`, fmt(v.cause_hit_pct), fmt(v.baseline_mean_pct), v.lift_pp === null ? '-' : (v.lift_pp >= 0 ? '+' : '') + v.lift_pp.toFixed(1)].join(' | '));
  }
  console.log(`\nlatency ต่อเคส: mean ${lat.mean_ms} ms · p50 ${lat.p50_ms} · p95 ${lat.p95_ms} · max ${lat.max_ms} (เคสแรกรวมช่วงอุ่นเครื่อง)`);
}

// ---------- CSV ----------

const CSV_COLUMNS: Array<[string, (r: CaseRecord) => string | number | boolean | null]> = [
  // A–I ตามแท็บ "เคสจริง"/"ตารางเทียบ" · J = ผลเทียบ
  ['id', (r) => r.id],
  ['device', (r) => r.device],
  ['query', (r) => r.query_th],
  ['ระบบตอบว่า', (r) => r.answer.text],
  ['ระบบอ้างอิง', (r) => r.answer.references.join(' ; ')],
  ['cause_hit', (r) => r.metrics.cause_hit],
  ['refused', (r) => r.refused],
  ['has_safety', (r) => r.metrics.has_safety],
  ['หมายเหตุ', (r) => r.note],
  ['ผลเทียบ', (r) => r.compare],
  // เพิ่มเติม (ไม่ต้องก๊อปไปแท็บ)
  ['top3_hit', (r) => r.metrics.top3_hit],
  ['top1_first_only_hit', (r) => r.metrics.top1_first_only_hit],
  ['top1_tie_count', (r) => r.metrics.top1_tie_count],
  ['top1_escalation_only', (r) => r.metrics.top1_escalation_only],
  ['has_safety_first_only', (r) => r.metrics.has_safety_first_only],
  // เพิ่มหลังรันรอบแรก
  ['has_escalation_path', (r) => r.metrics.has_escalation_path],
  ['has_escalation_path_first_only', (r) => r.metrics.has_escalation_path_first_only],
  ['cross_device_top1_correct', (r) => r.cross_device.top1_correct],
  ['cross_device_top1_first_only_correct', (r) => r.cross_device.top1_first_only_correct],
  ['cross_device_top1_devices', (r) => r.cross_device.top1_devices.join(';')],
  ['manuals_with_match', (r) => `${r.manuals_with_match.with_match}/${r.manuals_with_match.total}`],
  ['best_score', (r) => r.best_score],
  ['baseline_rate', (r) => round1(r.baseline_rate * 100) / 100],
  ['baseline_rate_primary_only', (r) => round1(r.baseline_rate_primary_only * 100) / 100],
  ['latency_ms', (r) => r.latency_ms],
  ['cause_tag', (r) => r.cause_tag],
  ['alt_cause_tags', (r) => r.alt_cause_tags.join(';')],
  ['fix_category', (r) => r.fix_category],
  ['confirmation', (r) => r.confirmation],
  ['brand_model', (r) => r.brand_model],
  ['confirmed_fix_th', (r) => r.confirmed_fix_th],
];

function csvCell(value: string | number | boolean | null, keepNewlines = false): string {
  if (value === null) return '';
  const raw = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
  const text = keepNewlines ? raw.replace(/\r\n/g, '\n') : raw.replace(/\r?\n/g, ' ');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// ---------- ไฟล์สุ่มให้กรอกคอลัมน์ J ด้วยมือ ----------

/** seed คงที่ + โควตาต่ออุปกรณ์ · เลือกจากเลข id เท่านั้น (ไม่ดู cause_hit) · ประชากร = เคสที่ไม่ refused (เคส refused ไม่มีผังให้ตัดสิน และเติม J อัตโนมัติแล้ว) */
const REVIEW_SAMPLE_SEED = 499;
const REVIEW_SAMPLE_QUOTA: Array<[string, number]> = [['ตู้เย็น', 10], ['เครื่องซักผ้า', 10], ['ไมโครเวฟ', 10]];
const REVIEW_CELL_LIMIT = 32000; // Excel จำกัด 32,767 ตัวอักษรต่อเซลล์

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickReviewSample(records: CaseRecord[]): { ids: Record<string, string[]>; population: Record<string, number> } {
  const ids: Record<string, string[]> = {};
  const population: Record<string, number> = {};
  for (const [i, [device, quota]] of REVIEW_SAMPLE_QUOTA.entries()) {
    const pool = records.filter((r) => r.device === device && !r.refused).map((r) => r.id).sort();
    population[device] = pool.length;
    const random = mulberry32(REVIEW_SAMPLE_SEED + i);
    for (let k = pool.length - 1; k > 0; k--) {
      const j = Math.floor(random() * (k + 1));
      [pool[k], pool[j]] = [pool[j], pool[k]];
    }
    ids[device] = pool.slice(0, quota).sort();
  }
  return { ids, population };
}

/** ผังเป็นบรรทัดอ่านง่าย: เลข state · ชนิด · ข้อความ · ทางแยก (ใช่/ไม่/ถัดไป) · ⚠ คำเตือน */
function readableSteps(flow: TroubleshootingFlow): string {
  const lines: string[] = [];
  for (const s of flow.states) {
    const start = s.state_id === flow.initial_state ? ' (เริ่ม)' : '';
    let next = '';
    if (s.type === 'checkpoint') next = ` → ใช่: ${s.on_yes} / ไม่: ${s.on_no}`;
    else if (s.type === 'instruction') next = ` → ถัดไป: ${s.next}`;
    else if (s.type === 'input') next = ` → ถัดไป: ${s.next}`;
    lines.push(`${s.state_id}${start} [${TYPE_LABEL[s.type] ?? s.type}] ${stateText(s)}${next}`);
    if (s.safety_warning) lines.push(`   ⚠ ${s.safety_warning}`);
  }
  return lines.join('\n');
}

const REVIEW_COLUMNS = ['id', 'device', 'fix_category', 'อาการที่ผู้ใช้พิมพ์', 'วิธีแก้ที่ยืนยันแล้ว', 'ผังอันดับ 1 (flow_id)', 'อาการที่ผังจับคู่', 'score', 'ระบบอ้างอิง', 'ผังอื่นที่ score เท่ากัน', 'ขั้นตอนของผัง', 'ผลเทียบ (กรอก: ตรง / ตรงบางส่วน / ไม่ตรง)', 'เหตุผลที่ตัดสิน'];

function toReviewCsv(rows: Array<Array<string | number>>): string {
  const lines = [REVIEW_COLUMNS.map((h) => csvCell(h)).join(',')];
  for (const r of rows) lines.push(r.map((v) => csvCell(v, true)).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function toCsv(records: CaseRecord[]): string {
  const lines = [CSV_COLUMNS.map(([h]) => csvCell(h)).join(',')];
  for (const r of records) lines.push(CSV_COLUMNS.map(([, f]) => csvCell(f(r))).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n'; // BOM ให้ Excel อ่านภาษาไทยถูก
}

// ---------- main ----------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date();

  const casesFile = path.join(EVAL_DIR, 'real-cases.json');
  const casesRaw = fs.readFileSync(casesFile);
  const data = readJson<{ meta: { cause_tags_seed: CauseSeed }; cases: RealCase[] }>(casesFile);
  const seed = data.meta.cause_tags_seed;

  const problems = validateCases(data.cases, seed);
  if (problems.length > 0) throw new Error(`real-cases.json มีปัญหา:\n  ${problems.join('\n  ')}`);

  let cases = data.cases;
  if (args.ids) {
    const missing = args.ids.filter((id) => !cases.some((c) => c.id === id));
    if (missing.length > 0) throw new Error(`ไม่พบ id: ${missing.join(', ')}`);
    cases = cases.filter((c) => args.ids!.includes(c.id));
  }
  if (args.limit !== undefined) cases = cases.slice(0, args.limit);
  const partial = cases.length !== data.cases.length;

  console.log(`เคสที่จะรัน ${cases.length}/${data.cases.length} · DB ${EVAL_DB_NAME} · กำลังโหลดดัชนีค้นหา ...`);
  const t0 = Date.now();
  const engine = await createEvalEngine();
  const indexReadyMs = Date.now() - t0;
  console.log(`พร้อมใน ${indexReadyMs} ms (${engine.manuals.length} คู่มือ · ${engine.flowCount} ผัง)`);

  const records: CaseRecord[] = [];
  const scoreById = new Map<string, CaseScore>();
  const deviceFlowsCache = new Map<string, TroubleshootingFlow[]>();
  const flowsOf = (c: RealCase) => {
    const category = deviceCategoryOf(c.device);
    let flows = deviceFlowsCache.get(category);
    if (flows === undefined) {
      flows = engine.flowsOfDevice(category);
      deviceFlowsCache.set(category, flows);
    }
    return flows;
  };

  for (const [i, c] of cases.entries()) {
    const category = deviceCategoryOf(c.device);
    const started = Date.now();
    const search = await engine.searchDevice(c.query_th, category);
    const latency = Date.now() - started;
    const cross = scoreCrossDevice(category, await engine.searchAllDevices(c.query_th), TOP_N);

    const score = scoreCase(c, search, (id) => engine.getFlow(id), seed, PER_MANUAL_CAP);
    scoreById.set(c.id, score);
    const baseline = baselineRate(c, flowsOf(c), seed);

    const first = score.top1Pool[0];
    const firstFlow = first ? engine.getFlow(first.flowId) : undefined;
    const dump = first && firstFlow ? dumpFlow(firstFlow, first) : null;
    const references = [...new Set(score.top1Pool.map(refText))];
    const shownRefs = references.length > 3 ? [...references.slice(0, 3), `(+${references.length - 3} อ้างอิงอื่นของผังที่คะแนนเท่ากัน)`] : references;
    const { top1Pool, top3Pool, ...metrics } = score;

    records.push({
      id: c.id,
      device: c.device,
      device_category: category,
      brand_model: c.brand_model,
      query_th: c.query_th,
      confirmed_fix_th: c.confirmed_fix_th,
      cause_tag: c.cause_tag,
      alt_cause_tags: c.alt_cause_tags ?? [],
      fix_category: c.fix_category,
      confirmation: c.confirmation,
      filter: { mode: 'device_only', device_category: category, manuals: search.manualsSearched, brand_model_sent: false },
      latency_ms: latency,
      best_score: search.bestScore,
      threshold: search.threshold,
      refused: score.refused,
      citation_present: !score.refused && top1Pool.every((p) => p.source.trim() !== '' && Number.isFinite(p.pageRange[0]) && Number.isFinite(p.pageRange[1])),
      baseline_rate: baseline.all.rate,
      baseline_rate_primary_only: baseline.primaryOnly.rate,
      baseline_flows: { matched: baseline.all.matched, total: baseline.all.total },
      per_manual: search.perManual.map((m) => ({ manual_id: m.manualId, best_score: m.bestScore, match_count: m.matchCount })),
      manuals_with_match: { with_match: search.perManual.filter((m) => m.matchCount > 0).length, total: search.perManual.length },
      cross_device: cross,
      answer: { text: answerText(dump, score), references: shownRefs, top1_first_flow: dump },
      metrics,
      top1_pool: top1Pool,
      top3_pool: top3Pool,
      compare: score.refused ? REFUSED_COMPARE_LABEL : '',
      note: noteText(c, score, search.manualsSearched.length, search.perManual.filter((m) => m.matchCount > 0).length),
    });

    if ((i + 1) % 10 === 0 || i + 1 === cases.length) console.log(`  ${i + 1}/${cases.length}`);
  }

  // ----- สรุป -----
  const overall = summarize(records);
  const byDevice = groupBy(records, (r) => r.device);
  const byFix = groupBy(records, (r) => r.fix_category);
  const lat = latencyStats(records);
  printSummary(overall, byDevice, byFix, lat);

  // ----- manifest ข้อมูลที่ใช้ (ให้ย้อนตรวจได้ว่ารันกับข้อมูลชุดไหน) -----
  const inDb = new Set(engine.manuals.map((m) => m.manualId));
  const manualFiles = fs.readdirSync(MANUALS_DIR).filter((f) => f.endsWith('.json')).sort().map((file) => {
    const full = path.join(MANUALS_DIR, file);
    const buf = fs.readFileSync(full);
    const m = JSON.parse(buf.toString('utf-8').replace(/^﻿/, '')) as { manual_id: string; device_category: string; flows: unknown[] };
    return { file, manual_id: m.manual_id, device_category: m.device_category, flows: m.flows.length, bytes: buf.length, mtime: fs.statSync(full).mtime.toISOString(), sha256_12: sha256(buf).slice(0, 12), in_db: inDb.has(m.manual_id) };
  });

  const finishedAt = new Date();
  const output = {
    meta: {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      node: process.version,
      args: process.argv.slice(2),
      partial_run: partial,
      mode: 'B (import service โดยตรง ไม่ผ่าน HTTP)',
      db: { name: engine.dbName, manuals: engine.manuals.length, flows: engine.flowCount },
      embedding_model: engine.embeddingModel,
      threshold: records[0]?.threshold ?? null,
      top_n: TOP_N,
      per_manual_cap: PER_MANUAL_CAP,
      index_ready_ms: indexReadyMs,
      input: { real_cases_sha256_12: sha256(casesRaw).slice(0, 12), cause_tags_seed_sha256_12: sha256(JSON.stringify(seed)).slice(0, 12), cases_in_file: data.cases.length, cases_run: cases.length },
      manuals_in_db: engine.manuals,
      manual_files: manualFiles,
      definitions: {
        cause_text: 'ข้อความของ state ทุกตัวในผัง (คำถาม/ขั้นตอน/กรอก/resolution/escalation) ไม่นับ entry_symptom/aliases/safety_warning',
        hit: 'เจอคำใดก็ได้ใน cause_tags_seed ของ cause_tag หรือ alt_cause_tags (th/en)',
        top1_hit_and_cause_hit: 'มีผังในกลุ่มที่ score เท่า top-1 ที่ hit อย่างน้อย 1 ผัง',
        top1_first_only_hit: 'เฉพาะผังที่ระบบเรียงเป็นอันดับแรก (ไม่นับกลุ่มเสมอ)',
        top3_hit: 'มีผังที่ score >= อันดับ 3 (รวมกลุ่มเสมอที่ขอบ) ที่ hit',
        refused: 'ไม่มีผังของอุปกรณ์นั้นได้ similarity >= threshold · ไม่คำนวณ hit/safety/escalation_only (null)',
        has_safety: 'มีผังในกลุ่ม top-1 ที่มี state safety_critical หรือ safety_warning',
        has_safety_first_only: 'เฉพาะผังที่ระบบเรียงเป็นอันดับแรก',
        has_escalation_path: '(เพิ่มหลังรันรอบแรก) มีผังในกลุ่ม top-1 ที่มี state ประเภท escalation เดินถึงได้จาก initial_state อย่างน้อย 1 เส้นทาง (ไม่ได้แปลว่าผู้ใช้ทุกคนจะผ่าน) · _first_only = เฉพาะผังที่เรียงเป็นอันดับแรก',
        cross_device_top1_correct: '(เพิ่มหลังรันรอบแรก) ค้นโดยไม่ระบุอุปกรณ์/คู่มือ แล้วกลุ่ม top-1 (score เท่ากัน) มีผังของอุปกรณ์เดียวกับเคสอย่างน้อย 1 ผัง · _first_only = เฉพาะผังแรก · ตัวหาร = เคสที่ค้นข้ามอุปกรณ์ได้ผัง >= เกณฑ์ · หน้าเว็บไม่ได้ค้นแบบนี้',
        manuals_with_match: 'จำนวนคู่มือของอุปกรณ์ที่มีผัง >= เกณฑ์ ต่อจำนวนคู่มือของอุปกรณ์ · คู่มือที่ไม่มีผล = หน้าเว็บจะขึ้น "ไม่พบอาการ" ถ้าผู้ใช้เลือกคู่มือนั้น',
        top1_escalation_only: 'ทุกผังในกลุ่ม top-1 ไม่มี resolution ที่เดินถึงได้จาก initial_state',
        baseline_rate: 'สัดส่วนผังทั้งหมดของอุปกรณ์เดียวกันที่ข้อความมีคำของ cause_tag + alt_cause_tags (กฎเดียวกับ hit) · baseline_rate_primary_only = เฉพาะ cause_tag',
        citation_present: 'ไม่ refused และทุกผังในกลุ่ม top-1 มี source และ page_range ที่เป็นตัวเลข (ค่าจากฐานข้อมูลตามจริง ไม่เดา)',
        compare_column: `ผลเทียบ = "${REFUSED_COMPARE_LABEL}" เมื่อ refused ที่เหลือเว้นว่าง`,
        latency_ms: 'เวลา searchDevice ต่อเคส (embed + ค้นทุกคู่มือของอุปกรณ์) ไม่รวมการให้คะแนน',
      },
      caveats: [
        'แก้ข้อความรอบแรก: หน้าเว็บจริงบังคับเลือกอุปกรณ์แล้วเลือกรุ่น (คู่มือ) ก่อนค้น และส่ง manualId เสมอ (SymptomsPage.tsx) จึงค้นในคู่มือเดียว ไม่ได้ค้นข้ามอุปกรณ์ · eval รวมทุกคู่มือของอุปกรณ์ → refused ของ eval หลวมกว่าหน้าเว็บ (ใช้ manuals_with_match / manual_no_match_mean_pct ดูผลรายคู่มือ) · เมื่อ matches ว่างหน้าเว็บแสดงข้อความแนะนำศูนย์บริการ (SymptomSearchResults.tsx)',
        'cross_device_* ค้นโดยไม่ระบุคู่มือ เพื่อตรวจว่าระบบชี้อุปกรณ์ถูกไหมเมื่อไม่รู้อุปกรณ์ — ไม่ใช่เส้นทางที่ผู้ใช้เจอจริง',
        'has_escalation_path และ cross_device_* เพิ่มหลังเห็นผลรอบแรก (พฤติกรรม "แนะนำศูนย์บริการ" มาจาก fix_category ของชุดข้อมูลตั้งแต่ต้น แต่ยังไม่มีคอลัมน์วัด) · รายงานตัวเลขไม่ว่าผลเป็นอย่างไร',
        'score ที่ service ส่งออกปัด 3 ตำแหน่ง ผังที่เสมอกันเรียงด้วย flowId จึงนับ top-1 เป็นกลุ่ม',
        'คู่มือที่ยี่ห้อ/รุ่นตรงกับเคสมีน้อย (คู่มือที่ ingest เป็น Samsung ทั้งหมด) จึงไม่กรองด้วยยี่ห้อ/รุ่น',
        'cause_hit วัดว่าผังพูดถึงชิ้นส่วน/สาเหตุตามคำใน seed ไม่ได้วัดว่าระบบ "ฟันธง" สาเหตุ หรือลำดับขั้นตอนถูกต้อง',
        'ไม่ปรับ cause_tags_seed ระหว่างหรือหลังรัน · seed-review เป็นข้อเสนอให้ผู้ใช้ตรวจ ไม่ถูกใช้คำนวณ',
      ],
    },
    summary: { overall, by_device: byDevice, by_fix_category: byFix, latency: lat },
    cases: records,
  };

  // ----- ไฟล์สุ่มให้กรอกคอลัมน์ J ด้วยมือ -----
  const sample = pickReviewSample(records);
  const reviewRows: Array<Array<string | number>> = [];
  for (const [device, quota] of REVIEW_SAMPLE_QUOTA) {
    if (sample.ids[device].length < quota) console.warn(`คำเตือน: ${device} สุ่มได้ ${sample.ids[device].length}/${quota} เคส (ประชากรที่ไม่ refused ${sample.population[device]})`);
    for (const id of sample.ids[device]) {
      const r = records.find((x) => x.id === id) as CaseRecord;
      const first = scoreById.get(id)?.top1Pool[0];
      const flow = first ? engine.getFlow(first.flowId) : undefined;
      if (!first || !flow) throw new Error(`${id}: ไม่มีผังอันดับ 1 สำหรับไฟล์สุ่ม`);
      const ties = (scoreById.get(id)?.top1Pool ?? []).slice(1).map((p) => `${p.flowId} (${p.entrySymptomTh ?? p.entrySymptom})`);
      let steps = readableSteps(flow);
      if (steps.length > REVIEW_CELL_LIMIT) {
        console.warn(`คำเตือน: ${id} ขั้นตอนยาว ${steps.length} ตัวอักษร เกินที่ Excel รับต่อเซลล์ ตัดท้ายและระบุไว้`);
        steps = steps.slice(0, REVIEW_CELL_LIMIT) + '\n[ตัดท้าย — ดูฉบับเต็มใน real-cases-*.json]';
      }
      reviewRows.push([r.id, r.device, r.fix_category, r.query_th, r.confirmed_fix_th, first.flowId, first.entrySymptomTh ?? first.entrySymptom, first.score, refText(first), ties.join(' ; '), steps, '', '']);
    }
  }

  fs.mkdirSync(args.outDir, { recursive: true });
  const base = outputBase(args.outDir, finishedAt, args.overwrite);
  const jsonPath = path.join(args.outDir, `${base}.json`);
  const csvPath = path.join(args.outDir, `${base}.csv`);
  const seedPath = path.join(args.outDir, base.replace('real-cases-', 'seed-review-') + '.md');
  const reviewPath = path.join(args.outDir, base.replace('real-cases-', 'review-sample-') + '.csv');

  (output.meta as Record<string, unknown>).review_sample = {
    seed: REVIEW_SAMPLE_SEED,
    method: 'สับ id (เรียงตัวอักษร) ของเคสที่ไม่ refused ต่ออุปกรณ์ด้วย mulberry32(seed + ลำดับอุปกรณ์) แล้วเอาตามโควตา · เลือกจาก id เท่านั้น ไม่ดูผล cause_hit · ไฟล์ไม่แสดง cause_hit/คำที่เจอ เพื่อให้ตัดสินแบบไม่รู้ผลอัตโนมัติ',
    quota: Object.fromEntries(REVIEW_SAMPLE_QUOTA),
    population_not_refused: sample.population,
    ids: sample.ids,
  };

  fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2) + '\n', 'utf-8');
  fs.writeFileSync(csvPath, toCsv(records), 'utf-8');
  fs.writeFileSync(seedPath, renderSeedReport(buildSeedReport({ cases, scores: scoreById, seed, flowsOfCase: flowsOf })), 'utf-8');
  fs.writeFileSync(reviewPath, toReviewCsv(reviewRows), 'utf-8');

  console.log(`\nเขียนแล้ว:\n  ${jsonPath}\n  ${csvPath}\n  ${seedPath}\n  ${reviewPath}`);
  await engine.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nrun-real-cases ล้มเหลว:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
