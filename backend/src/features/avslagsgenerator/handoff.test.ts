import assert from "node:assert/strict";
import { after, test } from "node:test";
import { askInnboBjarne, offerInnboHandoff } from "./handoff.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.AI_GATEWAY_TOKEN;
process.env.AI_GATEWAY_TOKEN = "test-token";
after(() => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.AI_GATEWAY_TOKEN;
  else process.env.AI_GATEWAY_TOKEN = originalToken;
});

test("Innbo-Bjarne får hele samtalen, avslår bare overleveringen og kan ikke brukes om igjen", async () => {
  const claim = "Min oppdiktede sykkel ble borte på ferie";
  const turn = { question: "Var sykkelen låst?", answer: "Nei, den var ulåst." };
  const turns = [turn];
  const id = offerInnboHandoff(claim, turns, "Reise-Bjarne fant et mulig vilkår");
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(String(options?.body)) as { input: string };
    assert.ok(request.input.includes(claim));
    assert.ok(request.input.includes(turn.question));
    assert.ok(request.input.includes(turn.answer));
    assert.ok(request.input.includes("Reise-Bjarne fant et mulig vilkår"));
    return new Response(JSON.stringify({ output: [{ content: [{ text: JSON.stringify({ line: "Den ulåste sykkelen har reist videre enn papirene mine." }) }] }] }), { status: 200 });
  };
  const answer = await askInnboBjarne(id);
  assert.match(answer.line, /^BLANKT AVSLAG PÅ INTERN OVERLEVERING/);
  assert.ok(answer.context.includes(claim));
  assert.ok(answer.context.includes(turn.answer));
  await assert.rejects(askInnboBjarne(id), /gått ut/);
});
