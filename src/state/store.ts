import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  ColorMode,
  Connection,
  Edge,
  EdgeChange,
  FitView,
  Node,
  NodeChange,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  OnSelectionChangeParams,
} from "@xyflow/react";
import { flushSync } from "react-dom";
import { create } from "zustand";

import { StartupCode } from "@/components/editor/editor.constant";
import { mapDatabaseToEdges } from "@/lib/dbml/edge-dbml.parser";
import {
  buildGroupParentIndex,
  preprocessNestedTableGroups,
} from "@/lib/dbml/nested-group.parser";
import {
  extractPositions,
  parseDatabaseToGraph,
  parser,
  setPositionsInCode,
} from "@/lib/dbml/node-dmbl.parser";
import {
  buildDbmlSourceMap,
  DbmlSourceMap,
  DbmlSourceTarget,
  getRangeForTarget,
  rangeToMonacoSelection,
} from "@/lib/dbml/source-map";
import { formatDiagnosticsForMonaco } from "@/lib/editor/editor.helper";
import {
  computeEdgesRelativeData,
  EdgesRelativeData,
} from "@/lib/flow/edges.helpers";
import {
  computeRelatedGroupChanges,
  getBoundedGroups,
} from "@/lib/flow/groups.helpers";
import { expandNodesForFocus } from "@/lib/flow/focus.helpers";
import { replaceNodeData } from "@/lib/flow/nodes.helpers";
import { getLayoutedGraph } from "@/lib/layout/dagre.utils";
import { applySavedPositions, toNodeIndex } from "@/lib/layout/layout.helpers";
import { getCodeFromUrl, setCodeInUrl } from "@/lib/url.helpers";
import { toMapId } from "@/lib/utils";
import { NodePositionIndex, NodeType, NodeTypes } from "@/types/nodes.types";
import type { CompilerError, Database } from "@dbml/core";
import { debounce } from "lodash-es";
import { editor, type IPosition } from "monaco-editor";

// Helper type for parse results
type ParseResult =
  | { success: true; database: Database }
  | { success: false; error: unknown };

export type FlowFocusRequest =
  | { kind: "node"; nodeId: string; fieldId?: string }
  | {
      kind: "edge";
      edgeId?: string;
      sourceFieldId: string;
      targetFieldId: string;
    };

export type AppState = {
  // Editor State
  code: string;
  database: Database | null;
  hasTextFocus: boolean;
  editorInstance: editor.IStandaloneCodeEditor | null;
  editorModel: editor.ITextModel | null;
  sourceMap: DbmlSourceMap;
  globalError: any;
  colorMode: ColorMode;
  savePositionsInCode: boolean;
  saveCodeInUrl: boolean;
  firstRender: boolean;

  // ReactFlow state
  nodes: NodeType[];
  edges: Edge[];
  savedPositions: NodePositionIndex;
  minimap: boolean;
  edgesRelativeData: EdgesRelativeData;
  foldedIds: Set<string>;
  relationOnly: boolean;
  relationOnlyOverrides: Set<string>;
  centeredLayout: boolean;
  isExporting: boolean;
  highlightedFieldId: string | null;
  pendingFlowFocus: FlowFocusRequest | null;

  //initialisation
  initState: () => void;

  // Editor Actions
  setCode: (code: string) => void;
  setEditorTextFocus: (focus: boolean) => void;
  setEditor: (editor: editor.IStandaloneCodeEditor | null) => void;
  setEditorModel: (model: editor.ITextModel | null) => void;
  jumpToSource: (target: DbmlSourceTarget) => void;
  requestFlowFocusAtEditorPosition: (position: IPosition) => void;
  clearPendingFlowFocus: () => void;
  clearFieldHighlight: () => void;
  selectFlowTarget: (request: FlowFocusRequest) => void;
  parseDBML: (code: string) => ParseResult;
  setMarkers: (markers: editor.IMarkerData[]) => void;
  setGlobalError: (error: any) => void;
  clearMarkers: () => void;
  updateViewerFromDatabase: (
    database: Database,
    nestedGroups?: ReturnType<typeof preprocessNestedTableGroups>,
  ) => void;

  // Flow Actions
  setfirstRender: (firstRender: boolean) => void;
  setColorMode: (mode: ColorMode) => void;
  setMinimap: (minimap: boolean) => void;
  onNodesChange: OnNodesChange<NodeType>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onChange: (selected: OnSelectionChangeParams<NodeType, Edge>) => void;
  onNodeMouseEnter: (node: NodeType) => void;
  onNodeMouseLeave: (node: NodeType) => void;
  foldNode: (nodeId: string, fold: boolean) => void;
  setRelationOnly: (value: boolean) => void;
  overrideRelationOnly: (nodeId: string, value: boolean) => void;

  setSavedPositions: (nodes: Node[]) => void;
  onLayout: (direction: string, fitView: FitView) => void;
  withExportRendering: <T>(fn: () => Promise<T>) => Promise<T>;
};

