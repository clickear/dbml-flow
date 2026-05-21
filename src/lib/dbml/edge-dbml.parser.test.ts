import assert from "node:assert/strict";
import test from "node:test";

import { Parser } from "@dbml/core";

import { mapDatabaseToEdges } from "./edge-dbml.parser";

const parser = new Parser();

test("maps a composite foreign key into one edge with grouped field ids", () => {
  const database = parser.parse(
    `
Table ecommerce.merchants {
  id int
  country_code int
  Indexes {
    (id, country_code) [pk]
  }
}

Table ecommerce.merchant_periods {
  merchant_id int
  country_code int
}

Ref: ecommerce.merchant_periods.(merchant_id, country_code) > ecommerce.merchants.(id, country_code)
`,
    "dbmlv2",
  );

  const edges = mapDatabaseToEdges(database, new Set());

  assert.equal(edges.length, 1);
  assert.equal(edges[0]?.data.isComposite, true);
  assert.equal(edges[0]?.sourceHandle, "cr-source-1");
  assert.equal(edges[0]?.targetHandle, "cr-target-1");
  assert.deepEqual(edges[0]?.data.sourceFieldIds, [
    "f-ecommerce.merchant_periods.merchant_id",
    "f-ecommerce.merchant_periods.country_code",
  ]);
  assert.deepEqual(edges[0]?.data.targetFieldIds, [
    "f-ecommerce.merchants.id",
    "f-ecommerce.merchants.country_code",
  ]);
});

test("keeps single-column refs compatible with the existing edge data fields", () => {
  const database = parser.parse(
    `
Table users {
  id int [pk]
}

Table orders {
  user_id int
}

Ref: orders.user_id > users.id
`,
    "dbmlv2",
  );

  const edges = mapDatabaseToEdges(database, new Set());

  assert.equal(edges.length, 1);
  assert.equal(edges[0]?.data.isComposite, false);
  assert.equal(edges[0]?.sourceHandle, "f-public.orders.user_id");
  assert.equal(edges[0]?.targetHandle, "f-public.users.id");
  assert.equal(edges[0]?.data.sourcefieldId, "f-public.orders.user_id");
  assert.equal(edges[0]?.data.targetfieldId, "f-public.users.id");
  assert.deepEqual(edges[0]?.data.sourceFieldIds, ["f-public.orders.user_id"]);
  assert.deepEqual(edges[0]?.data.targetFieldIds, ["f-public.users.id"]);
});
