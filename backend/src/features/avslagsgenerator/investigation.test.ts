import assert from "node:assert/strict";
import { after, test } from "node:test";
import { investigate, type Turn } from "./investigation.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.AI_GATEWAY_TOKEN;
process.env.AI_GATEWAY_TOKEN = "test-token";
after(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.AI_GATEWAY_TOKEN;
  else process.env.AI_GATEWAY_TOKEN = originalToken;
});

function mockAnswer(sourceId: string, status: "investigating" | "possible_rejection" | "referred", product: "innboPluss" | "reisePluss" = "innboPluss") {
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body)) as { input: string };
    assert.ok(request.input.includes(`Valgt produkt: ${product}`));
    if (product === "innboPluss") assert.doesNotMatch(request.input, /reise-mobil/);
    else assert.doesNotMatch(request.input, /innbo-uhell/);
    const answer = {
      message: "*Sukk.* Jeg undersøkte saken.", status,
      nextQuestion: status === "investigating" ? "Hva skjedde videre?" : "",
      rejectionHope: 43, claimSummary: "Fiktiv vannskade", relevantFacts: ["Vann på mobil"],
      possibleIssue: status === "possible_rejection" ? "Mulig unntak" : "",
      reasoningSummary: "Begrunnelsen er betinget.",
      done: status !== "investigating", sourceId,
      thirdParty: status === "referred" ? "Den fiktive ambassaden" : "",
    };
    return new Response(JSON.stringify({ output: [{ content: [{ text: JSON.stringify(answer) }] }] }), { status: 200 });
  };
}

const turns: Turn[] = Array.from({ length: 8 }, (_, index) => ({ question: `Spørsmål ${index + 1}?`, answer: "En oppdiktet hendelse." }));

test("mulig avslag må ha kilde fra valgt produkt", async () => {
  mockAnswer("reise-mobil", "possible_rejection");
  const invalid = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral");
  assert.equal(invalid.status, "referred");
  assert.equal(invalid.source, null);
  assert.equal(invalid.possibleIssue, "");
  assert.equal(invalid.handoffId, null);

  mockAnswer("innbo-uhell", "possible_rejection");
  const valid = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral");
  assert.equal(valid.coverage, "possible_rejection");
  assert.match(valid.source?.url ?? "", /Innbo-Pluss.*#page=4$/);
  assert.equal(valid.handoffId, null);
});

test("kun kildebegrunnet avslag fra Reise Pluss gir overlevering", async () => {
  mockAnswer("reise-mobil", "possible_rejection", "reisePluss");
  const valid = await investigate("Fiktiv vannskade", turns, "reisePluss", "neutral");
  assert.match(valid.handoffId ?? "", /^[0-9a-f-]{36}$/);
  mockAnswer("innbo-uhell", "possible_rejection", "reisePluss");
  const invalid = await investigate("Fiktiv vannskade", turns, "reisePluss", "neutral");
  assert.equal(invalid.status, "referred");
  assert.equal(invalid.handoffId, null);
});

test("ukjent informasjon fører til fiktiv videresending, ikke avslag", async () => {
  mockAnswer("", "referred");
  const result = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral");
  assert.equal(result.coverage, "unclear");
  assert.equal(result.source, null);
  assert.equal(result.thirdParty, "Den fiktive ambassaden");
  assert.equal(result.handoffId, null);
});

test("Bjarne spør videre før åtte svar", async () => {
  mockAnswer("", "investigating");
  const result = await investigate("Fiktiv vannskade", turns.slice(0, 2), "innboPluss", "neutral");
  assert.equal(result.status, "investigating");
  assert.equal(result.nextQuestion, "Hva skjedde videre?");
  assert.equal(result.handoffId, null);
});
