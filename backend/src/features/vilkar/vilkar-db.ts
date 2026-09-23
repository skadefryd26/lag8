import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { extractText, getDocumentProxy } from "unpdf";
import { embeddingModel, embedPassages, embedQuery, similarity } from "./vilkar-embeddings.js";

/**
 * Lokal vilkårsdatabase for Bjarne.
 *
 * PDF-ene i backend/vilkar/ blir trukket ut til tekst, delt i biter (ca. et avsnitt hver)
 * og lagt i en SQLite-fil med to søk:
 *  - FTS5-fulltekstsøk (BM25) som finner de eksakte ordene
 *  - vektorsøk (lokale embeddinger) som finner betydningen, f.eks. «tatt fra bakgården» ≈ «tyveri»
 * Resultatene flettes med Reciprocal Rank Fusion. Databasen bygges automatisk første gang den
 * trengs, og på nytt når en PDF endres.
 */

export type VilkarChunk = { id: string; product: string; file: string; page: number; text: string };
export type VilkarHit = VilkarChunk & { score: number; via: ("vektor" | "ord")[] };

export const vilkarDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../vilkar");
const databaseFile = join(vilkarDir, "vilkar.db");

/** Kjente vilkår. Bare de som faktisk ligger i vilkar/ blir lest inn. */
const knownProducts = [
  { file: "innbo.pdf", slug: "innbo", name: "Innbo Standard" },
  { file: "innbo-pluss.pdf", slug: "innbo-pluss", name: "Innbo Pluss" },
  { file: "reise.pdf", slug: "reise", name: "Reise" },
  { file: "reise-pluss.pdf", slug: "reise-pluss", name: "Reise Pluss" },
] as const;

export const products = knownProducts.filter(({ file }) => existsSync(join(vilkarDir, file)));

const targetChunkLength = 900;
const navigationLine = /^Nyheter og endringer Forsikringsoversikt/;

function cleanLines(pageText: string): string[] {
  return pageText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !navigationLine.test(line) && !/^\d{1,3}$/.test(line));
}

/** Deler en side i biter på linjegrenser, med én linje overlapp så setninger ikke kuttes bort. */
function chunkPage(lines: string[]): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const line of lines) {
    if (length + line.length > targetChunkLength && current.length) {
      chunks.push(current.join("\n"));
      current = current.slice(-1);
      length = current[0]?.length ?? 0;
    }
    current.push(line);
    length += line.length + 1;
  }
  if (current.length && (chunks.length === 0 || current.length > 1)) chunks.push(current.join("\n"));
  return chunks;
}

export async function extractChunks(): Promise<VilkarChunk[]> {
  const chunks: VilkarChunk[] = [];
  for (const product of products) {
    const pdf = await getDocumentProxy(new Uint8Array(await readFile(join(vilkarDir, product.file))));
    const { text: pages } = await extractText(pdf, { mergePages: false });
    pages.forEach((pageText, index) => {
      chunkPage(cleanLines(pageText)).forEach((text, n) => {
        chunks.push({ id: `${product.slug}-s${index + 1}-${n + 1}`, product: product.name, file: product.file, page: index + 1, text });
      });
    });
  }
  return chunks;
}

async function fingerprint(): Promise<string> {
  const parts = await Promise.all(products.map(async ({ file }) => {
    const info = await stat(join(vilkarDir, file));
    return `${file}:${info.size}:${Math.round(info.mtimeMs)}`;
  }));
  return `v2|${embeddingModel}|${parts.join("|")}`;
}

