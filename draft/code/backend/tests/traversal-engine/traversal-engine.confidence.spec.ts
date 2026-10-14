// backend/src/traversal-engine/traversal-engine.confidence.spec.ts

/**
 * เทสว่า engine "เก็บ" confidence ของ session แต่ไม่เคย "ใช้" มันตัดสินใจ (ขั้น 1.8)
 * แยกเป็นไฟล์ใหม่เพื่อไม่แตะ traversal-engine.spec.ts ที่ใหญ่และเสถียรอยู่แล้ว
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { startSession, submitAction } from './traversal-engine';
import type { ManualFile } from './types';

const manual = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../data/manuals/samsung_ac_ar70h.json'), 'utf-8'),
) as ManualFile;
const graph = manual.graphs.find((g) => g.graph_id === 'samsung_ac_ar70h_stops_working')!;

describe('engine — confidence ของ session', () => {
  it('ไม่ระบุ → null (ไม่ใช่ undefined, ไม่ใช่ 0)', () => {
    expect(startSession(graph).session.confidence).toBeNull();
  });

  it('ระบุค่า → เก็บไว้ใน session ตามนั้น', () => {
    expect(startSession(graph, 0.812).session.confidence).toBe(0.812);
  });

  it('submitAction คงค่า confidence เดิมไว้ ไม่แก้ไข', () => {
    const { session } = startSession(graph, 0.812);
    const next = submitAction(session, graph, { type: 'answer', value: 'yes' });
    expect(next.session.confidence).toBe(0.812);
  });

  it('confidence ไม่มีผลต่อเส้นทาง: ค่า null, 0 และ 1 ให้สถานะถัดไปเหมือนกันทุกประการ', () => {
    const nodeIds = [null, 0, 1].map((c) => {
      const { session } = startSession(graph, c);
      return submitAction(session, graph, { type: 'answer', value: 'no' }).node.nodeId;
    });
    expect(new Set(nodeIds).size).toBe(1);
  });
});