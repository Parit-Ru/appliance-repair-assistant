// scoring.ts — ตัดสินว่าผังที่ระบบเสนอ "พาไปถึงสาเหตุที่ยืนยันแล้ว" หรือไม่ (ไม่เรียก DB ไม่เรียก LLM · ฟังก์ชันล้วน)
//
// นิยาม (ตกลงกับผู้ใช้แล้ว):
// - ข้อความส่วนสาเหตุ = ข้อความของ state ทุกตัวในผัง (checkpoint/instruction/input/resolution/escalation)
//   ไม่นับ entry_symptom/aliases (เป็นอาการ ไม่ใช่สาเหตุ) และไม่นับ safety_warning
// - hit = เจอคำใดคำหนึ่งใน cause_tags_seed ของ cause_tag หรือ alt_cause_tags ตัวใดตัวหนึ่ง (th หรือ en)
// - top1_hit = มีผังในกลุ่ม "score เท่า top-1" อย่างน้อยหนึ่งผังที่ hit (กลุ่มเสมอกันเรียงด้วย flowId ซึ่งไม่มีความหมาย จึงนับทั้งกลุ่ม)
// - top3_hit = มีผังใน "score >= อันดับ 3" (รวมกลุ่มที่เสมอกันที่ขอบ) อย่างน้อยหนึ่งผังที่ hit
// - cause_hit (คอลัมน์ใน workbook) = top1_hit · refused (ไม่มีผังของอุปกรณ์ >= เกณฑ์) → ทุก hit เป็น null ไม่นับในตัวหาร
// - ไม่ปรับ seed เพื่อให้ตัวเลขดีขึ้น: buildSeedReport แค่เสนอ ตัวเลขทุกตัวคำนวณจาก seed ต้นฉบับ

import type { TroubleshootingFlow, TroubleshootingState } from '../../backend/src/state-machine/types';
import type { DeviceCategory } from '../../backend/src/state-machine/types';
import type { CrossDeviceSearchResult, DeviceMatch, DeviceSearchResult } from './engine';

// ---------- ชนิดข้อมูล ----------

export interface RealCase {
  id: string;
  device: string;
  brand_model: string;
  query_th: string;
  confirmed_fix_th: string;
  cause_tag: string;
  alt_cause_tags?: string[];
  fix_category: string;
  confirmation: string;
  confirmation_note?: string;
  source_url?: string;
}

export interface SeedTerms {
  th: string[];
  en: string[];
}
export type CauseSeed = Record<string, SeedTerms>;

export interface CauseEvidence {
  tag: string;
  via: 'cause_tag' | 'alt_cause_tag';
  term: string;
  stateId: string;
  stateType: TroubleshootingState['type'];
  /** ข้อความรอบคำที่เจอ (หลัง normalize) */
  snippet: string;
}

export interface FlowCauseMatch {
  flowId: string;
  hit: boolean;
  /** หลักฐานแรกที่เจอ (ลำดับ: cause_tag ก่อน alt_cause_tags) · null = ไม่เจอ */
  evidence: CauseEvidence | null;
  /** ทุกคู่ (tag, คำ) ที่เจอในผังนี้ คู่ละหนึ่งรายการ (state แรกที่เจอ) — ให้สุ่มตรวจเองได้ */
  allEvidence: CauseEvidence[];
}

export interface PooledFlow {
  flowId: string;
  manualId: string;
  score: number;
  matchedText: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  /** ชื่อคู่มือ + ช่วงหน้า ตามที่เก็บในผัง (flows.source, page_start/end) — ไม่เดา ไม่แก้ */
  source: string;
  pageRange: [number, number];
  /** ไม่มี resolution ที่เดินถึงได้จาก initial_state */
  escalationOnly: boolean;
  /** มี state ประเภท escalation ที่เดินถึงได้จาก initial_state (อย่างน้อยหนึ่งเส้นทาง — ไม่ได้แปลว่าผู้ใช้ทุกคนจะผ่าน) */
  hasEscalationPath: boolean;
  hasSafety: boolean;
  match: FlowCauseMatch;
}