export async function buildDatabase(): Promise<number> {
  const chunks = await extractChunks();
  const started = Date.now();
  const vectors = await embedPassages(chunks.map((chunk) => `${chunk.product}: ${chunk.text}`));
  console.log(`Laget ${vectors.length} vektorer på ${Math.round((Date.now() - started) / 1000)} s.`);
  const db = new DatabaseSync(databaseFile);
  try {
    db.exec(`
      DROP TABLE IF EXISTS meta;
      DROP TABLE IF EXISTS chunks;
      DROP TABLE IF EXISTS vectors;
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE VIRTUAL TABLE chunks USING fts5(
        id UNINDEXED, product UNINDEXED, file UNINDEXED, page UNINDEXED, text,
        tokenize = "unicode61 remove_diacritics 0"
      );
      CREATE TABLE vectors (id TEXT PRIMARY KEY, vector BLOB NOT NULL);
    `);
    const insert = db.prepare("INSERT INTO chunks (id, product, file, page, text) VALUES (?, ?, ?, ?, ?)");
    const insertVector = db.prepare("INSERT INTO vectors (id, vector) VALUES (?, ?)");
    db.exec("BEGIN");
    chunks.forEach((chunk, index) => {
      insert.run(chunk.id, chunk.product, chunk.file, chunk.page, chunk.text);
      const vector = vectors[index]!;
      insertVector.run(chunk.id, new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength));
    });
    db.prepare("INSERT INTO meta (key, value) VALUES ('fingerprint', ?)").run(await fingerprint());
    db.exec("COMMIT");
  } finally {
    db.close();
  }
  vectorCache = undefined;
  return chunks.length;
}

/** Skriver vilkårene som lesbar Markdown i vilkar/tekst/, så teamet kan lese og søke i dem uten PDF. */
export async function exportMarkdown(): Promise<void> {
  const chunks = await extractChunks();
  await mkdir(join(vilkarDir, "tekst"), { recursive: true });
  for (const product of products) {
    const own = chunks.filter((chunk) => chunk.file === product.file);
    const body = own.map((chunk) => `<!-- ${chunk.id} -->\n### ${product.name}, PDF-side ${chunk.page}\n\n${chunk.text}\n`).join("\n");
    await writeFile(join(vilkarDir, "tekst", `${product.slug}.md`), `# ${product.name} – alminnelige vilkår\n\nAutomatisk uttrukket fra \`${product.file}\`. Ikke rediger for hånd; kjør \`npm run vilkar -- bygg\`.\n\n${body}`);
  }
}

let ready: Promise<DatabaseSync> | undefined;

async function openDatabase(): Promise<DatabaseSync> {
  const expected = await fingerprint();
  if (existsSync(databaseFile)) {
    const db = new DatabaseSync(databaseFile);
    try {
      const row = db.prepare("SELECT value FROM meta WHERE key = 'fingerprint'").get() as { value?: string } | undefined;
      if (row?.value === expected) return db;
    } catch {
      // Gammel eller ødelagt database – bygges på nytt under.
    }
    db.close();
  }
  const count = await buildDatabase();
  console.log(`Vilkårsdatabasen er bygget med ${count} utdrag.`);
  return new DatabaseSync(databaseFile);
}

function database(): Promise<DatabaseSync> {
  ready ??= openDatabase().catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

const stopwords = new Set(("alle andre at av bare ble bli blir da de dem den denne der det dette din dine disse du eller en er et etter for fra fikk få går ha hadde han har hele hen her hun hva hvis hvor ikke inn jeg kan kom man med meg men min mine mitt mye må nei noe noen når og også om opp oss over på sin sitt skal slik som så til under ut var ved vi vil være vært å også hadde helt bare litt veldig ganske")
  .split(" "));

/** Hverdagsord i skademeldinger → ordene vilkårene faktisk bruker. */
const synonyms: Record<string, string[]> = {
  mobil: ["mobiltelefon", "elektronisk"], telefon: ["mobiltelefon", "elektronisk"], iphone: ["mobiltelefon", "elektronisk"],
  pc: ["datautstyr", "elektronisk"], laptop: ["datautstyr", "elektronisk"], data: ["datautstyr"],
  stjålet: ["tyveri"], stjal: ["tyveri"], stjele: ["tyveri"], tyv: ["tyveri", "innbrudd"], ran: ["ran", "tyveri"], innbrudd: ["innbrudd", "tyveri"],
  mistet: ["tap", "mistet", "gjenglemt", "uhell"], glemte: ["gjenglemt"], glemt: ["gjenglemt"], borte: ["tap", "bortkommet"],
  knuste: ["plutselig", "uhell"], knust: ["plutselig", "uhell"], ødela: ["uhell", "skade"], ødelagt: ["uhell", "skade"], mugge: ["uhell"],
  vann: ["vannskade", "utstrømning"], lekkasje: ["vannskade", "utstrømning", "lekkasje"], oversvømmelse: ["naturskade", "oversvømmelse"],
  flom: ["naturskade", "flom"], storm: ["naturskade", "storm"], brann: ["brann"], røyk: ["brann", "sot"],
  sykkel: ["sykkel", "lås"], elsykkel: ["sykkel", "elsykkel"], ulåst: ["låst", "lås", "sikkerhetsforskrifter"], låst: ["låst", "lås"],
  bagasje: ["bagasje", "reisegods"], koffert: ["bagasje", "reisegods"], fly: ["forsinkelse", "reise"], forsinket: ["forsinkelse"],
  syk: ["sykdom", "behandlingsutgifter"], skadet: ["ulykke", "skade"], lege: ["behandlingsutgifter", "lege"], avlyst: ["avbestilling"],
  hund: ["dyr"], katt: ["dyr"], barn: ["barn"], full: ["beruselse", "rus"], fyll: ["beruselse", "rus"],
};

function stem(word: string): string {
  if (word.length < 6) return word;
  return word.replace(/(ene|ane|ert|ede|en|et|er|te|de|a)$/u, "");
}

export function buildMatchQuery(text: string): string {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => word.length >= 3 && !stopwords.has(word));
  const terms = new Set<string>();
  for (const word of words) {
    terms.add(stem(word));
    for (const synonym of synonyms[word] ?? []) terms.add(synonym);
  }
  return [...terms].slice(0, 40).map((term) => `"${term.replace(/"/g, "")}"*`).join(" OR ");
}

