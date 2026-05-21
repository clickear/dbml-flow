import assert from "node:assert/strict";
import test from "node:test";

import { Parser } from "@dbml/core";

import { preprocessNestedTableGroups } from "./nested-group.parser";
import { parseDatabaseToGraph } from "./node-dmbl.parser";

const parser = new Parser();

function installTextMeasurementStub() {
  const body = {
    appendChild() {},
    removeChild() {},
  };

  globalThis.document = {
    body,
    createElement() {
      return {
        style: {},
        textContent: "",
        get offsetWidth() {
          return this.textContent.length * 8;
        },
      };
    },
  } as unknown as Document;
}

test("maps inline TableGroup note into group node data", () => {
  installTextMeasurementStub();
  const database = parser.parse(
    `
Table users {
  id int [pk]
}

TableGroup ecommerce [note: 'Group summary', color: #20B2AA] {
  users
}
`,
    "dbmlv2",
  );

  const { groupNodes } = parseDatabaseToGraph(database);

  assert.equal(groupNodes[0]?.data.note, "Group summary");
});

test("maps block TableGroup note into group node data", () => {
  installTextMeasurementStub();
  const database = parser.parse(
    `
Table users {
  id int [pk]
}

TableGroup ecommerce {
  Note: 'Block summary'
  users
}
`,
    "dbmlv2",
  );

  const { groupNodes } = parseDatabaseToGraph(database);

  assert.equal(groupNodes[0]?.data.note, "Block summary");
});

test("keeps block TableGroup note through nested-group preprocessing", () => {
  installTextMeasurementStub();
  const nested = preprocessNestedTableGroups(`
Table users {
  id int [pk]
}

TableGroup ecommerce {
  Note: 'Block summary'
  users
}
`);
  const database = parser.parse(nested.sanitizedCode, "dbmlv2");

  const { groupNodes } = parseDatabaseToGraph(database, nested);

  assert.equal(groupNodes[0]?.data.note, "Block summary");
});
