import type { TroubleshootingFlow } from '../state-machine/types';
export type SymptomSource = Pick<TroubleshootingFlow,
  'flow_id' | 'entry_symptom' | 'entry_symptom_th' | 'entry_symptom_aliases'>;

interface SymptomText {
  flowId: string;
  text: string;
}

export interface IndexedSymptom extends SymptomText {
  vector: ArrayLike<number>;
}

interface RankedFlow {
  flowId: string;
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

export function buildSymptomTexts(flows: SymptomSource[]): SymptomText[] {
  const result: SymptomText[] = [];

  for (const g of flows) {
    const candidates: Array<string | undefined | null> = [
      g.entry_symptom_th,
      g.entry_symptom,
      ...(g.entry_symptom_aliases ?? []),
    ];

    for (const raw of candidates) {
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (text.length > 0) {
        result.push({ flowId: g.flow_id, text });
      }
    }
  }

  return result;
}

export function rankFlows(
  queryVector: ArrayLike<number>,
  index: IndexedSymptom[],
): RankedFlow[] {
  const best = new Map<string, RankedFlow>();

  for (const item of index) {
    const score = cosineSimilarity(queryVector, item.vector);
    const current = best.get(item.flowId);
    if (current === undefined || score > current.score) {
      best.set(item.flowId, {
        flowId: item.flowId,
        score,
        matchedText: item.text,
      });
    }
  }

  return [...best.values()].sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    if (x.flowId < y.flowId) return -1;
    if (x.flowId > y.flowId) return 1;
    return 0;
  });
}

export function selectMatches(
  ranked: RankedFlow[],
  threshold: number,
  max: number,
): RankedFlow[] {
  return ranked.filter((r) => r.score >= threshold).slice(0, Math.max(0, max));
}