let vectorCache: { id: string; vector: Float32Array }[] | undefined;

function allVectors(db: DatabaseSync) {
  vectorCache ??= (db.prepare("SELECT id, vector FROM vectors").all() as { id: string; vector: Uint8Array }[])
    .map(({ id, vector }) => ({ id, vector: new Float32Array(vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength)) }));
  return vectorCache;
}

function keywordIds(db: DatabaseSync, text: string, limit: number): string[] {
  const query = buildMatchQuery(text);
  if (!query) return [];
  return (db.prepare("SELECT id FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks) LIMIT ?").all(query, limit) as { id: string }[])
    .map((row) => row.id);
}

async function vectorIds(db: DatabaseSync, text: string, limit: number): Promise<string[]> {
  try {
    const query = await embedQuery(text);
    return allVectors(db)
      .map(({ id, vector }) => ({ id, score: similarity(query, vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((hit) => hit.id);
  } catch (error) {
    // Uten modell (f.eks. uten nett første gang) faller vi tilbake til bare nøkkelordsøk.
    console.warn("Vektorsøk utilgjengelig, bruker bare nøkkelord:", error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Hybridsøk: vektorsøk (betydning) og BM25 (eksakte ord) flettes med Reciprocal Rank Fusion.
 * Et utdrag som havner høyt i begge listene vinner; RRF trenger ingen justering av poengskalaer.
 */
export async function searchVilkar(text: string, limit = 6): Promise<VilkarHit[]> {
  if (!text.trim()) return [];
  const db = await database();
  const pool = Math.max(limit * 3, 20);
  const [byMeaning, byWords] = await Promise.all([vectorIds(db, text, pool), keywordIds(db, text, pool)]);
  const rrfK = 60;
  const scores = new Map<string, { score: number; via: Set<"vektor" | "ord"> }>();
  const add = (ids: string[], via: "vektor" | "ord") => ids.forEach((id, rank) => {
    const entry = scores.get(id) ?? { score: 0, via: new Set() };
    entry.score += 1 / (rrfK + rank + 1);
    entry.via.add(via);
    scores.set(id, entry);
  });
  add(byMeaning, "vektor");
  add(byWords, "ord");
  const top = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);
  const chunks = await getChunks(top.map(([id]) => id));
  return top.flatMap(([id, { score, via }]) => {
    const chunk = chunks.get(id);
    return chunk ? [{ ...chunk, score, via: [...via] }] : [];
  });
}

export async function getChunks(ids: string[]): Promise<Map<string, VilkarChunk>> {
  if (!ids.length) return new Map();
  const db = await database();
  const rows = db.prepare(
    `SELECT id, product, file, page, text FROM chunks WHERE id IN (${ids.map(() => "?").join(",")})`,
  ).all(...ids) as unknown as VilkarChunk[];
  return new Map(rows.map((row) => [row.id, { ...row, page: Number(row.page) }]));
}
