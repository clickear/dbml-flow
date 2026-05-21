import type { ISelection } from "monaco-editor";

import { getNoteIdFromName } from "./sticky-note.parser";

const DEFAULT_SCHEMA = "public";

export type SourceRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type SourcePosition = {
  lineNumber: number;
  column: number;
};

export type DbmlSourceTarget =
  | { kind: "table"; id: string }
  | { kind: "field"; id: string; tableId: string }
  | { kind: "group"; id: string }
  | { kind: "note"; id: string }
  | { kind: "edge"; sourceFieldId: string; targetFieldId: string };

export type SourceTable = {
  id: string;
  name: string;
  schema: string;
  nameRange: SourceRange;
  declarationRange: SourceRange;
  blockRange: SourceRange;
  bodyStart: number;
  bodyEnd: number;
};

export type SourceField = {
  id: string;
  tableId: string;
  name: string;
  nameRange: SourceRange;
  lineRange: SourceRange;
};

export type SourceGroup = {
  id: string;
  name: string;
  schema: string;
  nameRange: SourceRange;
  declarationRange: SourceRange;
  blockRange: SourceRange;
  bodyStart: number;
  bodyEnd: number;
};

export type SourceNote = {
  id: string;
  name: string;
  schema: string;
  nameRange: SourceRange;
  declarationRange: SourceRange;
  blockRange: SourceRange;
};

export type SourceGroupMember = {
  name: string;
  nameRange: SourceRange;
  target: DbmlSourceTarget;
};

export type SourceRef = {
  range: SourceRange;
  sourceFieldId: string;
  targetFieldId: string;
};

export type DbmlSourceMap = {
  code: string;
  tables: Map<string, SourceTable>;
  fields: Map<string, SourceField>;
  groups: Map<string, SourceGroup>;
  notes: Map<string, SourceNote>;
  groupMembers: SourceGroupMember[];
  refs: SourceRef[];
  findTargetAtPosition: (position: SourcePosition) => DbmlSourceTarget | null;
};

type IdentifierToken = {
  raw: string;
  value: string;
  start: number;
  end: number;
};

type ParsedBlock = {
  kind: "table" | "group" | "note";
  name: IdentifierToken;
  alias?: IdentifierToken;
  schema: string;
  start: number;
  declarationEnd: number;
  end: number;
  bodyStart: number;
  bodyEnd: number;
};