export interface CaseScore {
  id: string;
  refused: boolean;
  bestScore: number | null;
  threshold: number;
  /** null = refused (ไม่คำนวณ) */
  cause_hit: boolean | null;
  top1_hit: boolean | null;
  top3_hit: boolean | null;
  /** เฉพาะผังที่ระบบเรียงเป็นอันดับแรกจริง (ไม่นับกลุ่มเสมอ) — เก็บไว้เทียบความไวต่อการเสมอกัน */
  top1_first_only_hit: boolean | null;
  /** hit แรกของกลุ่ม top-1 มาจาก cause_tag หรือ alt_cause_tag */
  cause_hit_via: 'cause_tag' | 'alt_cause_tag' | null;
  /** เฉพาะผังที่ระบบเรียงเป็นอันดับแรกจริง (คู่กับ has_safety ที่นับทั้งกลุ่มเสมอ) */
  has_safety_first_only: boolean | null;
  top1_tie_count: number | null;
  /** กลุ่มเสมออาจใหญ่กว่าที่นับ (service คืนไม่เกิน PER_MANUAL_CAP ต่อคู่มือ) */
  tie_count_is_lower_bound: boolean;
  /** ทุกผังในกลุ่ม top-1 ไม่มี resolution ที่เดินถึงได้ */
  top1_escalation_only: boolean | null;
  /** มีผังในกลุ่ม top-1 ที่มี state safety_critical หรือ safety_warning อย่างน้อยหนึ่งผัง */
  has_safety: boolean | null;
  /** (เพิ่มหลังรันรอบแรก) มีผังในกลุ่ม top-1 ที่มี state escalation เดินถึงได้จาก initial_state อย่างน้อยหนึ่งผัง */
  has_escalation_path: boolean | null;
  /** เฉพาะผังที่ระบบเรียงเป็นอันดับแรกจริง */
  has_escalation_path_first_only: boolean | null;
  top1Pool: PooledFlow[];
  top3Pool: PooledFlow[];
}

// ---------- ข้อความและการจับคำ ----------

export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stateText(state: TroubleshootingState): string {
  switch (state.type) {
    case 'checkpoint':
      return state.question;
    case 'input':
      return state.prompt;
    case 'instruction':
    case 'resolution':
    case 'escalation':
      return state.content;
  }
}

interface CauseText {
  stateId: string;
  stateType: TroubleshootingState['type'];
  normalized: string;
}

export function causeTextsOf(flow: TroubleshootingFlow): CauseText[] {
  return flow.states.map((s) => ({ stateId: s.state_id, stateType: s.type, normalized: normalizeText(stateText(s)) }));
}

function termsOf(tag: string, seed: CauseSeed): string[] {
  const entry = seed[tag];
  if (entry === undefined) throw new Error(`cause_tag '${tag}' ไม่มีใน cause_tags_seed`);
  return [...entry.th, ...entry.en].map(normalizeText).filter((t) => t !== '');
}

const SNIPPET_RADIUS = 24;

/** หลักฐานของคู่ (tag, คำ) ที่เจอในผัง เรียงตาม tag แล้วตามคำใน seed · firstOnly = หยุดที่รายการแรก (เร็วกว่า ใช้ตอนต้องรู้แค่ว่ามีไหม) */
function collectEvidence(
  flow: TroubleshootingFlow,
  tags: string[],
  primaryTag: string,
  seed: CauseSeed,
  firstOnly: boolean,
): CauseEvidence[] {
  const texts = causeTextsOf(flow);
  const out: CauseEvidence[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    for (const term of termsOf(tag, seed)) {
      const key = `${tag}\u0000${term}`;
      if (seen.has(key)) continue;
      seen.add(key);

      for (const t of texts) {
        const at = t.normalized.indexOf(term);
        if (at < 0) continue;
        out.push({
          tag,
          via: tag === primaryTag ? 'cause_tag' : 'alt_cause_tag',
          term,
          stateId: t.stateId,
          stateType: t.stateType,
          snippet: t.normalized.slice(Math.max(0, at - SNIPPET_RADIUS), at + term.length + SNIPPET_RADIUS),
        });
        if (firstOnly) return out;
        break;
      }
    }
  }
  return out;
}

const tagsOf = (c: Pick<RealCase, 'cause_tag' | 'alt_cause_tags'>): string[] => [c.cause_tag, ...(c.alt_cause_tags ?? [])];

export function matchFlow(
  flow: TroubleshootingFlow,
  c: Pick<RealCase, 'cause_tag' | 'alt_cause_tags'>,
  seed: CauseSeed,
): FlowCauseMatch {
  const allEvidence = collectEvidence(flow, tagsOf(c), c.cause_tag, seed, false);
  return { flowId: flow.flow_id, hit: allEvidence.length > 0, evidence: allEvidence[0] ?? null, allEvidence };
}

