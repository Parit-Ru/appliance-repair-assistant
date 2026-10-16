/**
 * ตรวจว่า "ผังขั้นตอน" (data/manuals) ที่แปลงมาจากคู่มือ ยังตรงกับ chunk ต้นทาง (data/chuck) ทุกผัง
 *
 * ชั้นนี้ตรวจเฉพาะ ผัง ↔ chunk ด้วยไฟล์ JSON ล้วน (ไม่ใช้ PDF ไม่ต่อฐานข้อมูล เร็ว รันกับ jest ได้เลย)
 * ส่วน chunk ↔ PDF ดู scripts/verify_chunks_against_pdf.py และผัง ↔ PDF ดู scripts/verify_graphs_against_pdf.py
 * (ต้องมี pdftotext จึงไม่รวมไว้ใน jest)
 *
 * ผังเป็นภาษาไทย คู่มือเป็นอังกฤษ จึงเทียบคำต่อคำไม่ได้ เทสต์นี้ตรวจ "ข้อเท็จจริงที่ไม่เปลี่ยนตามภาษา":
 * แหล่งที่มา ยี่ห้อ รุ่น เลขหน้า และชื่อหัวข้ออาการ ความถูกต้องของคำแปลและลำดับขั้นตอนต้องให้คนสุ่มตรวจ
 *
 * ข้อยกเว้นที่รู้แล้วเขียนไว้ชัดเจนด้านล่าง ถ้ามีข้อยกเว้นใหม่โผล่ เทสต์ต้องล้ม (ไม่ปล่อยผ่านเงียบๆ)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const DATA = path.resolve(__dirname, '../../../data');

interface Chunk {
  chunk_id: string;
  device_category?: string;
  brand?: string;
  model?: string;
  source?: string;
  page: number;
  content?: string | null;
  metadata?: { symptom?: string | null };
}

interface GraphNode {
  node_id: string;
  type: string;
  on_yes?: string;
  on_no?: string;
  next?: string;
}

interface Graph {
  graph_id: string;
  device_category: string;
  brand: string;
  model_pattern: string;
  entry_symptom: string;
  source: string;
  page_range: [number, number];
  source_chunk_id: string;
  entry_node: string;
  nodes: GraphNode[];
}

interface Manual {
  manual_id: string;
  source_manual: string;
  count: number;
  graphs: Graph[];
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** เทียบชื่อหัวข้อแบบไม่สนตัวพิมพ์/ช่องว่าง/เครื่องหมาย */
function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9]+/g, '');
}

// ------------------------------------------------------------------
// ข้อยกเว้นที่รู้แล้ว (ตรวจแล้วทีละรายการ)
// ------------------------------------------------------------------

/** ผังแอร์ AR70H 13 ผัง ชี้ไป chunk ที่ไม่มีไฟล์ใน data/chuck (ผังเขียนจากคู่มือหน้า 43–44 โดยตรง) → เทียบกับ chunk ไม่ได้ */
const MANUAL_WITHOUT_CHUNKS = 'samsung_ac_ar70h';

/** chunk ตั้งชื่ออาการยาวกว่าในผัง (ผังตัดวงเล็บท้ายออก) ผังต้องเป็นส่วนต้นของ chunk เท่านั้น */
const SHORTENED_SYMPTOM = new Set(['samsung_rf_sm2009_no_power', 'samsung_rf_sm2009_exhibition_mode']);

/** ชื่อประเภทเครื่องที่สองฝั่งเรียกต่างกัน (ผัง → chunk) ที่ยอมรับ */
const CATEGORY_ALIASES: Record<string, string> = { Microwave: 'Microwave Oven' };

const manualFiles = fs.readdirSync(path.join(DATA, 'manuals')).filter((f) => f.endsWith('.json')).sort();
const manuals = manualFiles.map((f) => readJson<Manual>(path.join(DATA, 'manuals', f)));
const graphs = manuals.flatMap((m) => m.graphs.map((g) => ({ manual: m, graph: g })));

const chunkIndex = new Map<string, Chunk>();
const chunkDuplicates: { id: string; same: boolean }[] = [];
for (const f of fs.readdirSync(path.join(DATA, 'chuck')).filter((n) => n.endsWith('.json')).sort()) {
  for (const chunk of readJson<Chunk[]>(path.join(DATA, 'chuck', f))) {
    const seen = chunkIndex.get(chunk.chunk_id);
    if (seen) {
      chunkDuplicates.push({ id: chunk.chunk_id, same: JSON.stringify(seen) === JSON.stringify(chunk) });
    } else {
      chunkIndex.set(chunk.chunk_id, chunk);
    }
  }
}

