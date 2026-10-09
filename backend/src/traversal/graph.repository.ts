import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import { MYSQL_POOL } from '../database/database.constants';
import {
  DeviceCategory,
  Difficulty,
  InputType,
  NodeType,
  OutcomeKind,
  Severity,
  TroubleshootingGraph,
  TroubleshootingNode,
  UnsupportedSchemaVersionError,
} from '../traversal-engine/types';

interface GraphRow extends RowDataPacket {
  graph_id: string;
  manual_id: string;
  entry_symptom: string;
  entry_symptom_th: string | null;
  entry_symptom_aliases: unknown;
  source: string;
  page_start: number;
  page_end: number;
  source_chunk_id: string;
  severity: Severity | null;
  difficulty: Difficulty | null;
  config: unknown;
  entry_node: string;
  schema_version: number;
  device_category: DeviceCategory;
  brand: string;
  model_pattern: string;
}

interface NodeRow extends RowDataPacket {
  graph_id: string;
  node_id: string;
  node_type: NodeType;
  text_content: string;
  on_yes: string | null;
  on_no: string | null;
  next_node: string | null;
  on_invalid: string | null;
  input_type: InputType | null;
  input_pattern: string | null;
  store_as: string | null;
  outcome_kind: OutcomeKind | null;
  safety_critical: number;
  safety_warning: string | null;
  has_image: number;
  image_url: string | null;
  author_note: string | null;
  external_reference: unknown;
}

// GET /traversal/graphs
export interface GraphSummary {
  graphId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  brand: string;
  modelPattern: string;
  severity?: Severity;
  difficulty?: Difficulty;
}

class GraphDataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphDataIntegrityError';
  }
}

@Injectable()
export class GraphRepository implements OnModuleInit {
  private readonly logger = new Logger(GraphRepository.name);

