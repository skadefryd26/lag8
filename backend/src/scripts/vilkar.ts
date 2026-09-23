import { buildDatabase, exportMarkdown, searchVilkar } from "../features/vilkar/vilkar-db.js";

// npm run vilkar -- bygg          Bygger vilkar.db og vilkar/tekst/*.md fra PDF-ene
// npm run vilkar -- sok <tekst>   Viser hvilke utdrag Bjarne ville fått for en skademelding
const [command, ...rest] = process.argv.slice(2);

if (command === "bygg") {
  const count = await buildDatabase();
  await exportMarkdown();
  console.log(`Ferdig: ${count} utdrag i vilkar/vilkar.db, tekst i vilkar/tekst/.`);
} else if (command === "sok" && rest.length) {
  for (const hit of await searchVilkar(rest.join(" "))) {
    console.log(`\n[${hit.id}] ${hit.product}, PDF-side ${hit.page} (rrf ${hit.score.toFixed(4)}, funnet via ${hit.via.join(" + ")})\n${hit.text.slice(0, 300)}…`);
  }
} else {
  console.log("Bruk: npm run vilkar -- bygg | npm run vilkar -- sok <tekst>");
}
