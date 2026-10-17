/**
 * draft-manual.ts — ประกอบ "คู่มือ" จากร่าง และแปลงเป็นแถวสำหรับ INSERT ตอน publish
 *
 * เซิร์ฟเวอร์เป็นคนกำหนดทุกอย่างที่ไม่ใช่เนื้อหาผัง: manual_id, ยี่ห้อ, รุ่น, ประเภทเครื่อง, source, page_range, source_chunk_id
 * (มาจากข้อมูลที่ผู้ดูแลกรอกตอนอัปโหลด + เลขหน้าของโหนด) LLM กำหนดสิ่งเหล่านี้ไม่ได้
 *
 * toDbRows คืนแถวที่ใช้คอลัมน์ชื่อเดียวกับตาราง manuals / graphs / nodes และต้องให้ GraphRepository โหลดกลับได้ตรงกับผังที่ตรวจ
 * source_page ไม่ถูกเขียนลงตาราง nodes — เก็บในร่างเป็นหลักฐานเท่านั้น
 */

import type { DraftGraph } from './draft-schema';

export type Json = Record<string, any>;

export interface DraftMeta {
  device_category: string;
  brand: string;
  model_pattern: string;
  source_manual: string;
  display_name?: string;
  page_from: number;
  page_to: number;
}

export function sourceChunkId(draftId: string, graphId: string): string {
  return `draft:${draftId}:${graphId}`;
}

export function assembleManual(manualId: string, meta: DraftMeta, graphs: DraftGraph[], draftId: string): Json {
  return {
    schema_version: 2,
    manual_id: manualId,
    device_category: meta.device_category,
    brand: meta.brand,
    model_pattern: meta.model_pattern,
    source_manual: meta.source_manual,
    ...(meta.display_name ? { display_name: meta.display_name } : {}),
    graphs: graphs.map((graph) => {
      const pages = graph.nodes.map((n) => n.source_page).filter((p): p is number => typeof p === 'number');
      // page_range คำนวณจากหน้าที่โหนดอ้างจริง (ไม่เชื่อค่าจาก LLM) ไม่มีโหนดอ้างหน้าเลย → validator จะแจ้ง source_page ขาด
      const range = pages.length > 0 ? [Math.min(...pages), Math.max(...pages)] : [meta.page_from, meta.page_from];
      return {
        schema_version: 2,
        graph_id: graph.graph_id,
        device_category: meta.device_category,
        brand: meta.brand,
        model_pattern: meta.model_pattern,
        entry_symptom: graph.entry_symptom,
        ...(graph.entry_symptom_th !== undefined ? { entry_symptom_th: graph.entry_symptom_th } : {}),
        ...(graph.entry_symptom_aliases !== undefined ? { entry_symptom_aliases: graph.entry_symptom_aliases } : {}),
        source: meta.source_manual,
        page_range: range,
        source_chunk_id: sourceChunkId(draftId, graph.graph_id),
        ...(graph.severity !== undefined ? { severity: graph.severity } : {}),
        ...(graph.difficulty !== undefined ? { difficulty: graph.difficulty } : {}),
        entry_node: graph.entry_node,
        nodes: graph.nodes,
      };
    }),
  };
}

// ============================================================
// แถวสำหรับ INSERT (ชื่อคอลัมน์ตรงกับ migration 001 / 006)
// ============================================================

export const MANUAL_COLUMNS = ['manual_id', 'device_category', 'brand', 'model_pattern', 'source_manual', 'graph_count', 'display_name', 'model_aliases'] as const;
export const GRAPH_COLUMNS = [
  'graph_id', 'manual_id', 'entry_symptom', 'entry_symptom_th', 'entry_symptom_aliases', 'source', 'page_start', 'page_end',
  'source_chunk_id', 'severity', 'difficulty', 'config', 'entry_node', 'schema_version',
] as const;
export const NODE_COLUMNS = [
  'graph_id', 'node_id', 'node_type', 'text_content', 'on_yes', 'on_no', 'next_node', 'on_invalid', 'input_type', 'input_pattern',
  'store_as', 'outcome_kind', 'safety_critical', 'safety_warning', 'has_image', 'image_url', 'author_note', 'external_reference', 'display_order',
] as const;

export interface DbRows {
  manual: Record<(typeof MANUAL_COLUMNS)[number], unknown>;
  graphs: Array<Record<(typeof GRAPH_COLUMNS)[number], unknown>>;
  nodes: Array<Record<(typeof NODE_COLUMNS)[number], unknown>>;
}

/** ข้อความของโหนด อยู่คนละฟิลด์ตามชนิด แต่เก็บลงคอลัมน์เดียวกัน (เหมือน textOf ใน scripts/seed-graphs.js) */
function textOf(node: Json): string {
  return String(node.question ?? node.prompt ?? node.content ?? '');
}

export function toDbRows(manual: Json): DbRows {
  const graphs = manual.graphs as Json[];
  return {
    manual: {
      manual_id: manual.manual_id,
      device_category: manual.device_category,
      brand: manual.brand,
      model_pattern: manual.model_pattern,
      source_manual: manual.source_manual,
      graph_count: graphs.length,
      display_name: manual.display_name ?? null,
      model_aliases: manual.model_aliases ? JSON.stringify(manual.model_aliases) : null,
    },
    graphs: graphs.map((graph) => ({
      graph_id: graph.graph_id,
      manual_id: manual.manual_id,
      entry_symptom: graph.entry_symptom,
      entry_symptom_th: graph.entry_symptom_th ?? null,
      entry_symptom_aliases: graph.entry_symptom_aliases ? JSON.stringify(graph.entry_symptom_aliases) : null,
      source: graph.source,
      page_start: graph.page_range[0],
      page_end: graph.page_range[1],
      source_chunk_id: graph.source_chunk_id,
      severity: graph.severity ?? null,
      difficulty: graph.difficulty ?? null,
      config: null,
      entry_node: graph.entry_node,
      schema_version: 2,
    })),
    nodes: graphs.flatMap((graph) =>
      (graph.nodes as Json[]).map((node, order) => ({
        graph_id: graph.graph_id,
        node_id: node.node_id,
        node_type: node.type,
        text_content: textOf(node),
        on_yes: node.on_yes ?? null,
        on_no: node.on_no ?? null,
        next_node: node.next ?? null,
        on_invalid: node.on_invalid ?? null,
        input_type: node.input_type ?? null,
        input_pattern: node.pattern ?? null,
        store_as: node.store_as ?? null,
        outcome_kind: node.outcome_kind ?? null,
        safety_critical: node.safety_critical === true,
        safety_warning: node.safety_warning ?? null,
        has_image: false,
        image_url: null,
        author_note: null,
        external_reference: null,
        display_order: order,
      })),
    ),
  };
}
