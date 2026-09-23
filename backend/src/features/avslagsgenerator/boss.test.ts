import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import { investigationRouter } from "./investigation-router.js";

test("boss escalation validates the case and returns a separate structured review", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/avslagsgenerator", investigationRouter);
  app.use((_error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(502).json({ error: "Sjefen svarte ikke." });
  });
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/avslagsgenerator/escalate`;
  const nativeFetch = globalThis.fetch;
  const previousToken = process.env.AI_GATEWAY_TOKEN;
  process.env.AI_GATEWAY_TOKEN = "test-only-token";
  const payload = {
    claim: "Jeg mistet en fiktiv klokke i en putekrig.",
    turns: [{ question: "Hvordan skjedde det?", answer: "Den falt av under leken." }],
    bjarne: { message: "Jeg fant ingenting.", status: "bjarne_lost", reasoningSummary: "Ingen konkret innvending." },
  };
  let gatewayCalls = 0;
  let malformed = false;

  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://genai.gjensidige.io/")) {
      gatewayCalls++;
      const request = JSON.parse(String(init?.body));
      assert.equal(request.text.format.name, "avslagsgenerator_boss");
      assert.match(request.instructions, /Ikke dikt opp fakta/);
      assert.equal(JSON.parse(request.input.slice(request.input.indexOf("{"))).claim, payload.claim);
      return new Response(JSON.stringify({
        output: [{ content: [{ text: JSON.stringify(malformed ? { message: "Ufullstendig" } : {
          message: "Bjarne, dette var da svært lite grundig.",
          scrutiny: "Hvordan var klokken sikret?",
          conclusion: "needs_information",
        }) }] }],
      }), { status: 200 });
    }
    return nativeFetch(input, init);
  };

  try {
    const post = (body: object) => nativeFetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const invalid = await post({ ...payload, bjarne: { ...payload.bjarne, status: "fiction" } });
    assert.equal(invalid.status, 400);
    assert.equal(gatewayCalls, 0);

    const valid = await post(payload);
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), {
      message: "Bjarne, dette var da svært lite grundig.",
      scrutiny: "Hvordan var klokken sikret?",
      conclusion: "needs_information",
    });
    assert.equal(gatewayCalls, 1);

    malformed = true;
    const failed = await post(payload);
    assert.equal(failed.status, 502);
    assert.deepEqual(await failed.json(), { error: "Sjefen klarte ikke å vurdere saken akkurat nå. Prøv igjen om litt." });
    assert.equal(gatewayCalls, 2);
  } finally {
    globalThis.fetch = nativeFetch;
    if (previousToken === undefined) delete process.env.AI_GATEWAY_TOKEN;
    else process.env.AI_GATEWAY_TOKEN = previousToken;
    server.close();
    await once(server, "close");
  }
});
