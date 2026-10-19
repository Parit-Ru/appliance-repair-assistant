import type { TroubleshootingGraph } from '../traversal-engine/types';
export type SymptomSource = Pick<TroubleshootingGraph,
  'graph_id' | 'entry_symptom' | 'entry_symptom_th' | 'entry_symptom_aliases'>;

interface SymptomText {
  graphId: string;
  text: string;
}

export interface IndexedSymptom extends SymptomText {
  vector: ArrayLike<number>;
}

interface RankedGraph {
  graphId: string;
  score: number;
  matchedText: string;
}

function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: dimension mismatch (${a.length} vs ${b.length})`,
    );
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function buildSymptomTexts(graphs: SymptomSource[]): SymptomText[] {
  const result: SymptomText[] = [];

  for (const g of graphs) {
    const candidates: Array<string | undefined | null> = [
      g.entry_symptom_th,
      g.entry_symptom,
      ...(g.entry_symptom_aliases ?? []),
    ];

    for (const raw of candidates) {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text.length > 0) {
        result.push({ graphId: g.graph_id, text });
      }
    }
  }

  return result;
}

export function rankGraphs(
  queryVector: ArrayLike<number>,
  index: IndexedSymptom[],
): RankedGraph[] {
  const best = new Map<string, RankedGraph>();

  for (const item of index) {
    const score = cosineSimilarity(queryVector, item.vector);
    const current = best.get(item.graphId);
    if (current === undefined || score > current.score) {
      best.set(item.graphId, {
        graphId: item.graphId,
        score,
        matchedText: item.text,
      });
    }
  }

  return [...best.values()].sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (x.graphId < y.graphId) return -1;
    if (x.graphId > y.graphId) return 1;
    return 0;
  });
}

export function selectMatches(
  ranked: RankedGraph[],
  threshold: number,
  max: number,
): RankedGraph[] {
  return ranked.filter((r) => r.score >= threshold).slice(0, Math.max(0, max));
}