const debounceTime = 600;
const setCodeInUrlDebounced = debounce(setCodeInUrl, debounceTime);
const setPositionsInCodeDebounced = debounce(
  (
    code: string,
    savedPositions: NodePositionIndex,
    setCode: (code: string) => void,
  ) => {
    const newCode = setPositionsInCode(code, savedPositions);
    setCode(newCode);
  },
  debounceTime,
);

// this is our useStore hook that we can use in our components to get parts of the store and call actions
const useStore = create<AppState>((set, get) => ({
  // -------- Initial State --------
  code: "",
  hasTextFocus: false,
  editorInstance: null,
  database: null,
  editorModel: null,
  sourceMap: buildDbmlSourceMap(""),
  globalError: null,
  colorMode: "light",
  nodes: [] as NodeType[],
  edges: [] as Edge[],
  savedPositions: {},
  foldedIds: new Set<string>(),
  relationOnly: false,
  relationOnlyOverrides: new Set<string>(),
  minimap: false,
  savePositionsInCode: true,
  saveCodeInUrl: true,
  firstRender: true,
  edgesRelativeData: {} as EdgesRelativeData,
  centeredLayout: false,
  isExporting: false,
  highlightedFieldId: null,
  pendingFlowFocus: null,
  initState: () => {
    const code = getCodeFromUrl() || StartupCode;
    set({ code, savedPositions: extractPositions(code) });
    const res = get().parseDBML(code);
    if (!res.success) return;
  },

  // -------- Editor Actions --------
  setEditor: (editorInstance) => set({ editorInstance }),
  setEditorModel: (model) => set({ editorModel: model }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setEditorTextFocus: (focus) => set({ hasTextFocus: focus }),
  setCode: (code) => {
    const { saveCodeInUrl } = get();
    if (saveCodeInUrl) setCodeInUrlDebounced(code);
    set({ code });
  },

  parseDBML: (code) => {
    const { clearMarkers, updateViewerFromDatabase, setMarkers } = get();
    set({
      globalError: null,
      savedPositions: extractPositions(code),
      sourceMap: buildDbmlSourceMap(code),
    });
    try {
      const nestedGroups = preprocessNestedTableGroups(code);
      const newDB = parser.parse(nestedGroups.sanitizedCode, "dbmlv2");
      set({ database: newDB });

      clearMarkers();
      updateViewerFromDatabase(newDB, nestedGroups);

      return { success: true, database: newDB };
    } catch (error: any) {
      if ((error as CompilerError)?.diags) {
        const markers = formatDiagnosticsForMonaco(error as CompilerError);
        setMarkers(markers);
      } else {
        console.error("Unknown error:", error);
        set({ globalError: error });
      }
      return { success: false, error };
    }
  },

  updateViewerFromDatabase: (database: Database, nestedGroups) => {
    if (!database) return;

    const { savedPositions: initialSavedPositions, setSavedPositions, centeredLayout } = get();

    const oldTableNode = get().nodes.filter((n) => n.type === NodeTypes.Table);
    const oldGroupNodes = get().nodes.filter(
      (n) => n.type === NodeTypes.TableGroup,
    );

    let { tableNodes, groupNodes } = parseDatabaseToGraph(database, nestedGroups);
    const groupParentById = buildGroupParentIndex(groupNodes);
    const edges = mapDatabaseToEdges(
      database,
      get().foldedIds,
      groupParentById,
    );
    const savedPositions = initialSavedPositions;

    if (
      oldTableNode.length !== tableNodes.length ||
      oldGroupNodes.length !== groupNodes.length
    ) {
      tableNodes = getLayoutedGraph(tableNodes, groupNodes, edges, centeredLayout);
    }

    tableNodes = applySavedPositions(tableNodes, savedPositions);

    const nodesById = toMapId([...groupNodes, ...tableNodes]) as Map<
      string,
      NodeType
    >;
    groupNodes = getBoundedGroups(groupNodes, nodesById);
    set({
      nodes: [...groupNodes, ...tableNodes],
      edges,
    });
    setSavedPositions(tableNodes);
  },

  // Editor markers management
  setGlobalError: (error) => {
    set({ globalError: error });
  },
  setMarkers: (markers) => {
    const { editorModel } = get();
    if (editorModel) {
      editor.setModelMarkers(editorModel, "owner", markers);
    }
  },

  clearMarkers: () => {
    const { editorModel } = get();
    if (editorModel) {
      editor.setModelMarkers(editorModel, "owner", []);
    }
  },

  jumpToSource: (target) => {
    const { editorInstance, sourceMap } = get();
    if (!editorInstance) return;
    const range = getRangeForTarget(sourceMap, target);
    if (!range) return;

    editorInstance.focus();
    editorInstance.revealRangeInCenter(range);
    editorInstance.setSelection(rangeToMonacoSelection(range));
    if (target.kind === "field") {
      set({ highlightedFieldId: target.id });
    }
  },

  requestFlowFocusAtEditorPosition: (position) => {
    const { sourceMap, edges } = get();
    const target = sourceMap.findTargetAtPosition(position);
    if (!target) return;

    if (target.kind === "table" || target.kind === "group") {
      set({
        pendingFlowFocus: { kind: "node", nodeId: target.id },
        highlightedFieldId: null,
      });
      return;
    }

    if (target.kind === "field") {
      set({
        pendingFlowFocus: {
          kind: "node",
          nodeId: target.tableId,
          fieldId: target.id,
        },
        highlightedFieldId: target.id,
      });
      return;
    }

    const edge = edges.find(
      (edge) =>
        edge.data?.sourcefieldId === target.sourceFieldId &&
        edge.data?.targetfieldId === target.targetFieldId,
    );
    set({
      pendingFlowFocus: {
        kind: "edge",
        edgeId: edge?.id,
        sourceFieldId: target.sourceFieldId,
        targetFieldId: target.targetFieldId,
      },
      highlightedFieldId: null,
    });
  },

  clearPendingFlowFocus: () => set({ pendingFlowFocus: null }),
  clearFieldHighlight: () => set({ highlightedFieldId: null }),
  selectFlowTarget: (request) => {
    if (request.kind === "node") {
      const expanded = expandNodesForFocus(
        get().nodes,
        get().foldedIds,
        request.nodeId,
      );
      const tableNodes = expanded.nodes.filter((n) => n.type === NodeTypes.Table);
      const groupNodes = expanded.nodes.filter(
        (n) => n.type === NodeTypes.TableGroup,
      );
      const boundedGroupNodes = getBoundedGroups(
        groupNodes,
        toMapId([...groupNodes, ...tableNodes]),
      );
      const groupParentById = buildGroupParentIndex(boundedGroupNodes);
      const database = get().database;
      const edges = database
        ? mapDatabaseToEdges(database, expanded.foldedIds, groupParentById)
        : get().edges;
      set({
        foldedIds: expanded.foldedIds,
        nodes: [...boundedGroupNodes, ...tableNodes].map((node) => ({
          ...node,
          selected: node.id === request.nodeId,
        })),
        edges: edges.map((edge) => ({
          ...edge,
          selected: false,
          animated: false,
        })),
        highlightedFieldId: request.fieldId ?? null,
      });
      return;
    }

    set({
      nodes: get().nodes.map((node) => ({
        ...node,
        selected: false,
      })),
      edges: get().edges.map((edge) => {
        const selected =
          edge.id === request.edgeId ||
          (edge.data?.sourcefieldId === request.sourceFieldId &&
            edge.data?.targetfieldId === request.targetFieldId);
        return {
          ...edge,
          selected,
          animated: selected,
        };
      }),
      highlightedFieldId: null,
    });
  },

  // -------- Flow Actions --------
  setfirstRender: (firstRender) => set({ firstRender }),
  setMinimap: (minimap) => set({ minimap }),

  foldNode: (nodeId: string, fold: boolean) => {
    const { foldedIds, nodes } = get();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      console.warn("Node not found for folding:", nodeId);
      return;
    }

    const newFoldedIds = new Set(foldedIds);
    if (fold) newFoldedIds.add(nodeId);
    else newFoldedIds.delete(nodeId);

    const newNodes = replaceNodeData(nodes, node, nodeId, {
      folded: fold,
    });
    
    const groupNodes = newNodes.filter((n) => n.type === NodeTypes.TableGroup);
    const groupParentById = buildGroupParentIndex(groupNodes);
    const edges = mapDatabaseToEdges(
      get().database!,
      newFoldedIds,
      groupParentById,
    );

    set({ foldedIds: newFoldedIds, nodes: newNodes, edges });
  },

  setRelationOnly: (value: boolean) => {
    set({
      relationOnly: value,
      relationOnlyOverrides: new Set(),
    });

    setTimeout(() => {
      const { nodes } = get();

      const tableNodes = nodes.filter((n) => n.type === NodeTypes.Table);
      const groupNodes = nodes.filter((n) => n.type === NodeTypes.TableGroup);

      const newGroupNodes = getBoundedGroups(
        groupNodes,
        toMapId([...groupNodes, ...tableNodes]),
      );

      set({ nodes: [...newGroupNodes, ...tableNodes] });
    }, 0);
  },

  overrideRelationOnly: (nodeId: string, value: boolean) => {
    const { relationOnlyOverrides } = get();

    const newOverrides = new Set(relationOnlyOverrides);
    if (value) newOverrides.add(nodeId);
    else newOverrides.delete(nodeId);

    set({ relationOnlyOverrides: newOverrides });
    //TODO optimize this
    setTimeout(() => {
      const { nodes } = get();

      const tableNodes = nodes.filter((n) => n.type === NodeTypes.Table);
      const groupNodes = nodes.filter((n) => n.type === NodeTypes.TableGroup);

      const newGroupNodes = getBoundedGroups(
        groupNodes,
        toMapId([...groupNodes, ...tableNodes]),
      );

      set({ nodes: [...newGroupNodes, ...tableNodes] });
    }, 0);
  },

  onNodesChange: (changes: NodeChange<NodeType>[]) => {
    const { nodes } = get();
    const oldNodesById = toMapId<string, NodeType>(nodes);

    const computedChanges = computeRelatedGroupChanges(changes, oldNodesById);

    let newNodes = applyNodeChanges([...changes, ...computedChanges], nodes);

    const edgesRelativeData = computeEdgesRelativeData(
      toMapId<string, NodeType>(newNodes),
      get().edges,
    );

    get().setSavedPositions(newNodes);
    set({ nodes: newNodes, edgesRelativeData });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  onChange: (selected: OnSelectionChangeParams<NodeType, Edge>) => {
    const edgesAnimated = get().edges.map((edge) => ({
      ...edge,
      animated: selected.nodes.some(
        (n) => n.id === edge.source || n.id === edge.target,
      ),
    }));

    set({ edges: edgesAnimated });
  },

  onNodeMouseEnter: (node: NodeType) => {
    node.data.hovered = true;

    //fix popup under other selected nodes when hovering a table node
    if (node.type === NodeTypes.Table) {
      document
        .querySelector(`[data-id="${node.id}"]`)
        ?.classList.add("z-2000!");
    }
  },

  onNodeMouseLeave: (node: NodeType) => {
    node.data.hovered = false;
    if (node.type === NodeTypes.Table) {
      document
        .querySelector(`[data-id="${node.id}"]`)
        ?.classList.remove("z-2000!");
    }
  },

  // Layout management
  setSavedPositions: (nodes) => {
    const savedPositions = toNodeIndex(nodes);
    const { code, database, savePositionsInCode, setCode, hasTextFocus } =
      get();
    set({ savedPositions });
    if (!hasTextFocus && savePositionsInCode && database) {
      setPositionsInCodeDebounced(code, savedPositions, setCode);
    }
  },
  onLayout: (direction, fitView) => {
    const { nodes, edges, centeredLayout } = get();

    const tableNodes = nodes.filter((n) => n.type === NodeTypes.Table);
    const groupNodes = nodes.filter((n) => n.type === NodeTypes.TableGroup);

    const newTableNodes = getLayoutedGraph(tableNodes, groupNodes, edges, centeredLayout);

    const newGroupNodes = getBoundedGroups(
      groupNodes,
      toMapId([...groupNodes, ...newTableNodes]),
    );

    set({
      nodes: [...newGroupNodes, ...newTableNodes],
    });
    get().setSavedPositions(tableNodes);
    setTimeout(() => fitView(), 0);
  },

  withExportRendering: async (fn) => {
    flushSync(() => set({ isExporting: true }));
    try {
      return await fn();
    } finally {
      flushSync(() => set({ isExporting: false }));
    }
  },
}));

useStore.getState().initState();

export default useStore;
