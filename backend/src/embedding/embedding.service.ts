import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../common/logger';

export const EMBEDDING_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const EMBEDDING_DTYPE = 'q8';

const MODEL_CACHE_DIR = path.resolve(__dirname, '../../model');

type FeatureExtractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

export class EmbeddingService {
  private readonly logger = createLogger('EmbeddingService');
  private extractor: FeatureExtractor | null = null;
  modelFilesFoundLocally = false;

  async load(): Promise<void> {
    if (this.extractor) return;

    this.modelFilesFoundLocally = fs.existsSync(
      path.join(
        MODEL_CACHE_DIR,
        EMBEDDING_MODEL_ID,
        'onnx',
        'model_quantized.onnx',
      ),
    );

    const { pipeline, env } = await import('@huggingface/transformers');
    env.cacheDir = MODEL_CACHE_DIR;
    env.allowRemoteModels = false;

    const started = Date.now();
    this.extractor = (await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
      dtype: EMBEDDING_DTYPE,
      session_options: { intraOpNumThreads: 1 }, 
    })) as unknown as FeatureExtractor;

    this.logger.log(`โหลดโมเดลเสร็จใน ${Date.now() - started} ms`);
  }

  // แปลงข้อความเป็นเวกเตอร์ 384 มิติ 
  async embed(text: string): Promise<Float32Array> {
    if (!this.extractor) {
      throw new Error('EmbeddingService: ยังไม่ได้เรียก load()');
    }
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Float32Array.from(output.data);
  }
}