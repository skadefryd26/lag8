import assert from "node:assert/strict";
import { test } from "node:test";
import { clausesFor, isPolicyId, sourceFor } from "./vilkar.js";

test("hver kilde peker bare til valgt produkt og et faktisk utdrag", () => {
  for (const id of ["reisePluss", "innboPluss"] as const) {
    const clauses = clausesFor(id);
    assert.ok(clauses.length > 0);
    for (const clause of clauses) {
      const source = sourceFor(id, clause.id);
      assert.ok(source);
      assert.match(source.url, new RegExp(`#page=${clause.page}$`));
      assert.equal(source.excerpt, clause.text);
    }
  }
  assert.equal(sourceFor("innboPluss", "reise-mobil"), null);
  assert.ok(sourceFor("innboPluss", "innbo-uhell"));
  assert.equal(isPolicyId("reise"), false);
  assert.equal(isPolicyId("innbo"), false);
  assert.equal(isPolicyId("__proto__"), false);
});
