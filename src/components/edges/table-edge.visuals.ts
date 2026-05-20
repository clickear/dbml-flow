export const EDGE_HIGHLIGHT_STROKE = "#075985";

export function getTableEdgeVisualState({
  selected,
  animated,
  defaultStroke,
}: {
  selected: boolean;
  animated: boolean;
  defaultStroke?: string;
}) {
  const highlighted = selected || animated;

  return {
    strokeWidth: selected ? 7 : highlighted ? 6 : 5,
    stroke: highlighted ? EDGE_HIGHLIGHT_STROKE : defaultStroke,
    showRefName: highlighted,
  };
}
