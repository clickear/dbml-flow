import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TableCompositeRelationsView } from "./table-composite-relations-view";
import { CompositeRelationTooltipView } from "./table-tooltip/composite-relation-tooltip-view";

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
      renderTooltip={() => null}
    />,
  );

  assert.match(html, /\(merchant_id, country_code\)/);
});

test("renders composite relationship tooltip details", () => {
  const html = renderToStaticMarkup(
    <CompositeRelationTooltipView
      remoteTableName="merchants"
      fieldPairs={[
        { local: "merchant_id", remote: "id" },
        { local: "country_code", remote: "country_code" },
      ]}
    />,
  );

  assert.match(html, /Composite FK -&gt; merchants/);
  assert.match(html, /merchant_id -&gt; id/);
});
