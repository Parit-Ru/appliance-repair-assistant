import type { Pool, RowDataPacket } from 'mysql2/promise';
import { createLogger } from '../common/logger';
import {DeviceCategory,InputType,StateType,OutcomeKind,TroubleshootingFlow, TroubleshootingState } from '../state-machine/types';

interface FlowRow extends RowDataPacket {
  flow_id: string;
  manual_id: string;
  entry_symptom: string;
  entry_symptom_th: string | null;
  entry_symptom_aliases: unknown;
  source: string;
  page_start: number;
  page_end: number;
  source_chunk_id: string;
  initial_state: string;
  device_category: DeviceCategory;
  brand: string;
  model_pattern: string;
  display_name: string | null;
  model_aliases: unknown;
}

interface StateRow extends RowDataPacket {
  flow_id: string;
  state_id: string;
  state_type: StateType;
  text_content: string;
  on_yes: string | null;
  on_no: string | null;
  next_state: string | null;
  on_invalid: string | null;
  input_type: InputType | null;
  input_pattern: string | null;
  store_as: string | null;
  outcome_kind: OutcomeKind | null;
  safety_critical: number;
  safety_warning: string | null;
}

/** GET /execution/flows */
export interface FlowSummary {
  flowId: string;
  manualId: string;
  entrySymptom: string;
  entrySymptomTh?: string;
  deviceCategory: DeviceCategory;
  brand: string;
  modelPattern: string;
}

/** GET /execution/manuals */
export interface ManualSummary {
  manualId: string;
  deviceCategory: DeviceCategory;
  brand: string;
  modelPattern: string;
  displayName?: string;
  modelAliases?: string[];
  flowCount: number;
}

class FlowDataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowDataIntegrityError';
  }
}

export class FlowRepository {
  private readonly logger = createLogger('FlowRepository');

  private readonly flows = new Map<string, TroubleshootingFlow>();

  /** ชื่อรุ่นที่ผู้ใช้รู้จักของแต่ละคู่มือ (migration 006) ใช้ใน listManuals เท่านั้น ไม่ปนกับผังของ engine */
  private readonly manualExtras = new Map<string, { displayName?: string; modelAliases?: string[] }>();

  constructor(private readonly pool: Pool) {}
  /** โหลดผังทั้งหมดเข้าหน่วยความจำ — app.ts เรียกตอนบูต ก่อนเปิดรับคำขอ (ข้อมูลเสีย = บูตไม่ขึ้น) */
  async load(): Promise<void> {
    await this.loadAll();
  }

  findById(flowId: string): TroubleshootingFlow | undefined {
    return this.flows.get(flowId);
  }

  listAll(): FlowSummary[] {
    return [...this.flows.values()].map((g) => ({
      flowId: g.flow_id,
      manualId: g.manual_id,
      entrySymptom: g.entry_symptom,
      entrySymptomTh: g.entry_symptom_th,
      deviceCategory: g.device_category,
      brand: g.brand,
      modelPattern: g.model_pattern,
    }));
  }

  listManuals(): ManualSummary[] {
    const manuals = new Map<string, ManualSummary>();
    for (const g of this.flows.values()) {
      const found = manuals.get(g.manual_id);
      if (found) {
        found.flowCount += 1;
      } else {
        manuals.set(g.manual_id, {
          manualId: g.manual_id,
          deviceCategory: g.device_category,
          brand: g.brand,
          modelPattern: g.model_pattern,
          displayName: this.manualExtras.get(g.manual_id)?.displayName,
          modelAliases: this.manualExtras.get(g.manual_id)?.modelAliases,
          flowCount: 1,
        });
      }
    }
    return [...manuals.values()];
  }

