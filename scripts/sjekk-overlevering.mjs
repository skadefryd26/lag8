import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  let handoffCalls = 0;
  await page.route("**/api/avslagsgenerator/investigate", async (route) => {
    const body = route.request().postDataJSON();
    assert.equal(body.policyId, "reisePluss");
    assert.equal(body.claim, "Min fiktive sykkel forsvant på tur");
    const isVerdict = body.forceVerdict === true;
    await route.fulfill({ json: isVerdict ? {
      message: "*Sukk.* Reise-Bjarne har funnet et halmstrå.", status: "possible_rejection",
      nextQuestion: "", rejectionHope: 90, claimSummary: body.claim, relevantFacts: [body.claim],
      possibleIssue: "Et mulig unntak", reasoningSummary: "En foreløpig vurdering.", done: true,
      coverage: "possible_rejection", source: { product: "Reise Pluss", url: "https://www.gjensidige.no/#page=5", page: 5, section: "Reisegods", excerpt: "Vilkårutdrag" },
      escalation: "", handoffId: "11111111-1111-4111-8111-111111111111",
    } : {
      message: "Jeg må stille flere spørsmål.", status: "investigating", nextQuestion: `Hva skjedde i runde ${body.turns.length + 1}?`,
      rejectionHope: 80, claimSummary: body.claim, relevantFacts: [body.claim], possibleIssue: "", reasoningSummary: "",
      done: false, coverage: "investigating", source: null, escalation: "", handoffId: null,
    } });
  });
  await page.route("**/api/avslagsgenerator/handoff", async (route) => {
    handoffCalls++;
    assert.equal(route.request().postDataJSON().handoffId, "11111111-1111-4111-8111-111111111111");
    await route.fulfill({ json: { line: "BLANKT AVSLAG PÅ INTERN OVERLEVERING. Sykkelen er en sak for Reise-Bjarne.", context: "Skademelding: Min fiktive sykkel forsvant på tur" } });
  });
  await page.goto("http://localhost:5173/");
  await page.getByText("Reise Pluss", { exact: true }).click();
  await page.getByLabel("Hva har skjedd?").fill("Min fiktive sykkel forsvant på tur");
  await page.getByRole("button", { name: /La Bjarne undersøke saken/ }).click();
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Svar på Bjarnes spørsmål").fill(`Fiktivt svar ${i + 1}`);
    await page.getByRole("button", { name: /Send svar/ }).click();
    await page.getByText(`Hva skjedde i runde ${i + 2}?`).waitFor();
  }
  await page.getByRole("button", { name: /Krev en dom fra Bjarne nå/ }).click();
  await page.getByRole("button", { name: /Send saken til Innbo-Bjarne/ }).click();
  await page.getByLabel("Svar fra Innbo-Bjarne").getByText(/Sykkelen er en sak for Reise-Bjarne/).waitFor();
  assert.equal(handoffCalls, 1);
  assert.match(await page.getByLabel("Svar fra Innbo-Bjarne").innerText(), /Min fiktive sykkel forsvant på tur/);
  console.log("Reise-Bjarne kan sende saken til Innbo-Bjarne med synlig kontekst.");
} finally {
  await browser.close();
}