export function buildDbmlSourceMap(code: string): DbmlSourceMap {
  const lineStarts = getLineStarts(code);
  const tables = new Map<string, SourceTable>();
  const fields = new Map<string, SourceField>();
  const groups = new Map<string, SourceGroup>();
  const notes = new Map<string, SourceNote>();
  const tableAliases = new Map<string, { schema: string; tableName: string }>();
  const groupMembers: SourceGroupMember[] = [];
  const refs: SourceRef[] = [];
  const blocks = parseBlocks(code);

  for (const block of blocks) {
    if (block.kind === "table") {
      const tableId = getTableIdFromName(block.name.value, block.schema);
      if (block.alias) {
        tableAliases.set(block.alias.value, {
          schema: block.schema,
          tableName: block.name.value,
        });
      }
      tables.set(tableId, {
        id: tableId,
        name: block.name.value,
        schema: block.schema,
        nameRange: toRange(lineStarts, block.name.start, block.name.end),
        declarationRange: toRange(lineStarts, block.start, block.declarationEnd),
        blockRange: toRange(lineStarts, block.start, block.end),
        bodyStart: block.bodyStart,
        bodyEnd: block.bodyEnd,
      });
      for (const field of parseFields(code, block)) {
        const fieldId = getFieldIdFromName(block.name.value, field.value, block.schema);
        fields.set(fieldId, {
          id: fieldId,
          tableId,
          name: field.value,
          nameRange: toRange(lineStarts, field.start, field.end),
          lineRange: toRange(
            lineStarts,
            findLineStart(code, field.start),
            findLineEnd(code, field.end),
          ),
        });
      }
    } else if (block.kind === "group") {
      const groupId = getGroupIdFromName(block.name.value, block.schema);
      groups.set(groupId, {
        id: groupId,
        name: block.name.value,
        schema: block.schema,
        nameRange: toRange(lineStarts, block.name.start, block.name.end),
        declarationRange: toRange(lineStarts, block.start, block.declarationEnd),
        blockRange: toRange(lineStarts, block.start, block.end),
        bodyStart: block.bodyStart,
        bodyEnd: block.bodyEnd,
      });
    } else {
      const noteId = getNoteIdFromName(block.name.value, block.schema);
      notes.set(noteId, {
        id: noteId,
        name: block.name.value,
        schema: block.schema,
        nameRange: toRange(lineStarts, block.name.start, block.name.end),
        declarationRange: toRange(lineStarts, block.start, block.declarationEnd),
        blockRange: toRange(lineStarts, block.start, block.end),
      });
    }
  }

  for (const block of blocks.filter((b) => b.kind === "group")) {
    for (const member of parseGroupMembers(code, block)) {
      const groupTarget = groups.get(getGroupIdFromName(member.value, block.schema));
      const tableTarget = tables.get(getTableIdFromName(member.value, block.schema));
      const target = groupTarget
        ? ({ kind: "group", id: groupTarget.id } as const)
        : tableTarget
          ? ({ kind: "table", id: tableTarget.id } as const)
          : null;
      if (target) {
        groupMembers.push({
          name: member.value,
          nameRange: toRange(lineStarts, member.start, member.end),
          target,
        });
      }
    }
  }

  refs.push(...parseRefs(code, blocks, lineStarts, tableAliases));

  const findTargetAtPosition = (position: SourcePosition): DbmlSourceTarget | null => {
    for (const ref of refs) {
      if (rangeContains(ref.range, position)) {
        return {
          kind: "edge",
          sourceFieldId: ref.sourceFieldId,
          targetFieldId: ref.targetFieldId,
        };
      }
    }
    for (const member of groupMembers) {
      if (rangeContains(member.nameRange, position)) return member.target;
    }
    for (const field of fields.values()) {
      if (rangeContains(field.nameRange, position)) {
        return { kind: "field", id: field.id, tableId: field.tableId };
      }
    }
    for (const field of fields.values()) {
      if (rangeContains(field.lineRange, position)) {
        return { kind: "field", id: field.id, tableId: field.tableId };
      }
    }
    for (const group of groups.values()) {
      if (rangeContains(group.nameRange, position)) {
        return { kind: "group", id: group.id };
      }
    }
    for (const note of notes.values()) {
      if (rangeContains(note.nameRange, position)) {
        return { kind: "note", id: note.id };
      }
    }
    for (const table of tables.values()) {
      if (rangeContains(table.nameRange, position)) {
        return { kind: "table", id: table.id };
      }
    }
    for (const group of groups.values()) {
      if (rangeContains(group.declarationRange, position)) {
        return { kind: "group", id: group.id };
      }
    }
    for (const table of tables.values()) {
      if (rangeContains(table.declarationRange, position)) {
        return { kind: "table", id: table.id };
      }
    }
    for (const note of notes.values()) {
      if (rangeContains(note.declarationRange, position)) {
        return { kind: "note", id: note.id };
      }
    }
    return null;
  };

  return {
    code,
    tables,
    fields,
    groups,
    notes,
    groupMembers,
    refs,
    findTargetAtPosition,
  };
}

export function getTableIdFromName(name: string, schema = DEFAULT_SCHEMA) {
  return `t-${schema}.${name}`;
}

export function getGroupIdFromName(name: string, schema = DEFAULT_SCHEMA) {
  return `g-${schema}.${name}`;
}

export function getFieldIdFromName(
  tableName: string,
  fieldName: string,
  schema = DEFAULT_SCHEMA,
) {
  return `f-${schema}.${tableName}.${fieldName}`;
}

export function rangeToMonacoSelection(range: SourceRange): ISelection {
  return {
    selectionStartLineNumber: range.startLineNumber,
    selectionStartColumn: range.startColumn,
    positionLineNumber: range.endLineNumber,
    positionColumn: range.endColumn,
  };
}

export function getRangeForTarget(
  sourceMap: DbmlSourceMap,
  target: DbmlSourceTarget,
): SourceRange | null {
  if (target.kind === "table") {
    return sourceMap.tables.get(target.id)?.nameRange ?? null;
  }
  if (target.kind === "field") {
    return sourceMap.fields.get(target.id)?.nameRange ?? null;
  }
  if (target.kind === "group") {
    return sourceMap.groups.get(target.id)?.nameRange ?? null;
  }
  if (target.kind === "note") {
    return sourceMap.notes.get(target.id)?.nameRange ?? null;
  }
  const ref = sourceMap.refs.find(
    (item) =>
      (item.sourceFieldId === target.sourceFieldId &&
        item.targetFieldId === target.targetFieldId) ||
      (item.sourceFieldId === target.targetFieldId &&
        item.targetFieldId === target.sourceFieldId),
  );
  return ref?.range ?? sourceMap.fields.get(target.sourceFieldId)?.nameRange ?? null;
}

