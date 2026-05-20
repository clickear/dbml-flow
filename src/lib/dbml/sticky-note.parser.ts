import type { StickyNote } from "@dbml/core";

import { TABLE_Z_INDEX } from "@/components/table-constants";
import { getNodeSize } from "@/lib/math/math.helper";
import {
  NodeTypes,
  type NoteAttachment,
  type NodeType,
  type NoteNodeType,
} from "@/types/nodes.types";

const DEFAULT_SCHEMA = "public";
const DEFAULT_NOTE_WIDTH = 280;
const DEFAULT_NOTE_MIN_HEIGHT = 120;
const NOTE_LINE_HEIGHT = 24;
const NOTE_OFFSET_X = 32;
const NOTE_OFFSET_Y = 16;

function toTargetId(prefix: "t" | "g", value: string) {
  const target = value.trim();
  if (!target) {
    return null;
  }
  return target.includes(".") ? `${prefix}-${target}` : `${prefix}-${DEFAULT_SCHEMA}.${target}`;
}

export function getNoteIdFromName(name: string, schema = DEFAULT_SCHEMA) {
  return `n-${schema}.${name}`;
}

export function parseNoteAttachment(content: string): NoteAttachment | null {
  const [firstLine] = content.split(/\r?\n/u);
  const match = firstLine?.match(/^@attach\s+(table|group):(.+)$/u);
  if (!match) {
    return null;
  }

  const kind = match[1] as NoteAttachment["kind"];
  const rawTarget = match[2] ?? "";
  const targetId = toTargetId(kind === "table" ? "t" : "g", rawTarget);
  if (!targetId) {
    return null;
  }

  return {
    kind,
    targetId,
  };
}

export function stripNoteAttachmentLine(content: string) {
  const lines = content.split(/\r?\n/u);
  if (parseNoteAttachment(content)) {
    return lines.slice(1);
  }
  return lines;
}

function getNoteHeight(lines: string[]) {
  return Math.max(DEFAULT_NOTE_MIN_HEIGHT, lines.length * NOTE_LINE_HEIGHT + 56);
}

export function mapNoteToNode(note: StickyNote): NoteNodeType {
  const lines = stripNoteAttachmentLine(note.content ?? "");

  return {
    id: getNoteIdFromName(note.name),
    type: NodeTypes.Note,
    zIndex: TABLE_Z_INDEX,
    position: { x: 0, y: 0 },
    data: {
      label: note.name,
      color: note.headerColor || "#f6e27a",
      folded: false,
      hovered: false,
      note,
      ownerNodeId: parseNoteAttachment(note.content ?? "")?.targetId,
      lines,
      guessedDimensions: {
        width: DEFAULT_NOTE_WIDTH,
        height: getNoteHeight(lines),
      },
    },
    initialWidth: DEFAULT_NOTE_WIDTH,
    initialHeight: getNoteHeight(lines),
  };
}

function getOwnerSize(node: NodeType) {
  if (node.type === NodeTypes.TableGroup) {
    return {
      width: node.data.dimensions.width,
      height: node.data.dimensions.height,
    };
  }

  return getNodeSize(node);
}

export function placeNotesNearOwners(
  noteNodes: NoteNodeType[],
  ownersById: Map<string, NodeType>,
) {
  return noteNodes.map((node) => {
    if (!node.data.ownerNodeId) {
      return node;
    }

    const owner = ownersById.get(node.data.ownerNodeId);
    if (!owner) {
      return node;
    }

    const ownerSize = getOwnerSize(owner);
    return {
      ...node,
      position: {
        x: owner.position.x + ownerSize.width + NOTE_OFFSET_X,
        y: owner.position.y + NOTE_OFFSET_Y,
      },
    };
  });
}
