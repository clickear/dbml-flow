/**
 * DBML TableGroup only allows table names. This preprocessor keeps nested group
 * members in the source model while stripping them from text sent to @dbml/core.
 */

import { NodeType, NodeTypes } from "@/types/nodes.types";
import { normalizeIdentifierText, readIdentifier, splitIdentifierPath } from "./source-map";

export type NestedGroupMember =
  | { kind: "table"; name: string }
  | { kind: "group"; name: string };

export type NestedGroupDef = {
  name: string;
  settings: string;
  members: NestedGroupMember[];
  parentGroupName?: string;
};

export type NestedGroupModel = {
  groups: Map<string, NestedGroupDef>;
  sanitizedCode: string;
};

type ParsedTableGroupBlock = {
  start: number;
  end: number;
  name: string;
  rawName: string;
  settings: string;
  body: string;
  preservedBodyLines: string[];
};

const DEFAULT_SCHEMA = "public";

export function preprocessNestedTableGroups(code: string): NestedGroupModel {
  const blocks = extractTableGroupBlocks(code);
  if (blocks.length === 0) {
    return { groups: new Map(), sanitizedCode: code };
  }

  const groups = new Map<string, NestedGroupDef>();

  for (const block of blocks) {
    groups.set(block.name, {
      name: block.name,
      settings: block.settings,
      members: parseMembers(block.body),
    });
  }

  const groupNames = new Set(groups.keys());
  for (const def of groups.values()) {
    def.members = classifyMembers(def.members, groupNames);
    for (const member of def.members) {
      if (member.kind === "group") {
        const child = groups.get(member.name);
        if (child) {
          child.parentGroupName = def.name;
        }
      }
    }
  }

  let sanitizedCode = code;
  for (const block of [...blocks].reverse()) {
    const def = groups.get(block.name)!;
    const tableMembers = def.members.filter((m) => m.kind === "table");
    const sanitizedBody = [
      ...block.preservedBodyLines,
      ...tableMembers.map((m) => formatIdentifier(m.name)),
    ].join("\n  ");
    const settingsPart = def.settings ? ` [${def.settings}]` : "";
    const replacement = `TableGroup ${block.rawName}${settingsPart} {\n  ${sanitizedBody}\n}`;
    sanitizedCode =
      sanitizedCode.slice(0, block.start) +
      replacement +
      sanitizedCode.slice(block.end);
  }

  return { groups, sanitizedCode };
}

function extractTableGroupBlocks(code: string): ParsedTableGroupBlock[] {
  const blocks: ParsedTableGroupBlock[] = [];
  const marker = /TableGroup\s+/gi;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(code)) !== null) {
    const start = match.index;
    let cursor = match.index + match[0].length;

    const nameToken = readIdentifier(code, cursor);
    if (!nameToken) continue;

    const name = splitIdentifierPath(nameToken.value).name;
    cursor = nameToken.end;

    let settings = "";
    if (code[cursor] === "[") {
      const settingsEnd = findClosingBracket(code, cursor);
      if (settingsEnd < 0) continue;
      settings = code.slice(cursor + 1, settingsEnd).trim();
      cursor = settingsEnd + 1;
    }

    while (cursor < code.length && /\s/.test(code[cursor])) cursor++;

    if (code[cursor] !== "{") continue;
    const bodyStart = cursor + 1;
    const bodyEnd = findClosingBrace(code, cursor);
    if (bodyEnd < 0) continue;

    const body = code.slice(bodyStart, bodyEnd);
    blocks.push({
      start,
      end: bodyEnd + 1,
      name,
      rawName: nameToken.raw,
      settings,
      body,
      preservedBodyLines: extractPreservedBodyLines(body),
    });
    marker.lastIndex = bodyEnd + 1;
  }

  return blocks;
}

function findClosingBracket(code: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === "[") depth++;
    else if (code[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findClosingBrace(code: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseMembers(body: string): NestedGroupMember[] {
  const withoutComments = body.replace(/\/\/[^\n]*/g, "");
  return withoutComments
    .split(/[,|\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^note\s*:/iu.test(part))
    .map((name) => ({ kind: "table" as const, name: normalizeIdentifierText(name) }));
}

function extractPreservedBodyLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^note\s*:/iu.test(line));
}

function formatIdentifier(name: string): string {
  if (/^[^\s{}[\](),|<>:"']+$/u.test(name)) return name;
  return `"${name.replace(/"/gu, '\\"')}"`;
}

export function classifyMembers(
  members: NestedGroupMember[],
  groupNames: Set<string>,
): NestedGroupMember[] {
  return members.map((member) => {
    const bare = member.name.includes(".")
      ? member.name.split(".").pop()!
      : member.name;
    if (groupNames.has(bare)) {
      return { kind: "group", name: bare };
    }
    return member;
  });
}

export function getGroupNodeId(groupName: string, schema = DEFAULT_SCHEMA): string {
  return `g-${schema}.${groupName}`;
}

export function buildGroupParentIndex(
  groupNodes: { id: string; data: { parentGroupId?: string } }[],
): Map<string, string | undefined> {
  return new Map(groupNodes.map((g) => [g.id, g.data.parentGroupId]));
}

export function isHiddenByFoldedAncestors(
  groupId: string | undefined,
  nodes: NodeType[],
  foldedIds: Set<string>,
): boolean {
  if (!groupId) {
    return false;
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let current: string | undefined = groupId;
  while (current) {
    if (foldedIds.has(current)) {
      return true;
    }
    const node = byId.get(current);
    if (node?.type === NodeTypes.TableGroup && node.data.folded) {
      return true;
    }
    current =
      node?.type === NodeTypes.TableGroup
        ? node.data.parentGroupId
        : undefined;
  }
  return false;
}

export function findOutermostFoldedGroupId(
  groupId: string | undefined,
  foldedIds: Set<string>,
  parentByGroupId: Map<string, string | undefined>,
): string | undefined {
  let current = groupId;
  let folded: string | undefined;
  while (current) {
    if (foldedIds.has(current)) {
      folded = current;
    }
    current = parentByGroupId.get(current);
  }
  return folded;
}