export function readIdentifier(code: string, offset: number): IdentifierToken | null {
  let cursor = skipWhitespace(code, offset);
  if (code[cursor] === '"') {
    return readQuotedIdentifier(code, cursor);
  }

  const start = cursor;
  while (cursor < code.length && isBareIdentifierChar(code[cursor])) cursor++;
  if (cursor === start) return null;
  const raw = code.slice(start, cursor);
  return {
    raw,
    value: unquoteIdentifierPart(raw),
    start,
    end: cursor,
  };
}

export function splitIdentifierPath(value: string): { schema: string; name: string } {
  const parts = splitPath(value);
  if (parts.length > 1) {
    return {
      schema: parts.slice(0, -1).join("."),
      name: parts[parts.length - 1]!,
    };
  }
  return { schema: DEFAULT_SCHEMA, name: value };
}

export function normalizeIdentifierText(raw: string): string {
  return unquoteIdentifierPart(raw.trim());
}

function parseBlocks(code: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const marker = /\b(TableGroup|Table|Note)\s+/gu;
  let match: RegExpExecArray | null;

  while ((match = marker.exec(code)) !== null) {
    if (isInLineComment(code, match.index)) continue;
    const kind =
      match[1] === "TableGroup"
        ? "group"
        : match[1] === "Note"
          ? "note"
          : "table";
    const name = readIdentifierPath(code, match.index + match[0].length);
    if (!name) continue;
    const alias = kind === "table" ? readAlias(code, name.end) : undefined;
    let cursor = alias?.end ?? name.end;
    cursor = skipBracketedSettings(code, cursor);
    cursor = skipWhitespace(code, cursor);
    if (code[cursor] !== "{") continue;
    const bodyStart = cursor + 1;
    const bodyEnd = findClosingBrace(code, cursor);
    if (bodyEnd < 0) continue;
    const path = splitIdentifierPath(name.value);
    blocks.push({
      kind,
      name: { ...name, value: path.name },
      alias,
      schema: path.schema,
      start: match.index,
      declarationEnd: cursor + 1,
      end: bodyEnd + 1,
      bodyStart,
      bodyEnd,
    });
    marker.lastIndex = bodyEnd + 1;
  }

  return blocks;
}

function parseFields(code: string, table: ParsedBlock): IdentifierToken[] {
  const fields: IdentifierToken[] = [];
  let cursor = table.bodyStart;
  while (cursor < table.bodyEnd) {
    const lineStart = cursor;
    const lineEnd = Math.min(findLineEnd(code, cursor), table.bodyEnd);
    const line = code.slice(lineStart, lineEnd);
    const nonWs = line.search(/\S/u);
    if (nonWs >= 0) {
      const fieldStart = lineStart + nonWs;
      const firstChar = code[fieldStart];
      if (
        firstChar !== "/" &&
        firstChar !== "[" &&
        firstChar !== "}" &&
        !line.trimStart().startsWith("Note:") &&
        !line.trimStart().startsWith("indexes")
      ) {
        const token = readIdentifier(code, fieldStart);
        if (token && token.start < lineEnd) fields.push(token);
      }
    }
    cursor = lineEnd + 1;
  }
  return fields;
}

function parseGroupMembers(code: string, group: ParsedBlock): IdentifierToken[] {
  const members: IdentifierToken[] = [];
  let cursor = group.bodyStart;
  while (cursor < group.bodyEnd) {
    cursor = skipSeparatorsAndComments(code, cursor, group.bodyEnd);
    const token = readIdentifierPath(code, cursor);
    if (!token || token.start >= group.bodyEnd) break;
    const path = splitIdentifierPath(token.value);
    members.push({ ...token, value: path.name });
    cursor = token.end;
  }
  return members;
}

