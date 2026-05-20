import assert from "node:assert/strict";
import test from "node:test";

import { Parser } from "@dbml/core";
import type {
  GroupNodeType,
  NoteNodeType,
  TableNodeType,
} from "@/types/nodes.types";
import { NodeTypes } from "@/types/nodes.types";
import type { NodeBounds } from "@/lib/math/math.helper";

import { parseDatabaseToGraph } from "./node-dmbl.parser";
import {
  detachNoteFromOwner,
  expandNoteToFloating,
  getNoteIdFromName,
  placeNotesNearOwners,
  parseNoteAttachment,
  stripNoteAttachmentLine,
} from "./sticky-note.parser";

const parser = new Parser();
const wideBounds: NodeBounds = {
  xMin: 0,
  xMax: 900,
  yMin: 0,
  yMax: 500,
  width: 900,
  height: 500,
};

function owner(
  id: string,
  x: number,
  y: number,
  width: number,
): TableNodeType {
  return {
    id,
    type: NodeTypes.Table,
    position: { x, y },
    data: {
      label: id,
      hovered: false,
      folded: false,
      table: {} as never,
      guessedDimensions: { width, height: 120 },
    },
    initialWidth: width,
    initialHeight: 120,
  } as TableNodeType;
}

function note(id: string, ownerNodeId: string): NoteNodeType {
  return {
    id,
    type: NodeTypes.Note,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      hovered: false,
      folded: false,
      note: {} as never,
      ownerNodeId,
      lines: ["# Summary"],
      displayMode: "expanded-floating",
      guessedDimensions: { width: 280, height: 120 },
    },
    initialWidth: 280,
    initialHeight: 120,
  } as NoteNodeType;
}

function groupOwner(
  id: string,
  x: number,
  y: number,
  width: number,
): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x, y },
    data: {
      label: id,
      hovered: false,
      folded: false,
      nodeIds: [],
      dimensions: { width, height: 240 },
      bounds: { xMin: x, xMax: x + width, yMin: y, yMax: y + 240, width, height: 240 },
    },
  } as GroupNodeType;
}

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

test("maps attached database notes into folded attached-top nodes", () => {
  const database = parser.parse(
    "Note note_orders { '@attach table:ecommerce.orders\\n# Orders summary' }",
    "dbmlv2",
  );

  const { noteNodes } = parseDatabaseToGraph(database);

  assert.equal(noteNodes.length, 1);
  assert.equal(noteNodes[0]?.id, getNoteIdFromName("note_orders"));
  assert.equal(noteNodes[0]?.data.ownerNodeId, "t-ecommerce.orders");
  assert.deepEqual(noteNodes[0]?.data.lines, ["# Orders summary"]);
  assert.equal(noteNodes[0]?.data.displayMode, "folded-attached-top");
});

test("keeps unattached database notes as floating cards", () => {
  const database = parser.parse("Note note_orders { '# Orders summary' }", "dbmlv2");

  const { noteNodes } = parseDatabaseToGraph(database);

  assert.equal(noteNodes[0]?.data.ownerNodeId, undefined);
  assert.equal(noteNodes[0]?.data.displayMode, "expanded-floating");
});

test("places attached table note bars above the owner with table width", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const placed = placeNotesNearOwners(
    [note("n-public.users_note", ownerNode.id)],
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(placed[0]?.data.displayMode, "folded-attached-top");
  assert.deepEqual(placed[0]?.position, { x: 320, y: 130 });
  assert.equal(placed[0]?.data.dockedWidth, 220);
});

test("keeps manually positioned notes out of automatic left-right re-placement", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const noteNode = {
    ...note("n-public.users_note", ownerNode.id),
    position: { x: 40, y: 40 },
  };

  const placed = placeNotesNearOwners(
    [noteNode],
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
    new Set([noteNode.id]),
  );

  assert.deepEqual(placed[0]?.position, { x: 40, y: 40 });
});

test("caps attached table-group note bar width", () => {
  const ownerNode = groupOwner("g-public.auth", 120, 180, 640);

  const placed = placeNotesNearOwners(
    [note("n-public.auth_note", ownerNode.id)],
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(placed[0]?.data.displayMode, "folded-attached-top");
  assert.equal(placed[0]?.data.dockedWidth, 320);
  assert.deepEqual(placed[0]?.position, { x: 120, y: 150 });
});

test("expanding an attached-top note places it beside the owner", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const expanded = expandNoteToFloating(
    {
      ...note("n-public.users_note", ownerNode.id),
      data: {
        ...note("n-public.users_note", ownerNode.id).data,
        folded: true,
        displayMode: "folded-attached-top",
        dockedWidth: ownerNode.initialWidth,
      },
    },
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(expanded.data.displayMode, "expanded-floating");
  assert.deepEqual(expanded.position, { x: 564, y: 176 });
});

test("collapsing an expanded attached note returns it to the owner top bar", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const placed = placeNotesNearOwners(
    [
      {
        ...note("n-public.users_note", ownerNode.id),
        position: { x: 40, y: 40 },
        data: {
          ...note("n-public.users_note", ownerNode.id).data,
          displayMode: "expanded-floating",
        },
      },
    ],
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(placed[0]?.data.displayMode, "folded-attached-top");
  assert.deepEqual(placed[0]?.position, { x: 320, y: 130 });
});

test("detaching an attached-top note turns it into a folded floating note", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const detached = detachNoteFromOwner({
    ...note("n-public.users_note", ownerNode.id),
    position: { x: 410, y: 210 },
    data: {
      ...note("n-public.users_note", ownerNode.id).data,
      folded: true,
      displayMode: "folded-attached-top",
      dockedWidth: ownerNode.initialWidth,
    },
  });

  assert.equal(detached.data.displayMode, "folded-floating");
  assert.equal(detached.data.detached, true);
  assert.equal(detached.data.ownerNodeId, ownerNode.id);
  assert.deepEqual(detached.position, { x: 410, y: 210 });
});

test("detached notes are excluded from automatic attached-top placement", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const detached = placeNotesNearOwners(
    [
      {
        ...note("n-public.users_note", ownerNode.id),
        position: { x: 410, y: 210 },
        data: {
          ...note("n-public.users_note", ownerNode.id).data,
          folded: true,
          detached: true,
          displayMode: "folded-floating",
        },
      },
    ],
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.equal(detached[0]?.data.displayMode, "folded-floating");
  assert.equal(detached[0]?.data.detached, true);
  assert.deepEqual(detached[0]?.position, { x: 410, y: 210 });
});

test("expanding a folded floating note keeps the user-moved position", () => {
  const ownerNode = owner("t-public.users", 320, 160, 220);
  const expanded = expandNoteToFloating(
    {
      ...note("n-public.users_note", ownerNode.id),
      position: { x: 48, y: 72 },
      data: {
        ...note("n-public.users_note", ownerNode.id).data,
        folded: true,
        displayMode: "folded-floating",
      },
    },
    new Map([[ownerNode.id, ownerNode]]),
    wideBounds,
  );

  assert.deepEqual(expanded.position, { x: 48, y: 72 });
  assert.equal(expanded.data.displayMode, "expanded-floating");
});
