import React, { useEffect } from "react";

import useStore from "@/state/store";

import { TableNode } from "@/components/table-node";
import {
  NodeType,
  NodeTypes,
  TableEdgeType,
  TableEdgeTypeName,
} from "@/types/nodes.types";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useOnSelectionChange,
  useReactFlow,
  ViewportPortal,
} from "@xyflow/react";
import ExportImageButton from "../controls/export-image-button";
import RelationOnlyButton from "../controls/field-only-button";
import MinimapButton from "../controls/minimap-button";
import RearrangeButton from "../controls/rearrange-button";
import DevTools from "../devTools/dev-tools";
import ERMarkers from "../edges/markers";
import TableEdge from "../edges/table-edge";
import { TableGroupNode } from "../table-group-node";
import {
  getNodeCenter,
  getNodeClass,
  getNodeColor,
  getNodesCenter,
  getPanOnlyCenterOptions,
} from "./viewer.helper";

const nodeTypes = {
  [NodeTypes.Table]: TableNode,
  [NodeTypes.TableGroup]: TableGroupNode,
};

const edgeTypes = {
  [TableEdgeTypeName]: TableEdge,
};

export type FlowProps = {} & React.ComponentProps<typeof ReactFlow>;

export const minZoomLevel = 0.001;

function ERViewer({ className, ...props }: FlowProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onChange,
    minimap,
    firstRender,
    setfirstRender,
    onNodeMouseEnter,
    onNodeMouseLeave,
    hasTextFocus,
    pendingFlowFocus,
    clearPendingFlowFocus,
    selectFlowTarget,
  } = useStore();
  const { fitView, getNode, getZoom, setCenter } = useReactFlow();
  const initialized = useNodesInitialized();

  useOnSelectionChange({ onChange });

  // trigger fitview on every code change in the editor
  useEffect(() => {
    if (firstRender) {
      setTimeout(() => {
        fitView();
        setfirstRender(false);
      }, 0);
    }
  }, [initialized, firstRender, setfirstRender]);

  useEffect(() => {
    if (!pendingFlowFocus) return;
    selectFlowTarget(pendingFlowFocus);
    const centerOptions = getPanOnlyCenterOptions(getZoom());

    if (pendingFlowFocus.kind === "node") {
      const node = getNode(pendingFlowFocus.nodeId);
      if (node) {
        const center = getNodeCenter(node);
        setCenter(center.x, center.y, centerOptions);
      }
    } else {
      const edge = edges.find(
        (edge) =>
          edge.id === pendingFlowFocus.edgeId ||
          (edge.data?.sourcefieldId === pendingFlowFocus.sourceFieldId &&
            edge.data?.targetfieldId === pendingFlowFocus.targetFieldId),
      );
      if (edge) {
        const source = getNode(edge.source);
        const target = getNode(edge.target);
        const center = source && target ? getNodesCenter([source, target]) : null;
        if (center) setCenter(center.x, center.y, centerOptions);
      }
    }

    clearPendingFlowFocus();
  }, [
    clearPendingFlowFocus,
    edges,
    fitView,
    getNode,
    getZoom,
    pendingFlowFocus,
    selectFlowTarget,
    setCenter,
  ]);

  const map = minimap ? (
    <MiniMap nodeColor={getNodeColor} nodeClassName={getNodeClass} />
  ) : null;

  return (
    <ReactFlow
      className={className}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeMouseEnter={(_, node) => onNodeMouseEnter(node)}
      onNodeMouseLeave={(_, node) => onNodeMouseLeave(node)}
      onNodeDoubleClick={(_, node) => {
        useStore.getState().jumpToSource({
          kind: node.type === NodeTypes.TableGroup ? "group" : "table",
          id: node.id,
        });
      }}
      onEdgeDoubleClick={(_, edge) => {
        const data = (edge as TableEdgeType).data;
        if (!data?.sourcefieldId || !data?.targetfieldId) return;
        useStore.getState().jumpToSource({
          kind: "edge",
          sourceFieldId: data.sourcefieldId,
          targetFieldId: data.targetfieldId,
        });
      }}
      onConnect={onConnect}
      fitView
      minZoom={minZoomLevel}
      connectionMode={ConnectionMode.Loose}
      panActivationKeyCode={hasTextFocus ? null : "Space"}
      zoomOnScroll={false}
      panOnScroll
    >
      <ViewportPortal>
        <ERMarkers />
      </ViewportPortal>
      <DevTools />
      <Background />
      <Controls>
        <RearrangeButton />
        <MinimapButton />
        <RelationOnlyButton />
        <ExportImageButton />
      </Controls>
      {map}
    </ReactFlow>
  );
}

const Viewer = () => (
  <ReactFlowProvider>
    <ERViewer />
  </ReactFlowProvider>
);

export default Viewer;
