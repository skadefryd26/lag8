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

function mockAnswer(sourceId: string, status = "possible_rejection") {
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body)) as { input: string };
    assert.match(request.input, /innboPluss/);
    assert.doesNotMatch(request.input, /reise-mobil/);
    const answer = {
       message: "*Sukk.* Jeg undersøkte saken.", status, nextQuestion: status === "investigating" ? "Hva skjedde videre?" : "", rejectionHope: 43,
      claimSummary: "Fiktiv vannskade", relevantFacts: ["Vann på mobil"],
      possibleIssue: "Mulig unntak", reasoningSummary: "Begrunnelsen er betinget.",
       done: status !== "investigating", sourceId, escalation: "Bjarne er bekymret for kaffekvaliteten.",
    };
    return new Response(JSON.stringify({ output: [{ content: [{ text: JSON.stringify(answer) }] }] }), { status: 200 });
  };
}

const turns: Turn[] = Array.from({ length: 5 }, (_, index) => ({ question: `Skadespørsmål ${index + 1}?`, answer: "Det skjedde hjemme." }));

test("mulig avslag må ha kilde fra valgt produkt", async () => {
  mockAnswer("reise-mobil");
  const invalid = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral", true);
  assert.equal(invalid.coverage, "unclear");
  assert.equal(invalid.source, null);
  assert.equal(invalid.possibleIssue, "");

  mockAnswer("innbo-uhell");
  const valid = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral", true);
  assert.equal(valid.coverage, "possible_rejection");
  assert.match(valid.source?.url ?? "", /Innbo-Pluss.*#page=4$/);
  assert.equal(valid.escalation, "");
});

test("satirisk eskalering er adskilt fra dekningsgrunnlag", async () => {
  mockAnswer("", "bjarne_lost");
  const result = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral", true);
  assert.equal(result.coverage, "possibly_covered");
  assert.equal(result.source, null);
  assert.match(result.escalation, /kaffe/);
});

test("Bjarne stiller fem skadespørsmål før personforhør", async () => {
  mockAnswer("", "investigating");
  const result = await investigate("Fiktiv vannskade", turns.slice(0, 4), "innboPluss", "neutral");
  assert.equal(result.status, "investigating");
  assert.equal(result.nextQuestion, "Hva skjedde videre?");
});