export interface BaselineRate {
  matched: number;
  total: number;
  /** matched / total */
  rate: number;
}

/**
 * สัดส่วนผังทั้งหมดของอุปกรณ์เดียวกันที่ข้อความมีคำของ tag — ค่าที่จะได้ถ้าสุ่มผังของอุปกรณ์นั้นมาตอบ
 * all = กฎเดียวกับ hit (cause_tag + alt_cause_tags) ใช้เทียบกับ top1_hit
 * primaryOnly = เฉพาะ cause_tag ตามตัวอักษร
 */
export function baselineRate(
  c: Pick<RealCase, 'cause_tag' | 'alt_cause_tags'>,
  deviceFlows: TroubleshootingFlow[],
  seed: CauseSeed,
): { all: BaselineRate; primaryOnly: BaselineRate } {
  const count = (tags: string[]): BaselineRate => {
    const matched = deviceFlows.filter((f) => collectEvidence(f, tags, c.cause_tag, seed, true).length > 0).length;
    return { matched, total: deviceFlows.length, rate: deviceFlows.length === 0 ? 0 : matched / deviceFlows.length };
  };
  return { all: count(tagsOf(c)), primaryOnly: count([c.cause_tag]) };
}

/** ตรวจว่า cause_tag/alt_cause_tags ทุกตัวมีใน seed — เรียกก่อนรัน เพื่อไม่ให้พิมพ์ผิดแล้วนับเป็น "ไม่ hit" เงียบๆ */
export function validateCases(cases: RealCase[], seed: CauseSeed): string[] {
  const problems: string[] = [];
  for (const c of cases) {
    for (const tag of [c.cause_tag, ...(c.alt_cause_tags ?? [])]) {
      if (seed[tag] === undefined) problems.push(`${c.id}: tag '${tag}' ไม่มีใน cause_tags_seed`);
    }
  }
  return problems;
}

// ---------- ข้อเท็จจริงของผัง ----------

function reachableStates(flow: TroubleshootingFlow): TroubleshootingState[] {
  const byId = new Map(flow.states.map((s) => [s.state_id, s]));
  const seen = new Set<string>();
  const stack = [flow.initial_state];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    const state = byId.get(id);
    if (state === undefined || seen.has(id)) continue;
    seen.add(id);
    if (state.type === 'checkpoint') stack.push(state.on_yes, state.on_no);
    else if (state.type === 'instruction') stack.push(state.next);
    else if (state.type === 'input') stack.push(state.next, ...(state.on_invalid ? [state.on_invalid] : []));
  }
  return [...seen].map((id) => byId.get(id) as TroubleshootingState);
}

export function flowFacts(flow: TroubleshootingFlow): { escalationOnly: boolean; hasEscalationPath: boolean; hasSafety: boolean } {
  const reachable = reachableStates(flow);
  return {
    escalationOnly: !reachable.some((s) => s.type === 'resolution'),
    hasEscalationPath: reachable.some((s) => s.type === 'escalation'),
    hasSafety: flow.states.some((s) => s.safety_critical === true || (s.safety_warning ?? '').trim() !== ''),
  };
}

// ---------- รวมเป็นคะแนนต่อเคส ----------

/** ผังที่ score >= score ของอันดับ k (รวมกลุ่มที่เสมอกันที่ขอบ) · sortedDesc ต้องเรียง score มากไปน้อย */
export function rankPool(sortedDesc: DeviceMatch[], k: number): DeviceMatch[] {
  if (sortedDesc.length === 0) return [];
  const cut = sortedDesc[Math.min(k, sortedDesc.length) - 1].score;
  return sortedDesc.filter((m) => m.score >= cut);
}

function mayBeTruncated(pool: DeviceMatch[], perManualCap: number): boolean {
  const perManual = new Map<string, number>();
  for (const m of pool) perManual.set(m.manualId, (perManual.get(m.manualId) ?? 0) + 1);
  return [...perManual.values()].some((n) => n >= perManualCap);
}

