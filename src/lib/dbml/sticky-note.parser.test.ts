import assert from "node:assert/strict";
import test from "node:test";

import { Parser } from "@dbml/core";

import { parseDatabaseToGraph } from "./node-dmbl.parser";
import {
  getNoteIdFromName,
  parseNoteAttachment,
  stripNoteAttachmentLine,
} from "./sticky-note.parser";

const parser = new Parser();

test("parses note attachment metadata from the first line only", () => {
  assert.deepEqual(
    parseNoteAttachment("@attach table:ecommerce.orders\n# Orders summary"),
    { kind: "table", targetId: "t-ecommerce.orders" },
  );
  assert.deepEqual(
    parseNoteAttachment("@attach table:orders\n# Orders summary"),
    { kind: "table", targetId: "t-public.orders" },
  );
  assert.deepEqual(
    parseNoteAttachment("@attach group:ecommerce\nBody"),
    { kind: "group", targetId: "g-public.ecommerce" },
  );
  assert.equal(parseNoteAttachment("# Orders summary"), null);
});

test("strips attachment metadata from rendered note lines", () => {
  assert.deepEqual(
    stripNoteAttachmentLine("@attach table:ecommerce.orders\n# Orders summary"),
    ["# Orders summary"],
  );
  assert.deepEqual(stripNoteAttachmentLine("Line 1\n- item"), ["Line 1", "- item"]);
});

test("maps database notes into note nodes", () => {
  const database = parser.parse(
    "Note note_orders { '@attach table:ecommerce.orders\\n# Orders summary' }",
    "dbmlv2",
  );

  const { noteNodes } = parseDatabaseToGraph(database);

  assert.equal(noteNodes.length, 1);
  assert.equal(noteNodes[0]?.id, getNoteIdFromName("note_orders"));
  assert.equal(noteNodes[0]?.data.ownerNodeId, "t-ecommerce.orders");
  assert.deepEqual(noteNodes[0]?.data.lines, ["# Orders summary"]);
});
