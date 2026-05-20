import type { StickyNote } from "@dbml/core";

import { HEADER_HEIGHT, TABLE_Z_INDEX } from "@/components/table-constants";
import type { NodeBounds } from "@/lib/math/math.helper";
import { getNodeSize } from "@/lib/math/math.helper";
import {
  NodeTypes,
  type NoteAttachment,
  type NoteDisplayMode,
  type NodeType,
  type NoteNodeType,
} from "@/types/nodes.types";

const DEFAULT_SCHEMA = "public";
const DEFAULT_NOTE_WIDTH = 280;
const DEFAULT_NOTE_MIN_HEIGHT = 120;
const NOTE_LINE_HEIGHT = 24;
const NOTE_OFFSET_X = 24;
const NOTE_OFFSET_Y = 16;
const MAX_ATTACHED_GROUP_WIDTH = 320;

type FloatingPlacementSide = "left" | "right";

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
  const ownerNodeId = parseNoteAttachment(note.content ?? "")?.targetId;
  const displayMode: NoteDisplayMode = ownerNodeId
    ? "folded-attached-top"
    : "expanded-floating";

  return {
    id: getNoteIdFromName(note.name),
    type: NodeTypes.Note,
    zIndex: TABLE_Z_INDEX,
    position: { x: 0, y: 0 },
    data: {
      label: note.name,
      color: note.headerColor || "#f6e27a",
      folded: displayMode !== "expanded-floating",
      hovered: false,
      note,
      ownerNodeId,
      lines,
      displayMode,
      guessedDimensions: {
        width: DEFAULT_NOTE_WIDTH,
        height: getNoteHeight(lines),
      },
    },
    initialWidth: DEFAULT_NOTE_WIDTH,
    initialHeight: getNoteHeight(lines),
  };
}

export function setNoteDisplayMode(
  node: NoteNodeType,
  displayMode: NoteDisplayMode,
): NoteNodeType {
  return {
    ...node,
    data: {
      ...node.data,
      folded: displayMode !== "expanded-floating",
      dockedWidth:
        displayMode === "folded-attached-top"
          ? node.data.dockedWidth
          : undefined,
      displayMode,
    },
  };
}

export function isAttachedNoteNode(node: NoteNodeType) {
  return Boolean(node.data.ownerNodeId) && !node.data.detached;
}