export function scoreCase(
  c: RealCase,
  search: DeviceSearchResult,
  getFlow: (flowId: string) => TroubleshootingFlow | undefined,
  seed: CauseSeed,
  perManualCap: number,
): CaseScore {
  const base = { id: c.id, bestScore: search.bestScore, threshold: search.threshold };

  if (search.refused) {
    return {
      ...base,
      refused: true,
      cause_hit: null,
      top1_hit: null,
      top3_hit: null,
      top1_first_only_hit: null,
      cause_hit_via: null,
      has_safety_first_only: null,
      top1_tie_count: null,
      tie_count_is_lower_bound: false,
      top1_escalation_only: null,
      has_safety: null,
      has_escalation_path: null,
      has_escalation_path_first_only: null,
      top1Pool: [],
      top3Pool: [],
    };
  }

  const pooled = (m: DeviceMatch): PooledFlow => {
    const flow = getFlow(m.flowId);
    if (flow === undefined) throw new Error(`${c.id}: ไม่พบผัง '${m.flowId}' ใน FlowRepository`);
    return {
      flowId: m.flowId,
      manualId: m.manualId,
      score: m.score,
      matchedText: m.matchedText,
      entrySymptom: m.entrySymptom,
      entrySymptomTh: m.entrySymptomTh,
      source: flow.source,
      pageRange: flow.page_range,
      ...flowFacts(flow),
      match: matchFlow(flow, c, seed),
    };
  };

  const pool1Raw = rankPool(search.candidates, 1);
  const top1Pool = pool1Raw.map(pooled);
  const top3Pool = rankPool(search.candidates, 3).map(pooled);

  const top1_hit = top1Pool.some((p) => p.match.hit);
  const firstHit = top1Pool.find((p) => p.match.hit);

  return {
    ...base,
    refused: false,
    cause_hit: top1_hit,
    top1_hit,
    top3_hit: top3Pool.some((p) => p.match.hit),
    top1_first_only_hit: top1Pool[0].match.hit,
    cause_hit_via: firstHit?.match.evidence?.via ?? null,
    has_safety_first_only: top1Pool[0].hasSafety,
    top1_tie_count: top1Pool.length,
    tie_count_is_lower_bound: mayBeTruncated(pool1Raw, perManualCap),
    top1_escalation_only: top1Pool.every((p) => p.escalationOnly),
    has_safety: top1Pool.some((p) => p.hasSafety),
    has_escalation_path: top1Pool.some((p) => p.hasEscalationPath),
    has_escalation_path_first_only: top1Pool[0].hasEscalationPath,
    top1Pool,
    top3Pool,
  };
}

// ---------- ค้นข้ามทุกอุปกรณ์ (ตรวจการชี้อุปกรณ์ · ไม่ใช่พฤติกรรมของหน้าเว็บ) ----------

export interface CrossDeviceScore {
  refused: boolean;
  /** top-1 (กลุ่มที่ score เท่ากัน) มีผังของอุปกรณ์เดียวกับเคสอย่างน้อยหนึ่งผัง · null = ไม่มีผังใด >= เกณฑ์ */
  top1_correct: boolean | null;
  /** เฉพาะผังที่ระบบเรียงเป็นอันดับแรกจริง */
  top1_first_only_correct: boolean | null;
  /** ทุกผังในกลุ่ม top-1 เป็นอุปกรณ์เดียวกับเคส (เข้มสุด) */
  top1_all_correct: boolean | null;
  top1_tie_count: number | null;
  /** กลุ่มเสมออาจใหญ่กว่าที่นับ (service คืนไม่เกิน maxResults ผัง) */
  tie_count_is_lower_bound: boolean;
  top1_devices: DeviceCategory[];
  top1_flow_ids: string[];
  bestScore: number | null;
}

export function scoreCrossDevice(device: DeviceCategory, search: CrossDeviceSearchResult, maxResults: number): CrossDeviceScore {
  if (search.refused) {
    return { refused: true, top1_correct: null, top1_first_only_correct: null, top1_all_correct: null, top1_tie_count: null, tie_count_is_lower_bound: false, top1_devices: [], top1_flow_ids: [], bestScore: search.bestScore };
  }
  const group = rankPool(search.matches, 1);
  return {
    refused: false,
    top1_correct: group.some((m) => m.deviceCategory === device),
    top1_first_only_correct: group[0].deviceCategory === device,
    top1_all_correct: group.every((m) => m.deviceCategory === device),
    top1_tie_count: group.length,
    tie_count_is_lower_bound: group.length >= maxResults,
    top1_devices: [...new Set(group.map((m) => m.deviceCategory))],
    top1_flow_ids: group.map((m) => m.flowId),
    bestScore: search.bestScore,
  };
}

