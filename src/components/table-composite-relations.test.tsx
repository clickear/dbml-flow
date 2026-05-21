import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TableCompositeRelationsView } from "./table-composite-relations-view";

globalThis.HTMLElement = class HTMLElement {} as typeof HTMLElement;

test("renders composite relationship rows with grouped labels", () => {
  const row = {
    id: "cr-t-ecommerce.merchant_periods-ref-1",
    edgeId: "ref-1",
    label: "(merchant_id, country_code)",
    localFieldIds: [
      "f-ecommerce.merchant_periods.merchant_id",
      "f-ecommerce.merchant_periods.country_code",
    ],
    sourceFieldId: "f-ecommerce.merchant_periods.merchant_id",
    targetFieldId: "f-ecommerce.merchants.id",
    handleId: "cr-source-ref-1",
    remoteTableName: "merchants",
    fieldPairs: [
      { local: "merchant_id", remote: "id" },
      { local: "country_code", remote: "country_code" },
    ],
  };

  const html = renderToStaticMarkup(
    <TableCompositeRelationsView
      rows={[row]}
      hoveredEdgeId={null}
      onEdgeMouseEnter={() => {}}
      onEdgeMouseLeave={() => {}}
      onRowDoubleClick={() => {}}
      renderHandle={(compositeRow, side) => (
        <span
          data-side={side}
          data-handle-id={compositeRow.handleId}
        />
      )}
    />,
  );

  assert.match(html, /\(merchant_id, country_code\)/);
  assert.match(html, /data-handle-id="cr-source-ref-1"/);
  assert.match(
    html,
    /data-side="left" data-handle-id="cr-source-ref-1"|data-handle-id="cr-source-ref-1" data-side="left"/,
  );
  assert.match(
    html,
    /data-side="right" data-handle-id="cr-source-ref-1"|data-handle-id="cr-source-ref-1" data-side="right"/,
  );
  assert.doesNotMatch(html, /Composite FK/);
  assert.doesNotMatch(html, /merchant_id -&gt; id/);
});
