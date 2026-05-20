import assert from "node:assert/strict";
import test from "node:test";

import { preprocessNestedTableGroups } from "./nested-group.parser";
import {
  buildDbmlSourceMap,
  getGroupIdFromName,
  getRangeForTarget,
  getTableIdFromName,
} from "./source-map";

test("maps unicode table and field declarations", () => {
  const code = `Table 用户 {\n  编号 int [pk]\n  名称 varchar\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);
  const tableId = getTableIdFromName("用户");
  const fieldId = `${tableId}.编号`.replace(/^t-/, "f-");

  assert.equal(sourceMap.tables.get(tableId)?.name, "用户");
  assert.deepEqual(sourceMap.tables.get(tableId)?.nameRange, {
    startLineNumber: 1,
    startColumn: 7,
    endLineNumber: 1,
    endColumn: 9,
  });
  assert.equal(sourceMap.fields.get(fieldId)?.name, "编号");
  assert.deepEqual(sourceMap.fields.get(fieldId)?.nameRange, {
    startLineNumber: 2,
    startColumn: 3,
    endLineNumber: 2,
    endColumn: 5,
  });
});

test("maps quoted table, field, and table group names", () => {
  const code = `Table "用户资料" {\n  "用户编号" int [pk]\n}\nTableGroup "中文分组" {\n  "用户资料"\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);
  const tableId = getTableIdFromName("用户资料");
  const fieldId = `${tableId}.用户编号`.replace(/^t-/, "f-");
  const groupId = getGroupIdFromName("中文分组");

  assert.equal(sourceMap.tables.get(tableId)?.name, "用户资料");
  assert.equal(sourceMap.fields.get(fieldId)?.name, "用户编号");
  assert.equal(sourceMap.groups.get(groupId)?.name, "中文分组");
  const target = sourceMap.groupMembers[0]?.target;
  assert.equal(target?.kind, "table");
  assert.equal(target?.kind === "table" ? target.id : null, tableId);
});

test("resolves editor positions to tables, fields, groups, and group members", () => {
  const code = `Table 用户 {\n  编号 int [pk]\n}\nTableGroup 分组 {\n  用户\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);
  const tableId = getTableIdFromName("用户");
  const fieldId = `${tableId}.编号`.replace(/^t-/, "f-");
  const groupId = getGroupIdFromName("分组");

  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 1, column: 8 }), {
    kind: "table",
    id: tableId,
  });
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 2, column: 4 }), {
    kind: "field",
    id: fieldId,
    tableId,
  });
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 4, column: 13 }), {
    kind: "group",
    id: groupId,
  });
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 5, column: 4 }), {
    kind: "table",
    id: tableId,
  });
});

test("maps nested table group members with unicode names", () => {
  const code = `Table 用户 {\n  编号 int\n}\nTableGroup 分组 {\n  用户\n}\nTableGroup 父级 {\n  分组\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);
  const childGroupId = getGroupIdFromName("分组");

  assert.equal(
    sourceMap.groupMembers.find((member) => member.name === "分组")?.target
      .kind === "group"
      ? sourceMap.groupMembers.find((member) => member.name === "分组")?.target
          .id
      : null,
    childGroupId,
  );
});

test("preprocesses unicode and quoted nested table groups", () => {
  const code = `Table "用户资料" {\n  "用户编号" int\n}\nTableGroup "中文分组" {\n  "用户资料"\n}\nTableGroup "父级分组" {\n  "中文分组"\n}\n`;
  const nested = preprocessNestedTableGroups(code);

  assert.equal(nested.groups.get("中文分组")?.members[0]?.kind, "table");
  assert.equal(nested.groups.get("父级分组")?.members[0]?.kind, "group");
  assert.match(nested.sanitizedCode, /TableGroup "父级分组" \{\n  \n\}/);
});

