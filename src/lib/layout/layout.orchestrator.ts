import type { TableNodeType } from "@/types/nodes.types";
import { layoutCompactGraph } from "./compact-layout";
import { layoutElkGraph } from "./elk-layout";
import {
  applySavedPositions,
  getSavedPositionBounds,
  getUnsavedTableNodes,
  hasAnySavedPositions,
} from "./layout.helpers";
import {
  COMPACT_VERTICAL_GAP,
  LARGE_DIAGRAM_TABLE_THRESHOLD,
  type LayoutEngines,
  type LayoutGraphInput,
  type LayoutGraphResult,
} from "./layout.types";

const defaultEngines: LayoutEngines = {
  elk: layoutElkGraph,
  compact: layoutCompactGraph,
};

function getNodeHeight(node: TableNodeType) {
  return (
    node.measured?.height ??
    node.initialHeight ??
    node.data.guessedDimensions?.height ??
    36
  );
}

function appendNewTables(
  tableNodes: TableNodeType[],
  savedPositions: LayoutGraphInput["savedPositions"],
) {
  const unsavedNodes = getUnsavedTableNodes(tableNodes, savedPositions);
  if (unsavedNodes.length === 0) {
    return { tableNodes, appendedNodeIds: [] as string[] };
  }

  const savedBounds = getSavedPositionBounds(tableNodes, savedPositions);
  let nextY = savedBounds.yMax + COMPACT_VERTICAL_GAP;
  const beginX = savedBounds.xMin;
  const positions = new Map<string, { x: number; y: number }>();

  unsavedNodes.forEach((node) => {
    positions.set(node.id, { x: beginX, y: nextY });
    nextY += getNodeHeight(node) + COMPACT_VERTICAL_GAP;
  });

  return {
    tableNodes: tableNodes.map((node) => ({
      ...node,
      position: positions.get(node.id) ?? node.position,
    })),
    appendedNodeIds: unsavedNodes.map((node) => node.id),
  };
}

async function runBaseLayout(
  input: LayoutGraphInput,
  engines: LayoutEngines,
) {
  if (input.tableNodes.length === 0) {
    return {
      tableNodes: input.tableNodes,
      strategy: "compact" as const,
      mode: input.mode,
    };
  }

  if (
    input.mode === "compact" ||
    input.tableNodes.length > LARGE_DIAGRAM_TABLE_THRESHOLD
  ) {
    return {
      tableNodes: engines.compact(input.tableNodes, input.groupNodes),
      strategy: "compact" as const,
      mode: input.mode,
    };
  }

  try {
    return {
      tableNodes: await engines.elk(
        input.tableNodes,
        input.groupNodes,
        input.edges,
        input.mode,
      ),
      strategy: "elk" as const,
      mode: input.mode,
    };
  } catch (error) {
    return {
      tableNodes: engines.compact(input.tableNodes, input.groupNodes),
      strategy: "compact" as const,
      mode: input.mode,
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function layoutGraph(
  input: LayoutGraphInput,
  engines: LayoutEngines = defaultEngines,
): Promise<LayoutGraphResult> {
  const base = await runBaseLayout(input, engines);

  if (
    input.reason === "rearrange" ||
    !hasAnySavedPositions(input.savedPositions)
  ) {
    return {
      tableNodes: base.tableNodes,
      strategy: base.strategy,
      mode: base.mode,
      savedPositionsApplied: false,
      appendedNodeIds: [],
      fallbackReason: base.fallbackReason,
    };
  }

  const positioned = applySavedPositions(base.tableNodes, input.savedPositions);
  const appended = appendNewTables(positioned, input.savedPositions);

  return {
    tableNodes: appended.tableNodes,
    strategy: base.strategy,
    mode: base.mode,
    savedPositionsApplied: true,
    appendedNodeIds: appended.appendedNodeIds,
    fallbackReason: base.fallbackReason,
  };
}