  private async loadAll(): Promise<void> {
    const [flowRows] = await this.pool.query<FlowRow[]>(
      `SELECT f.flow_id, f.manual_id, f.entry_symptom, f.entry_symptom_th,
              f.entry_symptom_aliases, f.source, f.page_start, f.page_end,
              f.source_chunk_id, f.initial_state,
              m.device_category, m.brand, m.model_pattern,
              m.display_name, m.model_aliases
         FROM flows f
         JOIN manuals m ON m.manual_id = f.manual_id
        ORDER BY f.flow_id`,
    );

    // พับ state_transitions (δ) กลับเป็นรูปเดิมของแต่ละ state: input_symbol → on_yes / on_no / next_state / on_invalid
    // state ที่ไม่มี transition (resolution/escalation) ได้ NULL ทั้งสี่ช่อง · engine จึงไม่ต้องรู้ว่า δ แยกตารางกัน
    const [stateRows] = await this.pool.query<StateRow[]>(
      `SELECT s.flow_id, s.state_id, s.state_type, s.text_content,
              MAX(CASE WHEN t.input_symbol = 'yes'     THEN t.to_state_id END) AS on_yes,
              MAX(CASE WHEN t.input_symbol = 'no'      THEN t.to_state_id END) AS on_no,
              MAX(CASE WHEN t.input_symbol = 'next'    THEN t.to_state_id END) AS next_state,
              MAX(CASE WHEN t.input_symbol = 'invalid' THEN t.to_state_id END) AS on_invalid,
              s.input_type, s.input_pattern, s.store_as, s.outcome_kind,
              s.safety_critical, s.safety_warning
         FROM states s
         LEFT JOIN state_transitions t
                ON t.flow_id = s.flow_id AND t.from_state_id = s.state_id
        GROUP BY s.flow_id, s.state_id
        ORDER BY s.flow_id, s.display_order`,
    );

    const statesByFlow = new Map<string, StateRow[]>();
    for (const row of stateRows) {
      const list = statesByFlow.get(row.flow_id);
      if (list) list.push(row);
      else statesByFlow.set(row.flow_id, [row]);
    }

    // สร้างผลลัพธ์ใน Map ใหม่ให้เสร็จก่อน แล้วค่อยสลับเข้า Map จริงในครั้งเดียว (ไม่มี await คั่น)
    // ถ้าข้อมูลเสียจนบางผัง build ไม่ได้ (throw) ของเดิมยังอยู่ครบ ไม่ใช่ Map ที่ว่าง/ครึ่งๆ กลางๆ
    // สำคัญเมื่อ reload() ถูกเรียกระหว่างระบบทำงาน (publish ผังใหม่) ต่างจากตอนบูตที่ throw แล้วแอปไม่ขึ้นอยู่แล้ว
    const nextFlows = new Map<string, TroubleshootingFlow>();
    const nextExtras = new Map<string, { displayName?: string; modelAliases?: string[] }>();
    for (const flowRow of flowRows) {
      const rows = statesByFlow.get(flowRow.flow_id) ?? [];
      nextFlows.set(flowRow.flow_id, this.buildFlow(flowRow, rows));

      const aliases = parseJsonColumn<unknown>(flowRow.model_aliases);
      nextExtras.set(flowRow.manual_id, {
        displayName: flowRow.display_name ?? undefined,
        modelAliases: Array.isArray(aliases)
          ? aliases.filter((a): a is string => typeof a === 'string')
          : undefined,
      });
    }

    this.flows.clear();
    this.manualExtras.clear();
    for (const [id, flow] of nextFlows) this.flows.set(id, flow);
    for (const [id, extras] of nextExtras) this.manualExtras.set(id, extras);

    this.logger.log(`โหลดผังขั้นตอนสำเร็จ ${this.flows.size} ผังขั้นตอน ${stateRows.length} สถานะ`);
  }

  /**
   * โหลดผังจากฐานข้อมูลใหม่โดยไม่ต้องรีสตาร์ต — เรียกหลัง publish ผังใหม่ (โมดูล authoring)
   * ล้มเหลว (ข้อมูลเสีย/ฐานข้อมูลล่ม) → โยน error และผังเดิมในหน่วยความจำไม่เปลี่ยน
   * คืนจำนวนผังหลังโหลด
   */
  async reload(): Promise<number> {
    await this.loadAll();
    return this.flows.size;
  }

  private buildFlow(row: FlowRow, stateRows: StateRow[]): TroubleshootingFlow {
    if (stateRows.length === 0) {
      throw new FlowDataIntegrityError(
        `ผังขั้นตอน '${row.flow_id}' ไม่มีสถานะเลยในตาราง states`,
      );
    }

    const states = stateRows.map((n) => this.buildState(n));

    if (!states.some((n) => n.state_id === row.initial_state)) {
      throw new FlowDataIntegrityError(
        `ผังขั้นตอน '${row.flow_id}' มี initial_state='${row.initial_state}' ` +
          `แต่ไม่พบสถานะนี้ในผังขั้นตอน`,
      );
    }

    return {
      flow_id: row.flow_id,
      manual_id: row.manual_id,
      device_category: row.device_category,
      brand: row.brand,
      model_pattern: row.model_pattern,
      entry_symptom: row.entry_symptom,
      entry_symptom_th: row.entry_symptom_th ?? undefined,
      entry_symptom_aliases: parseJsonColumn<string[]>(row.entry_symptom_aliases),
      source: row.source,
      page_range: [row.page_start, row.page_end],
      source_chunk_id: row.source_chunk_id,
      initial_state: row.initial_state,
      states,
    };
  }

  private buildState(row: StateRow): TroubleshootingState {
    const base = {
      state_id: row.state_id,
      safety_critical: row.safety_critical === 1,
      safety_warning: row.safety_warning ?? undefined,
    };

    switch (row.state_type) {
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
          next: required(row.next_state, 'next_state', row),
        };

      case 'input':
        return {
          ...base,
          type: 'input',
          prompt: row.text_content,
          input_type: required(row.input_type, 'input_type', row),
          pattern: row.input_pattern ?? undefined,
          store_as: required(row.store_as, 'store_as', row),
          next: required(row.next_state, 'next_state', row),
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
        const unreachable: never = row.state_type;
        throw new FlowDataIntegrityError(
          `สถานะ '${row.state_id}' ในผังขั้นตอน '${row.flow_id}' ` +
            `มี state_type ที่ไม่รู้จัก: ${String(unreachable)}`,
        );
      }
    }
  }
}

function required<T extends string>(value: T | null, column: string, row: StateRow): T {
  if (value === null || value === '') {
    throw new FlowDataIntegrityError(
      `สถานะ '${row.state_id}' ในผังขั้นตอน '${row.flow_id}' เป็น type='${row.state_type}' ` +
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