function parseRefs(
  code: string,
  blocks: ParsedBlock[],
  lineStarts: number[],
  tableAliases: Map<string, { schema: string; tableName: string }>,
): SourceRef[] {
  const refs: SourceRef[] = [];
  const tableByRange = blocks.filter((b) => b.kind === "table");
  const standalone = /^\s*Ref(?:\s+[^\n:{]+)?\s*:\s*(.+)$/gmu;
  let match: RegExpExecArray | null;

  while ((match = standalone.exec(code)) !== null) {
    const expressionStart = match.index + match[0].indexOf(":") + 1;
    const expressionEnd = match.index + match[0].length;
    const parsed = parseRefExpression(
      code.slice(expressionStart, expressionEnd),
      tableAliases,
    );
    if (parsed) {
      refs.push({
        range: toRange(lineStarts, match.index, expressionEnd),
        sourceFieldId: parsed.sourceFieldId,
        targetFieldId: parsed.targetFieldId,
      });
    }
  }

  const inline = /\[\s*ref\s*:\s*([^\]]+)\]/giu;
  while ((match = inline.exec(code)) !== null) {
    const table = tableByRange.find((block) => match!.index > block.bodyStart && match!.index < block.bodyEnd);
    if (!table) continue;
    const lineStart = findLineStart(code, match.index);
    const field = readIdentifier(code, lineStart);
    if (!field) continue;
    const expression = match[1]!;
    const parsed = parseInlineRefExpression(
      expression,
      table,
      field.value,
      tableAliases,
    );
    if (parsed) {
      refs.push({
        range: toRange(lineStarts, match.index, match.index + match[0].length),
        sourceFieldId: parsed.sourceFieldId,
        targetFieldId: parsed.targetFieldId,
      });
    }
  }

  return refs;
}

function parseRefExpression(
  expression: string,
  tableAliases: Map<string, { schema: string; tableName: string }>,
) {
  expression = stripLineComment(expression);
  const relation = expression.match(/(.+?)\s*(?:<|>|-)\s*(.+)/u);
  if (!relation) return null;
  const left = parseEndpoint(relation[1]!, tableAliases);
  const right = parseEndpoint(relation[2]!, tableAliases);
  if (!left || !right) return null;
  return {
    sourceFieldId: getFieldIdFromName(left.tableName, left.fieldName, left.schema),
    targetFieldId: getFieldIdFromName(right.tableName, right.fieldName, right.schema),
  };
}

function parseInlineRefExpression(
  expression: string,
  table: ParsedBlock,
  fieldName: string,
  tableAliases: Map<string, { schema: string; tableName: string }>,
) {
  expression = stripLineComment(expression);
  const relation = expression.match(/(?:<|>|-)\s*(.+)/u);
  if (!relation) return null;
  const target = parseEndpoint(relation[1]!, tableAliases);
  if (!target) return null;
  return {
    sourceFieldId: getFieldIdFromName(table.name.value, fieldName, table.schema),
    targetFieldId: getFieldIdFromName(target.tableName, target.fieldName, target.schema),
  };
}

function parseEndpoint(
  raw: string,
  tableAliases: Map<string, { schema: string; tableName: string }>,
) {
  const value = raw.trim().replace(/,$/u, "");
  const compositeMatch = value.match(/^(.*)\.\((.+)\)$/u);
  if (compositeMatch) {
    const tablePart = compositeMatch[1]!.trim();
    const firstField = compositeMatch[2]!
      .split(",")
      .map((field) => unquoteIdentifierPart(field))
      .find(Boolean);
    if (!firstField) {
      return null;
    }
    return parseEndpoint(`${tablePart}.${firstField}`, tableAliases);
  }
  const parts = splitPath(value).map(unquoteIdentifierPart);
  if (parts.length < 2) return null;
  const fieldName = parts[parts.length - 1]!;
  let tableName = parts[parts.length - 2]!;
  const schema = parts.length > 2 ? parts.slice(0, -2).join(".") : DEFAULT_SCHEMA;
  const alias = tableAliases.get(tableName);
  if (alias && parts.length === 2) {
    tableName = alias.tableName;
    return { schema: alias.schema, tableName, fieldName };
  }
  return { schema, tableName, fieldName };
}

function stripLineComment(value: string): string {
  let quoted = false;
  for (let i = 0; i < value.length - 1; i++) {
    const char = value[i];
    if (char === '"' && value[i - 1] !== "\\") quoted = !quoted;
    if (!quoted && char === "/" && value[i + 1] === "/") {
      return value.slice(0, i).trimEnd();
    }
  }
  return value;
}

function readAlias(code: string, offset: number): IdentifierToken | undefined {
  let cursor = skipWhitespace(code, offset);
  if (!/^as\b/iu.test(code.slice(cursor))) return undefined;
  cursor += 2;
  return readIdentifier(code, cursor) ?? undefined;
}