  private readonly graphs = new Map<string, TroubleshootingGraph>();

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}
  async onModuleInit(): Promise<void> {
    await this.loadAll();
  }

  findById(graphId: string): TroubleshootingGraph | undefined {
    return this.graphs.get(graphId);
  }

  listAll(): GraphSummary[] {
    return [...this.graphs.values()].map((g) => ({
      graphId: g.graph_id,
      entrySymptom: g.entry_symptom,
      entrySymptomTh: g.entry_symptom_th,
      deviceCategory: g.device_category,
      brand: g.brand,
      modelPattern: g.model_pattern,
      severity: g.severity,
      difficulty: g.difficulty,
    }));
  }

  private async loadAll(): Promise<void> {
    const [graphRows] = await this.pool.query<GraphRow[]>(
      `SELECT g.graph_id, g.manual_id, g.entry_symptom, g.entry_symptom_th,
              g.entry_symptom_aliases, g.source, g.page_start, g.page_end,
              g.source_chunk_id, g.severity, g.difficulty, g.config,
              g.entry_node, g.schema_version,
              m.device_category, m.brand, m.model_pattern
         FROM graphs g
         JOIN manuals m ON m.manual_id = g.manual_id
        ORDER BY g.graph_id`,
    );

    const [nodeRows] = await this.pool.query<NodeRow[]>(
      `SELECT graph_id, node_id, node_type, text_content,
              on_yes, on_no, next_node, on_invalid,
              input_type, input_pattern, store_as, outcome_kind,
              safety_critical, safety_warning, has_image, image_url,
              author_note, external_reference
         FROM nodes
        ORDER BY graph_id, display_order`,
    );

    const nodesByGraph = new Map<string, NodeRow[]>();
    for (const row of nodeRows) {
      const list = nodesByGraph.get(row.graph_id);
      if (list) list.push(row);
      else nodesByGraph.set(row.graph_id, [row]);
    }

    this.graphs.clear();
    for (const graphRow of graphRows) {
      const rows = nodesByGraph.get(graphRow.graph_id) ?? [];
      this.graphs.set(graphRow.graph_id, this.buildGraph(graphRow, rows));
    }

    this.logger.log(`โหลดกราฟสำเร็จ ${this.graphs.size} กราฟ ${nodeRows.length} โหนด`);
  }

  private buildGraph(row: GraphRow, nodeRows: NodeRow[]): TroubleshootingGraph {
    if (row.schema_version !== 2) {
      throw new UnsupportedSchemaVersionError(row.schema_version, row.graph_id);
    }

    if (nodeRows.length === 0) {
      throw new GraphDataIntegrityError(
        `กราฟ '${row.graph_id}' ไม่มีโหนดเลยในตาราง nodes`,
      );
    }

    const nodes = nodeRows.map((n) => this.buildNode(n));

    if (!nodes.some((n) => n.node_id === row.entry_node)) {
      throw new GraphDataIntegrityError(
        `กราฟ '${row.graph_id}' มี entry_node='${row.entry_node}' ` +
          `แต่ไม่พบโหนดนี้ในกราฟ`,
      );
    }

    return {
      schema_version: 2,
      graph_id: row.graph_id,
      device_category: row.device_category,
      brand: row.brand,
      model_pattern: row.model_pattern,
      entry_symptom: row.entry_symptom,
      entry_symptom_th: row.entry_symptom_th ?? undefined,
      entry_symptom_aliases: parseJsonColumn<string[]>(row.entry_symptom_aliases),
      source: row.source,
      page_range: [row.page_start, row.page_end],
      source_chunk_id: row.source_chunk_id,
      severity: row.severity ?? undefined,
      difficulty: row.difficulty ?? undefined,
      config: parseJsonColumn<Record<string, unknown>>(row.config),
      entry_node: row.entry_node,
      nodes,
    };
  }

  private buildNode(row: NodeRow): TroubleshootingNode {
    const base = {
      node_id: row.node_id,
      safety_critical: row.safety_critical === 1,
      safety_warning: row.safety_warning ?? undefined,
      has_image: row.has_image === 1,
      image_url: row.image_url ?? undefined,
      author_note: row.author_note ?? undefined,
      external_reference: parseJsonColumn<never>(row.external_reference),
    };

    switch (row.node_type) {
      case 'checkpoint':
        return {
          ...base,
          type: 'checkpoint',
          question: row.text_content,
          on_yes: required(row.on_yes, 'on_yes', row),
          on_no: required(row.on_no, 'on_no', row),
        };

      case 'instruction':
        return {
          ...base,
          type: 'instruction',
          content: row.text_content,
          next: required(row.next_node, 'next_node', row),
        };

      case 'input':
        return {
          ...base,
          type: 'input',
          prompt: row.text_content,
          input_type: required(row.input_type, 'input_type', row),
          pattern: row.input_pattern ?? undefined,
          store_as: required(row.store_as, 'store_as', row),
          next: required(row.next_node, 'next_node', row),
          on_invalid: row.on_invalid ?? undefined,
        };

      case 'resolution':
        return {
          ...base,
          type: 'resolution',
          content: row.text_content,
          outcome_kind: required(row.outcome_kind, 'outcome_kind', row),
        };

      case 'escalation':
        return {
          ...base,
          type: 'escalation',
          content: row.text_content,
          outcome_kind: required(row.outcome_kind, 'outcome_kind', row),
        };

      default: {
        const unreachable: never = row.node_type;
        throw new GraphDataIntegrityError(
          `โหนด '${row.node_id}' ในกราฟ '${row.graph_id}' ` +
            `มี node_type ที่ไม่รู้จัก: ${String(unreachable)}`,
        );
      }
    }
  }
}

function required<T extends string>(value: T | null, column: string, row: NodeRow): T {
  if (value === null || value === '') {
    throw new GraphDataIntegrityError(
      `โหนด '${row.node_id}' ในกราฟ '${row.graph_id}' เป็น type='${row.node_type}' ` +
        `ซึ่งต้องมีคอลัมน์ '${column}' แต่ค่าเป็น NULL/ว่าง`,
    );
  }
  return value;
}

function parseJsonColumn<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return JSON.parse(trimmed) as T;
  }
  return value as T;
}