// ---------- รายงานข้อเสนอ seed (ให้ผู้ใช้ตรวจ · ไม่ถูกใช้คำนวณตัวเลข) ----------

/** คำที่เสนอต้องยาวอย่างน้อยเท่านี้ และต้องไม่ปรากฏในผังของอุปกรณ์เกินสัดส่วนนี้ (กันคำทั่วไปอย่าง "ตรวจสอบ") */
const MIN_CANDIDATE_LEN = 3;
const MAX_DEVICE_FLOW_RATIO = 0.05;

export interface SeedOverlap {
  tagA: string;
  termA: string;
  tagB: string;
  termB: string;
}

export interface MissDetail {
  id: string;
  device: string;
  query_th: string;
  /** คำใน seed (ของ cause_tag + alt) ที่ปรากฏในข้อความวิธีแก้ที่ยืนยันแล้ว — ว่าง = seed ไม่ตรงกับถ้อยคำของวิธีแก้เลย */
  seedTermsInConfirmedFix: string[];
  /** คำจาก confirmed_fix_th ที่ปรากฏในข้อความสาเหตุของผัง top-1 และพบในผังของอุปกรณ์นั้นไม่เกิน MAX_DEVICE_FLOW_RATIO */
  candidateWords: Array<{ word: string; deviceFlowPct: number }>;
}

export interface TagReport {
  tag: string;
  cases: number;
  refused: string[];
  hits: string[];
  misses: MissDetail[];
  /** คำใน seed ของ tag นี้ที่ไม่ปรากฏในผังใดเลยของอุปกรณ์ที่ tag นี้ใช้ (ระบบไม่มีทางเจอ) */
  deadTerms: string[];
}

export interface SeedReport {
  overlaps: SeedOverlap[];
  tags: TagReport[];
}

function thaiWords(text: string): string[] {
  const out = new Set<string>();
  for (const part of new Intl.Segmenter('th', { granularity: 'word' }).segment(text)) {
    const w = normalizeText(part.segment);
    if (part.isWordLike && w.length >= MIN_CANDIDATE_LEN && !/^\d+$/.test(w)) out.add(w);
  }
  return [...out];
}

function seedOverlaps(seed: CauseSeed): SeedOverlap[] {
  const all = Object.entries(seed).flatMap(([tag, v]) => [...v.th, ...v.en].map((t) => ({ tag, term: normalizeText(t) })));
  const out: SeedOverlap[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.tag !== b.tag && (a.term.includes(b.term) || b.term.includes(a.term))) {
        out.push({ tagA: a.tag, termA: a.term, tagB: b.tag, termB: b.term });
      }
    }
  }
  return out;
}

export function buildSeedReport(input: {
  cases: RealCase[];
  scores: Map<string, CaseScore>;
  seed: CauseSeed;
  /** ผังทุกอันของอุปกรณ์ของเคสนี้ */
  flowsOfCase: (c: RealCase) => TroubleshootingFlow[];
}): SeedReport {
  const { cases, scores, seed, flowsOfCase } = input;
  const joinedByDevice = new Map<string, string[]>();
  const joinedOf = (c: RealCase): string[] => {
    let joined = joinedByDevice.get(c.device);
    if (joined === undefined) {
      joined = flowsOfCase(c).map((f) => causeTextsOf(f).map((t) => t.normalized).join(' | '));
      joinedByDevice.set(c.device, joined);
    }
    return joined;
  };

  const byTag = new Map<string, RealCase[]>();
  for (const c of cases) byTag.set(c.cause_tag, [...(byTag.get(c.cause_tag) ?? []), c]);

  const tags: TagReport[] = [];
  for (const [tag, tagCases] of byTag) {
    const refused: string[] = [];
    const hits: string[] = [];
    const misses: MissDetail[] = [];

    for (const c of tagCases) {
      const score = scores.get(c.id) as CaseScore;
      if (score.refused) {
        refused.push(c.id);
        continue;
      }
      if (score.cause_hit) {
        hits.push(c.id);
        continue;
      }

      const fix = normalizeText(c.confirmed_fix_th);
      const allTerms = [c.cause_tag, ...(c.alt_cause_tags ?? [])].flatMap((t) => termsOf(t, seed));
      const poolText = score.top1Pool.map((p) => p.flowId);
      const poolJoined = flowsOfCase(c)
        .filter((f) => poolText.includes(f.flow_id))
        .map((f) => causeTextsOf(f).map((t) => t.normalized).join(' | '))
        .join(' | ');
      const deviceJoined = joinedOf(c);

      const candidateWords = thaiWords(c.confirmed_fix_th)
        .filter((w) => poolJoined.includes(w))
        .map((w) => ({ word: w, deviceFlowPct: Math.round((deviceJoined.filter((j) => j.includes(w)).length / deviceJoined.length) * 1000) / 10 }))
        .filter((x) => x.deviceFlowPct / 100 <= MAX_DEVICE_FLOW_RATIO);

      misses.push({
        id: c.id,
        device: c.device,
        query_th: c.query_th,
        seedTermsInConfirmedFix: allTerms.filter((t) => fix.includes(t)),
        candidateWords,
      });
    }

    const deviceJoinedAll = tagCases.flatMap(joinedOf);
    const deadTerms = termsOf(tag, seed).filter((t) => !deviceJoinedAll.some((j) => j.includes(t)));

    tags.push({ tag, cases: tagCases.length, refused, hits, misses, deadTerms });
  }

  tags.sort((a, b) => b.misses.length - a.misses.length || a.tag.localeCompare(b.tag));
  return { overlaps: seedOverlaps(seed), tags };
}

