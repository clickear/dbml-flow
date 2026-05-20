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
  type Viewport,
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
import { placeNotesNearOwners } from "@/lib/dbml/sticky-note.parser";
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
import { applyEdgeInteractionState } from "@/lib/flow/edge-interactions";
import {
  computeRelatedGroupChanges,
  getBoundedGroups,
} from "@/lib/flow/groups.helpers";
import { expandNodesForFocus } from "@/lib/flow/focus.helpers";
import { replaceNodeData } from "@/lib/flow/nodes.helpers";
import { layoutGraph } from "@/lib/layout/layout.orchestrator";
import { applySavedPositions, toNodeIndex } from "@/lib/layout/layout.helpers";
import {
  DEFAULT_LAYOUT_MODE,
  type LayoutMode,
} from "@/lib/layout/layout.types";
import { getCodeFromUrl, setCodeInUrl } from "@/lib/url.helpers";
import { toMapId } from "@/lib/utils";
import {
  deserializeSavedView,
  sanitizeSavedView,
  SAVED_VIEWS_STORAGE_KEY,
  serializeSavedView,
  type SavedCanvasView,
} from "@/lib/views/saved-views";
import {
  collectHiddenNodeIds,
  toggleStructureHiddenRoot,
} from "@/lib/views/structure-tree";
import {
  NodePositionIndex,
  NodeType,
  NodeTypes,
  TableEdgeType,
} from "@/types/nodes.types";
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
  layoutMode: LayoutMode;
  isExporting: boolean;
  highlightedFieldId: string | null;
  pendingFlowFocus: FlowFocusRequest | null;
  hoveredNodeId: string | null;
  hoveredEdgeId: string | null;
  savedViews: SavedCanvasView[];
  activeViewId: string | null;
  viewDrawerOpen: boolean;
  hiddenRootNodeIds: Set<string>;
  hiddenNodeIds: Set<string>;

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
  onEdgeMouseEnter: (edgeId: string) => void;
  onEdgeMouseLeave: (edgeId: string) => void;
  foldNode: (nodeId: string, fold: boolean) => void;
  setRelationOnly: (value: boolean) => void;
  overrideRelationOnly: (nodeId: string, value: boolean) => void;

  setSavedPositions: (nodes: Node[]) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  onLayout: (fitView: FitView, mode?: LayoutMode) => void;
  withExportRendering: <T>(fn: () => Promise<T>) => Promise<T>;
  loadSavedViews: () => void;
  setViewDrawerOpen: (open: boolean) => void;
  applySavedView: (viewId: string) => SavedCanvasView | null;
  saveActiveView: (viewport: Viewport) => void;
  saveViewAs: (name: string, viewport: Viewport) => void;
  toggleNodeHidden: (nodeId: string) => void;
};

const debounceTime = 600;
let layoutRequestSeq = 0;
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

function readSavedViews(): SavedCanvasView[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const values = JSON.parse(raw) as unknown[];
    return values
      .map(deserializeSavedView)
      .filter((view) => view.id && view.name);
  } catch {
    return [];
  }
}

function writeSavedViews(views: SavedCanvasView[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SAVED_VIEWS_STORAGE_KEY,
    JSON.stringify(views.map(serializeSavedView)),
  );
}