describe('ผังขั้นตอน ↔ chunk ต้นทาง (หลังแปลงจากคู่มือ)', () => {
  it('โหลดข้อมูลได้ครบ: 22 คู่มือ 644 ผัง', () => {
    expect(manuals).toHaveLength(22);
    expect(graphs).toHaveLength(644);
  });

  it('ภายในไฟล์ผังเดียวกัน: count ตรงจำนวนผัง, source ของทุกผังตรงกับ source_manual, graph_id ไม่ซ้ำทั้งชุด', () => {
    for (const m of manuals) {
      expect({ manual: m.manual_id, count: m.count }).toEqual({ manual: m.manual_id, count: m.graphs.length });
      for (const g of m.graphs) {
        expect({ graph: g.graph_id, source: g.source }).toEqual({ graph: g.graph_id, source: m.source_manual });
      }
    }
    const ids = graphs.map((x) => x.graph.graph_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ทุกผังชี้ chunk ที่มีอยู่จริง ยกเว้นผังแอร์ AR70H 13 ผังเท่านั้น (ไม่มีข้อยกเว้นใหม่)', () => {
    const missing = graphs.filter(({ graph }) => !chunkIndex.has(graph.source_chunk_id));
    expect(missing.every(({ manual }) => manual.manual_id === MANUAL_WITHOUT_CHUNKS)).toBe(true);
    expect(missing).toHaveLength(13);
    // ผังแอร์ทุกผังต้องอยู่ในกลุ่มนี้ (ไม่มีผังแอร์ผังไหนมี chunk ให้เทียบ — บอกกรรมการตรงๆ ว่าแอร์เทียบกับ chunk ไม่ได้)
    expect(graphs.filter(({ manual }) => manual.manual_id === MANUAL_WITHOUT_CHUNKS)).toHaveLength(13);
  });

  describe('ผังที่มี chunk ให้เทียบ (631 ผัง)', () => {
    const comparable = graphs.filter(({ graph }) => chunkIndex.has(graph.source_chunk_id));

    it('มี 631 ผัง', () => {
      expect(comparable).toHaveLength(631);
    });

    it('แหล่งที่มา (ชื่อคู่มือ) ตรงกับ chunk ทุกผัง — ชื่อนี้คือสิ่งที่หน้าจอแสดงเป็นเอกสารอ้างอิง', () => {
      const wrong = comparable.filter(({ graph }) => graph.source !== chunkIndex.get(graph.source_chunk_id)!.source);
      expect(wrong.map(({ graph }) => graph.graph_id)).toEqual([]);
    });

    it('ยี่ห้อและรุ่นตรงกับ chunk ทุกผัง', () => {
      const wrong = comparable.filter(({ graph }) => {
        const chunk = chunkIndex.get(graph.source_chunk_id)!;
        return graph.brand !== chunk.brand || graph.model_pattern !== chunk.model;
      });
      expect(wrong.map(({ graph }) => graph.graph_id)).toEqual([]);
    });

    it('ประเภทเครื่องตรงกับ chunk ทุกผัง (ยอมรับเฉพาะ Microwave ↔ Microwave Oven)', () => {
      const wrong = comparable.filter(({ graph }) => {
        const chunk = chunkIndex.get(graph.source_chunk_id)!;
        return (CATEGORY_ALIASES[graph.device_category] ?? graph.device_category) !== chunk.device_category;
      });
      expect(wrong.map(({ graph }) => graph.graph_id)).toEqual([]);
    });

    it('เลขหน้าที่ chunk อ้างอยู่ใน page_range ของผังทุกผัง — เลขหน้านี้คือสิ่งที่หน้าจอแสดงเป็นเลขหน้าอ้างอิง', () => {
      const wrong = comparable.filter(({ graph }) => {
        const { page } = chunkIndex.get(graph.source_chunk_id)!;
        return page < graph.page_range[0] || page > graph.page_range[1];
      });
      expect(wrong.map(({ graph }) => graph.graph_id)).toEqual([]);
    });

    it('ชื่อหัวข้ออาการ (entry_symptom) ตรงกับ symptom ของ chunk ทุกผัง ยกเว้น 2 ผังที่ผังตัดท้ายสั้นกว่า', () => {
      const different = comparable.filter(({ graph }) => {
        const symptom = chunkIndex.get(graph.source_chunk_id)!.metadata?.symptom;
        return normalize(graph.entry_symptom) !== normalize(symptom);
      });
      // ที่ต่างต้องเป็นรายการที่รู้แล้ว และผังต้องเป็นส่วนต้นของ chunk (ห้ามเป็นคนละเรื่อง)
      expect(different.map(({ graph }) => graph.graph_id).sort()).toEqual([...SHORTENED_SYMPTOM].sort());
      for (const { graph } of different) {
        const symptom = chunkIndex.get(graph.source_chunk_id)!.metadata?.symptom;
        expect(normalize(symptom).startsWith(normalize(graph.entry_symptom))).toBe(true);
      }
    });

    it('chunk 1 อันถูกใช้โดยผังเดียวเท่านั้น (ไม่มีสองผังอ้างข้อความเดียวกัน)', () => {
      const used = new Map<string, string[]>();
      for (const { graph } of comparable) {
        used.set(graph.source_chunk_id, [...(used.get(graph.source_chunk_id) ?? []), graph.graph_id]);
      }
      const shared = [...used.entries()].filter(([, ids]) => ids.length > 1);
      expect(shared).toEqual([]);
    });
  });

  it('chunk_id ที่ซ้ำกันในไฟล์ chunk ต้องมีเนื้อหาเหมือนกันทุกตัวอักษร (ไฟล์ซ้ำ ไม่ใช่ id ชนกัน)', () => {
    expect(chunkDuplicates.filter((d) => !d.same)).toEqual([]);
  });

  it('ทุกผัง: entry_node มีอยู่ และทุกลูกศรชี้ไปโหนดที่มีอยู่ (ผังไม่ขาดหลังแปลง)', () => {
    for (const { graph } of graphs) {
      const ids = new Set(graph.nodes.map((n) => n.node_id));
      expect({ graph: graph.graph_id, entry: ids.has(graph.entry_node) }).toEqual({ graph: graph.graph_id, entry: true });
      for (const n of graph.nodes) {
        for (const target of [n.on_yes, n.on_no, n.next]) {
          if (target !== undefined) {
            expect({ graph: graph.graph_id, node: n.node_id, target, exists: ids.has(target) }).toMatchObject({ exists: true });
          }
        }
      }
    }
  });
});
