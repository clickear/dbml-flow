import assert from "node:assert/strict";
import test from "node:test";

import {
  NodeTypes,
  TableEdgeTypeName,
  type GroupNodeType,
  type TableEdgeType,
  type TableNodeType,
} from "@/types/nodes.types";
import { buildElkGraph, normalizeEdgeDirection } from "./elk-layout";

function table(id: string, groupId?: string): TableNodeType {
  const tableName = id.replace("t-public.", "");
  return {
    id,
    type: NodeTypes.Table,
    position: { x: 0, y: 0 },
    initialWidth: 200,
    initialHeight: 78,
    data: {
      label: tableName,
      hovered: false,
      folded: false,
      groupId,
      table: {
        fields: [
          {
            name: "id",
            type: { type_name: "int" },
            table: { schema: { name: "public" }, name: tableName },
          },
          {
            name: "user_id",
            type: { type_name: "int" },
            table: { schema: { name: "public" }, name: tableName },
          },
        ],
      } as TableNodeType["data"]["table"],
      guessedDimensions: { width: 200, height: 78 },
    },
  };
}

function group(id: string, nodeIds: string[]): GroupNodeType {
  return {
    id,
    type: NodeTypes.TableGroup,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      hovered: false,
      folded: false,
      nodeIds,
      dimensions: { width: 0, height: 0 },
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0, width: 0, height: 0 },
    },
  };
}

function edge(
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  sourceRelationType: "one" | "many",
  targetRelationType: "one" | "many",
): TableEdgeType {
  return {
    id: `${source}-${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
    type: TableEdgeTypeName,
    data: {
      sourcefieldId: sourceHandle,
      targetfieldId: targetHandle,
      ref: {} as TableEdgeType["data"]["ref"],
      sourceRelationType,
      targetRelationType,
    },
  };
}

test("normalizes many-to-one edges from one side to many side", () => {
  assert.deepEqual(
    normalizeEdgeDirection(
      edge(
        "t-public.orders",
        "t-public.users",
        "f-public.orders.user_id",
        "f-public.users.id",
        "many",
        "one",
      ),
    ),
    {
      sourceHandle: "f-public.users.id",
      targetHandle: "f-public.orders.user_id",
    },
  );
});

test("keeps one-to-many edge direction", () => {
  assert.deepEqual(
    normalizeEdgeDirection(
      edge(
        "t-public.users",
        "t-public.orders",
        "f-public.users.id",
        "f-public.orders.user_id",
        "one",
        "many",
      ),
    ),
    {
      sourceHandle: "f-public.users.id",
      targetHandle: "f-public.orders.user_id",
    },
  );
});

test("builds layered ELK graph with field ports and group children", () => {
  const graph = buildElkGraph(
    [table("t-public.users", "g-auth"), table("t-public.orders")],
    [group("g-auth", ["t-public.users"])],
    [
      edge(
        "t-public.users",
        "t-public.orders",
        "f-public.users.id",
        "f-public.orders.user_id",
        "one",
        "many",
      ),
    ],
    "leftright",
  );

  assert.equal(graph.id, "root");
  assert.equal(graph.layoutOptions?.["elk.algorithm"], "layered");
  assert.deepEqual(graph.edges, [
    {
      id: "t-public.users-t-public.orders",
      sources: ["f-public.users.id"],
      targets: ["f-public.orders.user_id"],
    },
  ]);

  const groupNode = graph.children?.find((child) => child.id === "g-auth");
  assert.equal(groupNode?.children?.[0].id, "t-public.users");
  assert.equal(
    groupNode?.layoutOptions?.["elk.padding"],
    "[top=30,left=30,bottom=30,right=30]",
  );

  const freeTable = graph.children?.find(
    (child) => child.id === "t-public.orders",
  );
  assert.equal(
    freeTable?.ports?.some((port) => port.id === "f-public.orders.user_id"),
    true,
  );
});

test("uses force layout and east-side ports for snowflake mode", () => {
  const graph = buildElkGraph([table("t-public.users")], [], [], "snowflake");
  const users = graph.children?.find((child) => child.id === "t-public.users");

  assert.equal(graph.layoutOptions?.["elk.algorithm"], "force");
  assert.equal(
    users?.ports?.every(
      (port) => port.layoutOptions?.["elk.port.side"] === "EAST",
    ),
    true,
  );
});
