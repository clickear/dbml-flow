import assert from "node:assert/strict";
import test from "node:test";

import { getCompositeRowsForTable } from "./composite-relations";

const compositeEdge = {
  id: "ref-1",
  source: "t-ecommerce.merchant_periods",
  target: "t-ecommerce.merchants",
  data: {
    isComposite: true,
    sourceFieldIds: [
      "f-ecommerce.merchant_periods.merchant_id",
      "f-ecommerce.merchant_periods.country_code",
    ],
    targetFieldIds: [
      "f-ecommerce.merchants.id",
      "f-ecommerce.merchants.country_code",
    ],
    sourcefieldId: "f-ecommerce.merchant_periods.merchant_id",
    targetfieldId: "f-ecommerce.merchants.id",
    ref: {} as never,
    sourceRelationType: "many" as const,
    targetRelationType: "one" as const,
  },
} as const;

test("derives one composite row for the source table", () => {
  const rows = getCompositeRowsForTable("t-ecommerce.merchant_periods", [
    compositeEdge as never,
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, "(merchant_id, country_code)");
  assert.equal(rows[0]?.edgeId, "ref-1");
  assert.equal(rows[0]?.handleId, "cr-source-ref-1");
  assert.equal(
    rows[0]?.sourceFieldId,
    "f-ecommerce.merchant_periods.merchant_id",
  );
  assert.equal(rows[0]?.targetFieldId, "f-ecommerce.merchants.id");
});

test("derives one composite row for the target table", () => {
  const rows = getCompositeRowsForTable("t-ecommerce.merchants", [
    compositeEdge as never,
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.label, "(id, country_code)");
  assert.equal(rows[0]?.edgeId, "ref-1");
  assert.equal(rows[0]?.handleId, "cr-target-ref-1");
  assert.equal(rows[0]?.sourceFieldId, "f-ecommerce.merchants.id");
  assert.equal(
    rows[0]?.targetFieldId,
    "f-ecommerce.merchant_periods.merchant_id",
  );
});