export function detachNoteFromOwner(node: NoteNodeType): NoteNodeType {
  return setNoteDisplayMode(
    {
      ...node,
      data: {
        ...node.data,
        detached: true,
      },
    },
    "folded-floating",
  );
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

function getAttachedBarWidth(owner: NodeType, ownerWidth: number) {
  if (owner.type === NodeTypes.TableGroup) {
    return Math.min(ownerWidth, MAX_ATTACHED_GROUP_WIDTH);
  }

  return ownerWidth;
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && startB < endA;
}

function getSideAvailabilities(
  owner: NodeType,
  noteWidth: number,
  noteHeight: number,
  graphBounds: NodeBounds,
  occupiedNodes: NodeType[] = [],
) {
  const ownerSize = getOwnerSize(owner);
  const ownerLeft = owner.position.x;
  const ownerRight = owner.position.x + ownerSize.width;
  const noteTop = owner.position.y + NOTE_OFFSET_Y;
  const noteBottom = noteTop + noteHeight;

  const overlappingNodes = occupiedNodes.filter((node) => {
    if (node.id === owner.id) {
      return false;
    }
    const size = getOwnerSize(node);
    return rangesOverlap(
      noteTop,
      noteBottom,
      node.position.y,
      node.position.y + size.height,
    );
  });

  const leftBlocker = overlappingNodes
    .filter((node) => node.position.x + getOwnerSize(node).width <= ownerLeft)
    .reduce<number | null>((closest, node) => {
      const blockerRight = node.position.x + getOwnerSize(node).width;
      if (closest === null || blockerRight > closest) {
        return blockerRight;
      }
      return closest;
    }, null);

  const rightBlocker = overlappingNodes
    .filter((node) => node.position.x >= ownerRight)
    .reduce<number | null>((closest, node) => {
      const blockerLeft = node.position.x;
      if (closest === null || blockerLeft < closest) {
        return blockerLeft;
      }
      return closest;
    }, null);

  const leftBoundary = leftBlocker ?? graphBounds.xMin;
  const rightBoundary = rightBlocker ?? graphBounds.xMax;

  return {
    leftAvailable: ownerLeft - leftBoundary - NOTE_OFFSET_X,
    rightAvailable: rightBoundary - ownerRight - NOTE_OFFSET_X,
    noteWidth,
  };
}

function chooseFloatingSide({
  owner,
  noteWidth,
  noteHeight = DEFAULT_NOTE_MIN_HEIGHT,
  graphBounds,
  occupiedNodes = [],
}: {
  owner: NodeType;
  noteWidth: number;
  noteHeight?: number;
  graphBounds: NodeBounds;
  occupiedNodes?: NodeType[];
}): FloatingPlacementSide {
  const { leftAvailable, rightAvailable } = getSideAvailabilities(
    owner,
    noteWidth,
    noteHeight,
    graphBounds,
    occupiedNodes,
  );

  if (rightAvailable >= noteWidth) {
    return "right";
  }

  if (leftAvailable >= noteWidth) {
    return "left";
  }

  return rightAvailable >= leftAvailable ? "right" : "left";
}

function getFallbackGraphBounds(ownersById: Map<string, NodeType>): NodeBounds {
  const owners = [...ownersById.values()];
  if (owners.length === 0) {
    return { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 };
  }

  const bounds = owners.map((owner) => {
    const size = getOwnerSize(owner);
    return {
      xMin: owner.position.x,
      xMax: owner.position.x + size.width,
      yMin: owner.position.y,
      yMax: owner.position.y + size.height,
    };
  });

  const xMin = Math.min(...bounds.map((bound) => bound.xMin));
  const xMax = Math.max(...bounds.map((bound) => bound.xMax));
  const yMin = Math.min(...bounds.map((bound) => bound.yMin));
  const yMax = Math.max(...bounds.map((bound) => bound.yMax));

  return { xMin, xMax, yMin, yMax, width: xMax - xMin, height: yMax - yMin };
}

export function placeNotesNearOwners(
  noteNodes: NoteNodeType[],
  ownersById: Map<string, NodeType>,
  graphBounds = getFallbackGraphBounds(ownersById),
  lockedNoteIds = new Set<string>(),
) {
  return noteNodes.map((node) => {
    if (!isAttachedNoteNode(node) || lockedNoteIds.has(node.id)) {
      return node;
    }

    const owner = ownersById.get(node.data.ownerNodeId!);
    if (!owner) {
      return node;
    }

    const ownerSize = getOwnerSize(owner);
    const dockedWidth = getAttachedBarWidth(owner, ownerSize.width);

    return setNoteDisplayMode({
      ...node,
      position: {
        x: owner.position.x,
        y: owner.position.y - HEADER_HEIGHT,
      },
      data: {
        ...node.data,
        dockedWidth,
      },
    }, "folded-attached-top");
  });
}

function placeExpandedNoteBesideOwner(
  node: NoteNodeType,
  ownersById: Map<string, NodeType>,
  graphBounds = getFallbackGraphBounds(ownersById),
) {
  if (!isAttachedNoteNode(node)) {
    return setNoteDisplayMode(node, "expanded-floating");
  }

  const owner = ownersById.get(node.data.ownerNodeId!);
  if (!owner) {
    return setNoteDisplayMode(node, "expanded-floating");
  }

  const ownerSize = getOwnerSize(owner);
  const side = chooseFloatingSide({
    owner,
    noteWidth: node.data.guessedDimensions?.width ?? DEFAULT_NOTE_WIDTH,
    noteHeight: node.data.guessedDimensions?.height ?? DEFAULT_NOTE_MIN_HEIGHT,
    graphBounds,
    occupiedNodes: [...ownersById.values()],
  });

  return setNoteDisplayMode(
    {
      ...node,
      position: {
        x:
          side === "left"
            ? owner.position.x - (node.data.guessedDimensions?.width ?? DEFAULT_NOTE_WIDTH) - NOTE_OFFSET_X
            : owner.position.x + ownerSize.width + NOTE_OFFSET_X,
        y: owner.position.y + NOTE_OFFSET_Y,
      },
    },
    "expanded-floating",
  );
}

export function expandNoteToFloating(
  node: NoteNodeType,
  ownersById: Map<string, NodeType>,
  graphBounds = getFallbackGraphBounds(ownersById),
) {
  if (node.data.displayMode === "folded-attached-top") {
    return placeExpandedNoteBesideOwner(node, ownersById, graphBounds);
  }

  return setNoteDisplayMode(node, "expanded-floating");
}
