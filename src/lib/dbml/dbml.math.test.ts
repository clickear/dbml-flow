import assert from "node:assert/strict";
import test from "node:test";

import type { Table } from "@dbml/core";
import { findClosestSize } from "./dbml.math";

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

function tableWithFieldType(typeName: string): Table {
  const table = {
    name: "events",
    note: undefined,
    indexes: [],
    fields: [],
  } as unknown as Table;

  table.fields = [
    {
      name: "payload",
      pk: false,
      unique: false,
      note: undefined,
      _enum: undefined,
      dbdefault: undefined,
      type: { type_name: typeName },
      table,
    },
  ] as Table["fields"];

  return table;
}

test("expands table width beyond preset buckets for long dictionary types", () => {
  installTextMeasurementStub();
  const table = tableWithFieldType(
    "dict<string, dict<string, dict<string, varchar(255)>>>",
  );

  assert.ok(findClosestSize(table).width > 300);
});

test("expands table width for composite relationship row labels", () => {
  installTextMeasurementStub();
  const table = tableWithFieldType("int");
  table.name = "merchant_periods";
  (
    table as unknown as { compositeRelationLabels?: string[] }
  ).compositeRelationLabels = ["(merchant_id, country_code)"];

  assert.ok(findClosestSize(table).width >= 250);
});
