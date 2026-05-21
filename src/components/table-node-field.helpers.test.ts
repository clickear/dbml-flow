import assert from "node:assert/strict";
import test from "node:test";

import {
  getTableFieldContentClassName,
  getTableFieldRowClassName,
  isFieldConnectedToHoveredEdge,
  isFieldRelatedToTable,
} from "./table-node-field.helpers";

test("field rows reuse the shared highlight hover color", () => {
  const className = getTableFieldRowClassName(false);

  assert.match(className, /hover:bg-\[#e0f2fe\]/);
  assert.match(className, /hover:text-\[#075985\]/);
});

test("highlighted field rows keep the shared highlight colors", () => {
  const className = getTableFieldRowClassName(true);

  assert.match(className, /bg-\[#e0f2fe\]/);
  assert.match(className, /text-\[#075985\]/);
  assert.doesNotMatch(className, /outline-primary/);
});

test("active field content uses the shared highlight text color", () => {
  const className = getTableFieldContentClassName(true);

  assert.match(className, /text-\[#075985\]/);
});

test("fields become active when a related table is hovered", () => {
  const field = {
    table: { schema: { name: "public" }, name: "orders" },
    endpoints: [
      {
        ref: {
          endpoints: [
            { schemaName: "public", tableName: "orders" },
            { schemaName: "public", tableName: "users" },
          ],
        },
      },
    ],
  };

  assert.equal(isFieldRelatedToTable(field, "t-public.users"), true);
});

test("fields become active when their own table is hovered and they have refs", () => {
  const field = {
    table: { schema: { name: "public" }, name: "orders" },
    endpoints: [
      {
        ref: {
          endpoints: [
            { schemaName: "public", tableName: "users" },
            { schemaName: "public", tableName: "orders" },
          ],
        },
      },
    ],
  };

  assert.equal(isFieldRelatedToTable(field, "t-public.orders"), true);
});

test("fields use their own schema when ref endpoints omit schema names", () => {
  const field = {
    table: { schema: { name: "ecommerce" }, name: "orders" },
    endpoints: [
      {
        ref: {
          endpoints: [
            { schemaName: null, tableName: "users" },
            { schemaName: null, tableName: "orders" },
          ],
        },
      },
    ],
  };

  assert.equal(isFieldRelatedToTable(field, "t-ecommerce.orders"), true);
});

test("fields stay idle when the hovered table is unrelated", () => {
  const field = {
    table: { schema: { name: "public" }, name: "orders" },
    endpoints: [
      {
        ref: {
          endpoints: [
            { schemaName: "public", tableName: "orders" },
            { schemaName: "public", tableName: "users" },
          ],
        },
      },
    ],
  };

  assert.equal(isFieldRelatedToTable(field, "t-public.products"), false);
});

test("fields become active when they are connected to the hovered ref edge", () => {
  const edges = [
    {
      id: "orders-users",
      data: {
        sourcefieldId: "f-public.orders.user_id",
        targetfieldId: "f-public.users.id",
      },
    },
  ];

  assert.equal(
    isFieldConnectedToHoveredEdge(
      "f-public.orders.user_id",
      edges,
      "orders-users",
    ),
    true,
  );
  assert.equal(
    isFieldConnectedToHoveredEdge("f-public.users.id", edges, "orders-users"),
    true,
  );
});

test("fields stay idle when the hovered ref edge does not include them", () => {
  const edges = [
    {
      id: "orders-users",
      data: {
        sourcefieldId: "f-public.orders.user_id",
        targetfieldId: "f-public.users.id",
      },
    },
  ];

  assert.equal(
    isFieldConnectedToHoveredEdge(
      "f-public.orders.status",
      edges,
      "orders-users",
    ),
    false,
  );
});

test("fields become active when they belong to a hovered composite edge", () => {
  const edges = [
    {
      id: "composite-edge",
      data: {
        sourcefieldId: "f-ecommerce.merchant_periods.merchant_id",
        targetfieldId: "f-ecommerce.merchants.id",
        sourceFieldIds: [
          "f-ecommerce.merchant_periods.merchant_id",
          "f-ecommerce.merchant_periods.country_code",
        ],
        targetFieldIds: [
          "f-ecommerce.merchants.id",
          "f-ecommerce.merchants.country_code",
        ],
        isComposite: true,
      },
    },
  ];

  assert.equal(
    isFieldConnectedToHoveredEdge(
      "f-ecommerce.merchant_periods.country_code",
      edges,
      "composite-edge",
    ),
    true,
  );
});