function createViewId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `view-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function decorateEdges(
  edges: Edge[],
  nodes: NodeType[],
  hoveredNodeId: string | null,
  hoveredEdgeId: string | null,
) {
  return applyEdgeInteractionState(edges, {
    selectedNodeIds: nodes.filter((node) => node.selected).map((node) => node.id),
    selectedEdgeIds: edges.filter((edge) => edge.selected).map((edge) => edge.id),
    hoveredNodeId,
    hoveredEdgeId,
  });
}

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
  layoutMode: DEFAULT_LAYOUT_MODE,
  isExporting: false,
  highlightedFieldId: null,
  pendingFlowFocus: null,
  hoveredNodeId: null,
  hoveredEdgeId: null,
  savedViews: [],
  activeViewId: null,
  viewDrawerOpen: true,
  hiddenRootNodeIds: new Set<string>(),
  hiddenNodeIds: new Set<string>(),
  initState: () => {
    const savedViews = readSavedViews();
    const code = getCodeFromUrl() || StartupCode;
    set({
      code,
      savedPositions: extractPositions(code),
      savedViews,
      activeViewId: savedViews[0]?.id ?? null,
    });
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

    const requestId = ++layoutRequestSeq;
    const {
      savedPositions: initialSavedPositions,
      setSavedPositions,
      layoutMode,
    } = get();

    const oldTableNode = get().nodes.filter((n) => n.type === NodeTypes.Table);
    const oldGroupNodes = get().nodes.filter(
      (n) => n.type === NodeTypes.TableGroup,
    );

    const run = async () => {
      let { tableNodes, groupNodes, noteNodes } = parseDatabaseToGraph(
        database,
        nestedGroups,
      );
      const groupParentById = buildGroupParentIndex(groupNodes);
      const edges = mapDatabaseToEdges(
        database,
        get().foldedIds,
        groupParentById,
      );
      const savedPositions = initialSavedPositions;

      const shouldRunLayout =
        oldTableNode.length !== tableNodes.length ||
        oldGroupNodes.length !== groupNodes.length ||
        Object.keys(savedPositions).length === 0;

      if (shouldRunLayout) {
        const layout = await layoutGraph({
          tableNodes,
          groupNodes,
          edges,
          savedPositions,
          mode: layoutMode,
          reason: "database-update",
        });
        tableNodes = layout.tableNodes;
      } else {
        tableNodes = applySavedPositions(tableNodes, savedPositions);
      }

      if (requestId !== layoutRequestSeq) return;

      const nodesById = toMapId([...groupNodes, ...tableNodes]) as Map<
        string,
        NodeType
      >;
      groupNodes = getBoundedGroups(groupNodes, nodesById);
      const noteOwnersById = toMapId([...groupNodes, ...tableNodes]) as Map<
        string,
        NodeType
      >;
      noteNodes = applySavedPositions(
        placeNotesNearOwners(noteNodes, noteOwnersById),
        savedPositions,
      );
      const finalNodes = [...groupNodes, ...tableNodes, ...noteNodes];
      const existingNodeIds = new Set(finalNodes.map((node) => node.id));
      const hiddenRootNodeIds = new Set(
        [...get().hiddenRootNodeIds].filter((id) => existingNodeIds.has(id)),
      );

      set({
        nodes: finalNodes,
        edges: decorateEdges(
          edges,
          finalNodes,
          get().hoveredNodeId,
          get().hoveredEdgeId,
        ),
        hiddenRootNodeIds,
        hiddenNodeIds: collectHiddenNodeIds(finalNodes, hiddenRootNodeIds),
      });
      setSavedPositions([...tableNodes, ...noteNodes]);
    };

    void run();
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
      return;
    }
    set({ highlightedFieldId: null });
  },

  requestFlowFocusAtEditorPosition: (position) => {
    const { sourceMap, edges } = get();
    const target = sourceMap.findTargetAtPosition(position);
    if (!target) return;

    if (
      target.kind === "table" ||
      target.kind === "group" ||
      target.kind === "note"
    ) {
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
      const noteNodes = expanded.nodes.filter((n) => n.type === NodeTypes.Note);
      const boundedGroupNodes = getBoundedGroups(
        groupNodes,
        toMapId([...groupNodes, ...tableNodes]),
      );
      const groupParentById = buildGroupParentIndex(boundedGroupNodes);
      const database = get().database;
      const edges = database
        ? mapDatabaseToEdges(database, expanded.foldedIds, groupParentById)
        : get().edges;
      const nextNodes = [...boundedGroupNodes, ...tableNodes, ...noteNodes].map((node) => ({
        ...node,
        selected: node.id === request.nodeId,
      })) as NodeType[];
      set({
        foldedIds: expanded.foldedIds,
        nodes: nextNodes,
        edges: decorateEdges(
          edges.map((edge) => ({
            ...edge,
            selected: false,
          })),
          nextNodes,
          null,
          null,
        ),
        hoveredNodeId: null,
        hoveredEdgeId: null,
        highlightedFieldId: request.fieldId ?? null,
      });
      return;
    }

    const nodes = get().nodes.map((node) => ({
        ...node,
        selected: false,
      }));
    const edges = get().edges.map((edge) => {
      const selected =
        edge.id === request.edgeId ||
        (edge.data?.sourcefieldId === request.sourceFieldId &&
          edge.data?.targetfieldId === request.targetFieldId);
      return {
        ...edge,
        selected,
      };
    });

    set({
      nodes,
      edges: decorateEdges(edges, nodes, null, null),
      hoveredNodeId: null,
      hoveredEdgeId: null,
      highlightedFieldId: null,
    });
  },

  // -------- Flow Actions --------
  setfirstRender: (firstRender) => set({ firstRender }),
  setMinimap: (minimap) => set({ minimap }),
  loadSavedViews: () => {
    const savedViews = readSavedViews();
    set({ savedViews, activeViewId: savedViews[0]?.id ?? null });
  },
  setViewDrawerOpen: (viewDrawerOpen) => set({ viewDrawerOpen }),
  applySavedView: (viewId) => {
    const view = get().savedViews.find((item) => item.id === viewId);
    if (!view) return null;

    const currentNodeIds = new Set(get().nodes.map((node) => node.id));
    const sanitized = sanitizeSavedView(view, currentNodeIds);
    const positionedNodes = applySavedPositions(
      get().nodes,
      sanitized.positions,
    ).map((node) => ({
      ...node,
      data: {
        ...node.data,
        folded: sanitized.foldedIds.has(node.id),
      },
    })) as NodeType[];
    const tableNodes = positionedNodes.filter((n) => n.type === NodeTypes.Table);
    const groupNodes = positionedNodes.filter(
      (n) => n.type === NodeTypes.TableGroup,
    );
    const noteNodes = positionedNodes.filter((n) => n.type === NodeTypes.Note);
    const boundedGroupNodes = getBoundedGroups(
      groupNodes,
      toMapId([...groupNodes, ...tableNodes]),
    );
    const nodes = [...boundedGroupNodes, ...tableNodes, ...noteNodes];
    const groupParentById = buildGroupParentIndex(boundedGroupNodes);
    const database = get().database;
    const edges = database
      ? mapDatabaseToEdges(database, sanitized.foldedIds, groupParentById)
      : get().edges;
    const hiddenNodeIds = collectHiddenNodeIds(nodes, sanitized.hiddenNodeIds);

    set({
      activeViewId: viewId,
      nodes,
      edges: decorateEdges(
        edges,
        nodes,
        get().hoveredNodeId,
        get().hoveredEdgeId,
      ),
      foldedIds: sanitized.foldedIds,
      relationOnly: sanitized.relationOnly,
      relationOnlyOverrides: sanitized.relationOnlyOverrides,
      hiddenRootNodeIds: sanitized.hiddenNodeIds,
      hiddenNodeIds,
    });
    return sanitized;
  },
  saveActiveView: (viewport) => {
    const {
      activeViewId,
      savedViews,
      savedPositions,
      foldedIds,
      relationOnly,
      relationOnlyOverrides,
      hiddenRootNodeIds,
    } = get();
    if (!activeViewId) return;

    const now = Date.now();
    const views = savedViews.map((view) =>
      view.id === activeViewId
        ? {
            ...view,
            updatedAt: now,
            viewport,
            positions: savedPositions,
            foldedIds: new Set(foldedIds),
            relationOnly,
            relationOnlyOverrides: new Set(relationOnlyOverrides),
            hiddenNodeIds: new Set(hiddenRootNodeIds),
          }
        : view,
    );
    writeSavedViews(views);
    set({ savedViews: views });
  },
  saveViewAs: (name, viewport) => {
    const {
      savedViews,
      savedPositions,
      foldedIds,
      relationOnly,
      relationOnlyOverrides,
      hiddenRootNodeIds,
    } = get();
    const now = Date.now();
    const view: SavedCanvasView = {
      id: createViewId(),
      name: name.trim() || "Untitled view",
      createdAt: now,
      updatedAt: now,
      viewport,
      positions: savedPositions,
      foldedIds: new Set(foldedIds),
      relationOnly,
      relationOnlyOverrides: new Set(relationOnlyOverrides),
      hiddenNodeIds: new Set(hiddenRootNodeIds),
    };
    const views = [...savedViews, view];
    writeSavedViews(views);
    set({ savedViews: views, activeViewId: view.id });
  },
  toggleNodeHidden: (nodeId) => {
    const nodes = get().nodes;
    const hiddenRootNodeIds = toggleStructureHiddenRoot(
      nodes,
      get().hiddenRootNodeIds,
      nodeId,
    );
    set({
      hiddenRootNodeIds,
      hiddenNodeIds: collectHiddenNodeIds(nodes, hiddenRootNodeIds),
    });
  },

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

    set({
      foldedIds: newFoldedIds,
      nodes: newNodes,
      edges: decorateEdges(
        edges,
        newNodes,
        get().hoveredNodeId,
        get().hoveredEdgeId,
      ),
    });
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
      const noteNodes = nodes.filter((n) => n.type === NodeTypes.Note);

      const newGroupNodes = getBoundedGroups(
        groupNodes,
        toMapId([...groupNodes, ...tableNodes]),
      );

      set({ nodes: [...newGroupNodes, ...tableNodes, ...noteNodes] });
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
      const noteNodes = nodes.filter((n) => n.type === NodeTypes.Note);

      const newGroupNodes = getBoundedGroups(
        groupNodes,
        toMapId([...groupNodes, ...tableNodes]),
      );

      set({ nodes: [...newGroupNodes, ...tableNodes, ...noteNodes] });
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
    const edges = applyEdgeChanges(changes, get().edges);
    set({
      edges: decorateEdges(
        edges,
        get().nodes,
        get().hoveredNodeId,
        get().hoveredEdgeId,
      ),
    });
  },

  onConnect: (connection: Connection) => {
    const edges = addEdge(connection, get().edges);
    set({
      edges: decorateEdges(
        edges,
        get().nodes,
        get().hoveredNodeId,
        get().hoveredEdgeId,
      ),
    });
  },

  onChange: (selected: OnSelectionChangeParams<NodeType, Edge>) => {
    const edgesAnimated = applyEdgeInteractionState(get().edges, {
      selectedNodeIds: selected.nodes.map((node) => node.id),
      selectedEdgeIds: selected.edges.map((edge) => edge.id),
      hoveredNodeId: get().hoveredNodeId,
      hoveredEdgeId: get().hoveredEdgeId,
    });

    set({ edges: edgesAnimated });
  },

  onNodeMouseEnter: (node: NodeType) => {
    node.data.hovered = true;
    const hoveredNodeId = node.id;

    //fix popup under other selected nodes when hovering a table node
    if (node.type === NodeTypes.Table) {
      document
        .querySelector(`[data-id="${node.id}"]`)
        ?.classList.add("z-2000!");
    }

    set({
      hoveredNodeId,
      edges: decorateEdges(
        get().edges,
        get().nodes,
        hoveredNodeId,
        get().hoveredEdgeId,
      ),
    });
  },

  onNodeMouseLeave: (node: NodeType) => {
    node.data.hovered = false;
    if (node.type === NodeTypes.Table) {
      document
        .querySelector(`[data-id="${node.id}"]`)
        ?.classList.remove("z-2000!");
    }

    if (get().hoveredNodeId !== node.id) {
      return;
    }

    set({
      hoveredNodeId: null,
      edges: decorateEdges(get().edges, get().nodes, null, get().hoveredEdgeId),
    });
  },

  onEdgeMouseEnter: (edgeId: string) => {
    set({
      hoveredEdgeId: edgeId,
      edges: decorateEdges(get().edges, get().nodes, get().hoveredNodeId, edgeId),
    });
  },

  onEdgeMouseLeave: (edgeId: string) => {
    if (get().hoveredEdgeId !== edgeId) {
      return;
    }

    set({
      hoveredEdgeId: null,
      edges: decorateEdges(get().edges, get().nodes, get().hoveredNodeId, null),
    });
  },

  // Layout management
  setLayoutMode: (layoutMode) => set({ layoutMode }),
  setSavedPositions: (nodes) => {
    const savedPositions = toNodeIndex(nodes);
    const { code, database, savePositionsInCode, setCode, hasTextFocus } =
      get();
    set({ savedPositions });
    if (!hasTextFocus && savePositionsInCode && database) {
      setPositionsInCodeDebounced(code, savedPositions, setCode);
    }
  },
  onLayout: (fitView, mode) => {
    const requestId = ++layoutRequestSeq;
    const { nodes, edges, layoutMode } = get();
    const modeToApply = mode ?? layoutMode;

    const tableNodes = nodes.filter((n) => n.type === NodeTypes.Table);
    let groupNodes = nodes.filter((n) => n.type === NodeTypes.TableGroup);
    const noteNodes = nodes.filter((n) => n.type === NodeTypes.Note);

    const run = async () => {
      const layout = await layoutGraph({
        tableNodes,
        groupNodes,
        edges: edges as TableEdgeType[],
        savedPositions: {},
        mode: modeToApply,
        reason: "rearrange",
      });
      if (requestId !== layoutRequestSeq) return;

      const newTableNodes = layout.tableNodes;
      const newGroupNodes = getBoundedGroups(
        groupNodes,
        toMapId([...groupNodes, ...newTableNodes]),
      );

      set({
        nodes: [...newGroupNodes, ...newTableNodes, ...noteNodes],
      });
      get().setSavedPositions([...newTableNodes, ...noteNodes]);
      setTimeout(() => fitView(), 0);
    };

    void run();
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
