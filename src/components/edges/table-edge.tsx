import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  Position,
  useInternalNode,
} from "@xyflow/react";

import useStore from "@/state/store";
import {
  InternalTableNode,
  TableEdgeData,
} from "@/types/nodes.types";
import { useMemo } from "react";
import { ERMakerLabels } from "./markers";
import { getEdgePath } from "./table-edge.helpers";
import { getTableEdgeVisualState } from "./table-edge.visuals";

export const borderRadius = 5;

function TableEdge({
  id,
  source,
  target,
  style,
  targetHandleId,
  sourceHandleId,
  markerStart,
  markerEnd,
  animated,
  selected,
  data,
}: EdgeProps) {
  const sourceTableNode = useInternalNode(source) as InternalTableNode;
  const targetTableNode = useInternalNode(target) as InternalTableNode;

  const edgesRelativeData = useStore((s) => s.edgesRelativeData);
  const isExporting = useStore((s) => s.isExporting);
  const onEdgeMouseEnter = useStore((s) => s.onEdgeMouseEnter);
  const onEdgeMouseLeave = useStore((s) => s.onEdgeMouseLeave);

  const { edgePath, labelX, labelY, sx, sy, tx, ty, sourcePos, targetPos } =
    useMemo(
      () =>
        getEdgePath(
          edgesRelativeData,
          id,
          sourceHandleId || "",
          targetHandleId || "",
          markerStart || "",
          markerEnd || "",
          sourceTableNode,
          targetTableNode,
        ),
      [sourceTableNode, targetTableNode, edgesRelativeData],
    );

  if (!edgePath) {
    return null;
  }

  const visualState = getTableEdgeVisualState({
    selected: !!selected,
    animated: !!animated,
    defaultStroke: typeof style?.stroke === "string" ? style.stroke : undefined,
  });

  return (
    <>
      <BaseEdge
        path={edgePath}
        id={id}
        strokeWidth={visualState.strokeWidth}
        style={{
          ...style,
          stroke: visualState.stroke,
        }}
        markerStart={markerStart}
        markerEnd={markerEnd}
        //cause error React does not recognize the `pathOptions` prop etc...
        // {...props}
      />
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="react-flow__edge-interaction"
        onMouseEnter={() => onEdgeMouseEnter(id)}
        onMouseLeave={() => onEdgeMouseLeave(id)}
        onDoubleClick={(event) => {
          event.stopPropagation();
          const tableEdgeData = data as TableEdgeData | undefined;
          if (!tableEdgeData?.sourcefieldId || !tableEdgeData?.targetfieldId) {
            return;
          }
          useStore.getState().jumpToSource({
            kind: "edge",
            sourceFieldId: tableEdgeData.sourcefieldId,
            targetFieldId: tableEdgeData.targetfieldId,
          });
        }}
      />
      <EdgeLabels
        edgeId={id}
        showRefName={visualState.showRefName || isExporting}
        displaySource={true}
        displayTarget={true}
        data={data}
        labelX={labelX}
        labelY={labelY}
        sx={sx}
        sy={sy}
        tx={tx}
        ty={ty}
        sourcePos={sourcePos}
        targetPos={targetPos}
      />
    </>
  );
}

export type EdgeLabelsProps = {
  edgeId: string;
  showRefName: boolean;
  displaySource: boolean;
  displayTarget: boolean;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  labelX: number;
  labelY: number;
  data: Record<string, unknown> | undefined;
  sourcePos: Position;
  targetPos: Position;
};

export function EdgeLabels({
  edgeId,
  showRefName,
  displaySource,
  displayTarget,
  sx,
  sy,
  tx,
  ty,
  labelX,
  labelY,
  data,
  sourcePos,
  targetPos,
}: EdgeLabelsProps) {
  const tableEdgeData = data as TableEdgeData;
  const ref = tableEdgeData?.ref;
  const label = ref?.name ?? "";
  const sourceLabel =
    ERMakerLabels[tableEdgeData?.sourceRelationType ?? "none"];
  const targetLabel =
    ERMakerLabels[tableEdgeData?.targetRelationType ?? "none"];

  return (
    <EdgeLabelRenderer>
      {showRefName && label ? (
        <EdgeLabel
          edgeId={edgeId}
          label={label}
          labelX={labelX}
          labelY={labelY}
        />
      ) : null}
      {displaySource && (
        <EdgeMarkerLabel
          edgeId={edgeId}
          label={sourceLabel}
          labelX={sx}
          labelY={sy}
          transX={sourcePos === Position.Right ? 0 : -100}
        />
      )}
      {displayTarget && (
        <EdgeMarkerLabel
          edgeId={edgeId}
          label={targetLabel}
          labelX={tx}
          labelY={ty}
          transX={targetPos === Position.Right ? 0 : -100}
        />
      )}
    </EdgeLabelRenderer>
  );
}

export function EdgeMarkerLabel({
  edgeId,
  label,
  labelX,
  labelY,
  transX,
}: {
  edgeId: string;
  label: string;
  labelX: number;
  labelY: number;
  transX: number;
}) {
  const onEdgeMouseEnter = useStore((s) => s.onEdgeMouseEnter);
  const onEdgeMouseLeave = useStore((s) => s.onEdgeMouseLeave);

  return (
    <div
      style={{
        position: "absolute",
        transform: `translate(${transX}%, -100%)  translate(${labelX}px,${labelY}px)`,
        padding: 0,
      }}
      className="nodrag nopan whitespace-nowrap text-[0.6rem] leading-none"
      onMouseEnter={() => onEdgeMouseEnter(edgeId)}
      onMouseLeave={() => onEdgeMouseLeave(edgeId)}
    >
      {label}
    </div>
  );
}

export function EdgeLabel({
  edgeId,
  label,
  labelX,
  labelY,
}: {
  edgeId: string;
  label: string;
  labelX: number;
  labelY: number;
}) {
  const onEdgeMouseEnter = useStore((s) => s.onEdgeMouseEnter);
  const onEdgeMouseLeave = useStore((s) => s.onEdgeMouseLeave);

  return (
    <div
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%)  translate(${labelX}px,${labelY}px)`,
      }}
      className="nodrag nopan px-1 bg-gray-100 text-gray-800 text-xs rounded-xs border border-gray-300"
      onMouseEnter={() => onEdgeMouseEnter(edgeId)}
      onMouseLeave={() => onEdgeMouseLeave(edgeId)}
    >
      {label}
    </div>
  );
}

export default TableEdge;