export function renderSeedReport(report: SeedReport): string {
  const lines: string[] = [
    '# ข้อเสนอตรวจ cause_tags_seed',
    '',
    '> ให้ผู้ใช้ตรวจเอง · **ไม่ได้ใช้คำนวณตัวเลขในรอบนี้** (ตัวเลขทุกตัวมาจาก seed ต้นฉบับ)',
    '> ถ้านำไปปรับ seed ต้องบันทึกเป็น seed เวอร์ชันใหม่และรายงานเทียบสองเวอร์ชัน ห้ามรายงานเฉพาะเวอร์ชันที่ตัวเลขดีกว่า',
    '',
    '## 1. คำที่ซ้อน/ซ้ำข้าม tag (hit อาจมาจาก tag ข้างเคียง)',
    '',
  ];
  if (report.overlaps.length === 0) lines.push('ไม่พบ', '');
  for (const o of report.overlaps) lines.push(`- \`${o.tagA}\`: "${o.termA}" ~ \`${o.tagB}\`: "${o.termB}"`);

  lines.push('', '## 2. ต่อ tag (เรียงตามจำนวนเคสที่ไม่ hit)', '');
  for (const t of report.tags) {
    lines.push(`### ${t.tag} — ${t.cases} เคส · hit ${t.hits.length} · ไม่ hit ${t.misses.length} · refused ${t.refused.length}`, '');
    if (t.deadTerms.length > 0) {
      lines.push(`- คำที่ไม่ปรากฏในผังใดเลยของอุปกรณ์ที่ tag นี้ใช้ (ระบบไม่มีทางเจอ): ${t.deadTerms.map((d) => `"${d}"`).join(', ')}`);
    }
    for (const m of t.misses) {
      lines.push(`- **${m.id}** (${m.device}) "${m.query_th}"`);
      lines.push(
        m.seedTermsInConfirmedFix.length > 0
          ? `  - คำใน seed ที่อยู่ในวิธีแก้ที่ยืนยัน: ${m.seedTermsInConfirmedFix.map((s) => `"${s}"`).join(', ')} (แปลว่าคำใน seed ถูก แต่ผังที่ระบบเสนอไม่พูดถึง → ปัญหาอยู่ที่ระบบ/คู่มือ ไม่ใช่ seed)`
          : '  - ไม่มีคำใน seed อยู่ในวิธีแก้ที่ยืนยันเลย → seed อาจไม่ตรงถ้อยคำจริง',
      );
      if (m.candidateWords.length > 0) {
        lines.push(`  - คำจากวิธีแก้ที่ยืนยันซึ่งปรากฏในผังที่ระบบเสนอ (ผังนั้นอาจพูดถึงสาเหตุนี้ด้วยคำอื่น ควรอ่านผังก่อนเพิ่มคำ): ${m.candidateWords.map((w) => `"${w.word}" (${w.deviceFlowPct}% ของผัง)`).join(', ')}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}
