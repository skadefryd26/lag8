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

function mockAnswer(sourceId: string, status: "investigating" | "possible_rejection" | "referred") {
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body)) as { input: string };
    assert.match(request.input, /innboPluss/);
    assert.doesNotMatch(request.input, /reise-mobil/);
    const answer = {
      message: "*Sukk.* Jeg undersøkte saken.", status, nextQuestion: status === "investigating" ? "Hva skjedde videre?" : "", rejectionHope: 43,
      claimSummary: "Fiktiv vannskade", relevantFacts: ["Vann på mobil"],
      possibleIssue: status === "possible_rejection" ? "Mulig unntak" : "", reasoningSummary: "Begrunnelsen er betinget.",
      done: status !== "investigating", sourceId, thirdParty: status === "referred" ? "Den fiktive ambassaden" : "",
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

  mockAnswer("innbo-uhell", "possible_rejection");
  const valid = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral");
  assert.equal(valid.coverage, "possible_rejection");
  assert.match(valid.source?.url ?? "", /Innbo-Pluss.*#page=4$/);
});

test("ukjent informasjon fører til fiktiv videresending, ikke avslag", async () => {
  mockAnswer("", "referred");
  const result = await investigate("Fiktiv vannskade", turns, "innboPluss", "neutral");
  assert.equal(result.coverage, "unclear");
  assert.equal(result.source, null);
  assert.equal(result.thirdParty, "Den fiktive ambassaden");
});

test("Bjarne spør videre før åtte svar", async () => {
  mockAnswer("", "investigating");
  const result = await investigate("Fiktiv vannskade", turns.slice(0, 2), "innboPluss", "neutral");
  assert.equal(result.status, "investigating");
  assert.equal(result.nextQuestion, "Hva skjedde videre?");
});
