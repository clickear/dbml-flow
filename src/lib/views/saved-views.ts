import type { Viewport } from "@xyflow/react";

import type { NodePositionIndex } from "@/types/nodes.types";

export type SavedCanvasView = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  viewport: Viewport;
  positions: NodePositionIndex;
  foldedIds: Set<string>;
  relationOnly: boolean;
  relationOnlyOverrides: Set<string>;
  hiddenNodeIds: Set<string>;
};

export const SAVED_VIEWS_STORAGE_KEY = "dbml-flow.views.v1";

export type SerializedSavedCanvasView = Omit<
  SavedCanvasView,
  "foldedIds" | "relationOnlyOverrides" | "hiddenNodeIds"
> & {
  foldedIds: string[];
  relationOnlyOverrides: string[];
  hiddenNodeIds: string[];
};

function sortStrings(values: Iterable<string>) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function serializeSavedView(
  view: SavedCanvasView,
): SerializedSavedCanvasView {
  return {
    ...view,
    foldedIds: sortStrings(view.foldedIds),
    relationOnlyOverrides: sortStrings(view.relationOnlyOverrides),
    hiddenNodeIds: sortStrings(view.hiddenNodeIds),
  };
}

export function deserializeSavedView(value: unknown): SavedCanvasView {
  const raw = value as Partial<SerializedSavedCanvasView>;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Untitled view"),
    createdAt: Number(raw.createdAt ?? Date.now()),
    updatedAt: Number(raw.updatedAt ?? Date.now()),
    viewport: raw.viewport ?? { x: 0, y: 0, zoom: 1 },
    positions: raw.positions ?? {},
    foldedIds: new Set(raw.foldedIds ?? []),
    relationOnly: Boolean(raw.relationOnly),
    relationOnlyOverrides: new Set(raw.relationOnlyOverrides ?? []),
    hiddenNodeIds: new Set(raw.hiddenNodeIds ?? []),
  };
}

export function sanitizeSavedView(
  view: SavedCanvasView,
  currentNodeIds: Set<string>,
): SavedCanvasView {
  const positions = Object.fromEntries(
    Object.entries(view.positions).filter(([id]) => currentNodeIds.has(id)),
  ) as NodePositionIndex;

  const keepCurrent = (ids: Set<string>) =>
    new Set([...ids].filter((id) => currentNodeIds.has(id)));

  return {
    ...view,
    positions,
    foldedIds: keepCurrent(view.foldedIds),
    relationOnlyOverrides: keepCurrent(view.relationOnlyOverrides),
    hiddenNodeIds: keepCurrent(view.hiddenNodeIds),
  };
}