function readIdentifierPath(code: string, offset: number): IdentifierToken | null {
  const first = readIdentifier(code, offset);
  if (!first) return null;
  let cursor = first.end;
  const parts = [first.value];
  let rawEnd = first.end;

  while (code[cursor] === ".") {
    const next = readIdentifier(code, cursor + 1);
    if (!next) break;
    parts.push(next.value);
    cursor = next.end;
    rawEnd = next.end;
  }

  return {
    raw: code.slice(first.start, rawEnd),
    value: parts.join("."),
    start: first.start,
    end: rawEnd,
  };
}

function readQuotedIdentifier(code: string, offset: number): IdentifierToken | null {
  let cursor = offset + 1;
  let value = "";
  while (cursor < code.length) {
    const char = code[cursor];
    if (char === '"') {
      return {
        raw: code.slice(offset, cursor + 1),
        value,
        start: offset,
        end: cursor + 1,
      };
    }
    if (char === "\\" && cursor + 1 < code.length) {
      value += code[cursor + 1];
      cursor += 2;
      continue;
    }
    value += char;
    cursor++;
  }
  return null;
}

function splitPath(value: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (char === '"') {
      quoted = !quoted;
      current += char;
    } else if (char === "." && !quoted) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function unquoteIdentifierPart(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/gu, '"');
  }
  return trimmed;
}

function skipWhitespace(code: string, offset: number): number {
  let cursor = offset;
  while (cursor < code.length && /\s/u.test(code[cursor]!)) cursor++;
  return cursor;
}

function skipBracketedSettings(code: string, offset: number): number {
  let cursor = skipWhitespace(code, offset);
  if (code[cursor] !== "[") return cursor;
  const end = findClosingBracket(code, cursor);
  return end >= 0 ? end + 1 : cursor;
}

function skipSeparatorsAndComments(code: string, offset: number, end: number): number {
  let cursor = offset;
  while (cursor < end) {
    while (cursor < end && (/[\s,|]/u.test(code[cursor]!))) cursor++;
    if (code[cursor] === "/" && code[cursor + 1] === "/") {
      cursor = findLineEnd(code, cursor) + 1;
      continue;
    }
    break;
  }
  return cursor;
}

function isBareIdentifierChar(char: string | undefined): boolean {
  return !!char && !/[\s{}[\](),|<>:"']/u.test(char);
}

function findClosingBracket(code: string, openIndex: number): number {
  let depth = 0;
  let quoted = false;
  for (let i = openIndex; i < code.length; i++) {
    const char = code[i];
    if (char === '"' && code[i - 1] !== "\\") quoted = !quoted;
    if (quoted) continue;
    if (char === "[") depth++;
    else if (char === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findClosingBrace(code: string, openIndex: number): number {
  let depth = 0;
  let quoted = false;
  for (let i = openIndex; i < code.length; i++) {
    const char = code[i];
    if (char === '"' && code[i - 1] !== "\\") quoted = !quoted;
    if (quoted) continue;
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function isInLineComment(code: string, offset: number): boolean {
  const lineStart = findLineStart(code, offset);
  const comment = code.slice(lineStart, offset).indexOf("//");
  return comment >= 0;
}

function getLineStarts(code: string): number[] {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function toRange(lineStarts: number[], start: number, end: number): SourceRange {
  const startPosition = offsetToPosition(lineStarts, start);
  const endPosition = offsetToPosition(lineStarts, end);
  return {
    startLineNumber: startPosition.lineNumber,
    startColumn: startPosition.column,
    endLineNumber: endPosition.lineNumber,
    endColumn: endPosition.column,
  };
}

function offsetToPosition(lineStarts: number[], offset: number): SourcePosition {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid]! <= offset) low = mid + 1;
    else high = mid - 1;
  }
  const lineIndex = Math.max(0, high);
  return {
    lineNumber: lineIndex + 1,
    column: offset - lineStarts[lineIndex]! + 1,
  };
}

function findLineStart(code: string, offset: number): number {
  const index = code.lastIndexOf("\n", offset - 1);
  return index < 0 ? 0 : index + 1;
}

function findLineEnd(code: string, offset: number): number {
  const index = code.indexOf("\n", offset);
  return index < 0 ? code.length : index;
}

function rangeContains(range: SourceRange, position: SourcePosition): boolean {
  const afterStart =
    position.lineNumber > range.startLineNumber ||
    (position.lineNumber === range.startLineNumber &&
      position.column >= range.startColumn);
  const beforeEnd =
    position.lineNumber < range.endLineNumber ||
    (position.lineNumber === range.endLineNumber &&
      position.column <= range.endColumn);
  return afterStart && beforeEnd;
}
