import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/**
 * Lokale embeddinger for vektorsøk i vilkårene.
 *
 * Modellen (multilingual-e5-small, ~120 MB, forstår norsk) lastes ned fra Hugging Face første gang
 * og legges i backend/.modeller/. Alt kjører på maskinen – ingen vilkårstekst eller skademelding
 * sendes til noen embeddingtjeneste.
 */

export const embeddingModel = "Xenova/multilingual-e5-small";
const modelDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.modeller");

env.cacheDir = modelDir;
env.localModelPath = `${modelDir}/`;

let extractor: Promise<FeatureExtractionPipeline> | undefined;

function model(): Promise<FeatureExtractionPipeline> {
  extractor ??= (pipeline("feature-extraction", embeddingModel, { dtype: "q8" }) as Promise<FeatureExtractionPipeline>).catch((error) => {
    extractor = undefined;
    throw error;
  });
  return extractor;
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  const output = await (await model())(texts, { pooling: "mean", normalize: true });
  const [rows, dims] = output.dims as [number, number];
  const data = output.data as Float32Array;
  return Array.from({ length: rows }, (_, row) => data.slice(row * dims, (row + 1) * dims));
}

/** e5-modellene vil ha «passage:» foran dokumenter og «query:» foran søk. */
export async function embedPassages(texts: string[], batchSize = 16): Promise<Float32Array[]> {
  const vectors: Float32Array[] = [];
  for (let start = 0; start < texts.length; start += batchSize) {
    vectors.push(...await embed(texts.slice(start, start + batchSize).map((text) => `passage: ${text}`)));
  }
  return vectors;
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const [vector] = await embed([`query: ${text}`]);
  if (!vector) throw new Error("Embeddingmodellen returnerte ingen vektor.");
  return vector;
}

/** Vektorene er normaliserte, så prikkproduktet er cosinuslikheten. */
export function similarity(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i]! * b[i]!;
  return sum;
}
