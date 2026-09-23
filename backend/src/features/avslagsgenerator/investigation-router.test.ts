import assert from "node:assert/strict";
import { test } from "node:test";
import { validBossCase } from "./investigation-router.js";

const claim = "Fiktiv sykkel forsvant fra bakgården";

test("sjefen kan kalles inn mens Bjarne fortsatt undersøker (tom begrunnelse)", () => {
  assert.equal(validBossCase(claim, [], { message: "Registrert.", status: "investigating", reasoningSummary: "" }), true);
});

test("sjefen avviser saker uten Bjarnes melding eller med ukjent status", () => {
  assert.equal(validBossCase(claim, [], { message: "", status: "investigating", reasoningSummary: "" }), false);
  assert.equal(validBossCase(claim, [], { message: "Hei", status: "bjarne_lost", reasoningSummary: "" }), false);
  assert.equal(validBossCase(claim, [], { message: "Hei", status: "referred" }), false);
});