test("maps standalone refs and inline refs when endpoints are stable", () => {
  const code = `Table 用户 {\n  编号 int [pk]\n  组织编号 int [ref: > 组织.编号]\n}\nTable 组织 {\n  编号 int [pk]\n}\nRef: 用户.编号 > 组织.编号\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.equal(sourceMap.refs.length, 2);
  const inlineRef = sourceMap.refs.find(
    (ref) => ref.sourceFieldId === "f-public.用户.组织编号",
  );
  assert.equal(inlineRef?.targetFieldId, "f-public.组织.编号");
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 8, column: 2 }), {
    kind: "edge",
    sourceFieldId: "f-public.用户.编号",
    targetFieldId: "f-public.组织.编号",
  });
});

test("finds ref ranges even when canvas edge endpoint order is reversed", () => {
  const code = `Table users {\n  id int [pk]\n  org_id int\n}\nTable orgs {\n  id int [pk]\n}\nRef: users.org_id > orgs.id\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.deepEqual(
    getRangeForTarget(sourceMap, {
      kind: "edge",
      sourceFieldId: "f-public.orgs.id",
      targetFieldId: "f-public.users.org_id",
    }),
    {
      startLineNumber: 8,
      startColumn: 1,
      endLineNumber: 8,
      endColumn: 28,
    },
  );
});

test("maps standalone refs with trailing line comments", () => {
  const code = `Table ecommerce.products {\n  id int [pk]\n  merchant_id int [not null]\n}\nTable ecommerce.merchants {\n  id int\n}\nRef: ecommerce.products.merchant_id > ecommerce.merchants.id // many-to-one\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.equal(sourceMap.refs.length, 1);
  assert.equal(sourceMap.refs[0]?.sourceFieldId, "f-ecommerce.products.merchant_id");
  assert.equal(sourceMap.refs[0]?.targetFieldId, "f-ecommerce.merchants.id");
  assert.deepEqual(
    getRangeForTarget(sourceMap, {
      kind: "edge",
      sourceFieldId: "f-ecommerce.products.merchant_id",
      targetFieldId: "f-ecommerce.merchants.id",
    }),
    {
      startLineNumber: 8,
      startColumn: 1,
      endLineNumber: 8,
      endColumn: 76,
    },
  );
});

test("maps table aliases in declarations and refs with unicode table names", () => {
  const code = `Table 中文 as f{\n  test int [not null]\n}\nTable users {\n  id int [pk]\n}\nRef: f.test - users.id\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.equal(sourceMap.tables.get("t-public.中文")?.name, "中文");
  assert.equal(sourceMap.fields.get("f-public.中文.test")?.name, "test");
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 7, column: 2 }), {
    kind: "edge",
    sourceFieldId: "f-public.中文.test",
    targetFieldId: "f-public.users.id",
  });
});

test("resolves double-clicks anywhere on table declaration lines to the table", () => {
  const code = `Table 中文 as f{\n  test int [not null]\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 1, column: 2 }), {
    kind: "table",
    id: "t-public.中文",
  });
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 1, column: 12 }), {
    kind: "table",
    id: "t-public.中文",
  });
});

test("resolves double-clicks anywhere on table group declaration lines to the group", () => {
  const code = `TableGroup 分组 [color: #79AD51] {\n  users\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 1, column: 2 }), {
    kind: "group",
    id: "g-public.分组",
  });
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 1, column: 22 }), {
    kind: "group",
    id: "g-public.分组",
  });
});

test("resolves double-clicks anywhere on field declaration lines to the field", () => {
  const code = `Table 中文 as f{\n  test int [not null]\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);
  const target = {
    kind: "field" as const,
    id: "f-public.中文.test",
    tableId: "t-public.中文",
  };

  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 2, column: 4 }), target);
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 2, column: 10 }), target);
  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 2, column: 16 }), target);
});

test("maps note declarations and resolves editor clicks to note targets", () => {
  const code = `Note note_orders {\n  '@attach table:ecommerce.orders\\n# Orders summary'\n}\n`;
  const sourceMap = buildDbmlSourceMap(code);

  assert.deepEqual(sourceMap.findTargetAtPosition({ lineNumber: 1, column: 7 }), {
    kind: "note",
    id: "n-public.note_orders",
  });
  assert.deepEqual(
    getRangeForTarget(sourceMap, { kind: "note", id: "n-public.note_orders" }),
    {
      startLineNumber: 1,
      startColumn: 6,
      endLineNumber: 1,
      endColumn: 17,
    },
  );
});
