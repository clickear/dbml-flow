# Bidirectional Editor Flow Navigation Design

## Goal

Add bidirectional double-click navigation between the DBML editor and the React Flow canvas for tables, fields, TableGroups, and relationships when they can be mapped safely.

## Supported Interactions

- Double-click a table node on the canvas to focus Monaco and select the table name in its `Table` declaration.
- Double-click a field row on the canvas to focus Monaco and select the field name in its table block.
- Double-click a TableGroup node or header on the canvas to focus Monaco and select the group name in its `TableGroup` declaration.
- Double-click an edge on the canvas to focus Monaco and select the relationship source if the relationship source map can identify it. If the relationship cannot be mapped safely, jump to the source field.
- Double-click a table name in the editor to select and center the table node on the canvas.
- Double-click a field name in the editor to select and center the owning table node, with a transient highlight on the field row.
- Double-click a TableGroup name in the editor to select and center the TableGroup node.
- Double-click a TableGroup member in the editor to select and center the referenced table or nested TableGroup.
- Double-click a recognizable relationship definition in the editor to select the corresponding edge and center the related nodes.

## Naming Requirements

Source mapping must support Unicode identifiers and quoted identifiers, including Chinese names:

- `Table 用户 { 编号 int }`
- `TableGroup 分组 { 用户 }`
- `Table "用户资料" { "用户编号" int }`
- schema-qualified names such as `Table 业务.用户 { ... }`

The source map must not depend on ASCII-only regexes such as `\w` or `[A-Za-z_]` for DBML identifiers.

## Architecture

Add a DBML source map module that scans the original editor text and produces ranges for tables, fields, TableGroups, TableGroup members, and recognizable refs. The scanner should be lightweight and purpose-built for navigation rather than a full DBML parser.

The Zustand store owns navigation state:

- the Monaco editor instance and model
- the latest source map
- a pending canvas focus request for editor-to-canvas navigation
- a transient field highlight target

Canvas-to-editor navigation calls a store action that looks up a source range, focuses Monaco, reveals the range, and selects it. Editor-to-canvas navigation is triggered from Monaco double-click events. It resolves the clicked source range to a navigation target, then publishes a pending canvas focus request. The viewer consumes that request through `useReactFlow()` and updates node or edge selection plus viewport centering.

## Canvas Highlight Design

React Flow native selection is used for table nodes, TableGroup nodes, and edges. Field-level selection is represented by selecting the owning table node plus a lightweight field-row highlight. The field highlight is transient and replaced by the next navigation request.

TableGroup selection highlights the group node itself only. It does not select every child table.

## Relationship Mapping

Relationship mapping is best-effort:

- standalone `Ref:` definitions should map to an edge when both endpoints can be normalized
- inline `[ref: ...]` definitions should map when the referenced endpoint and owning field can be normalized
- if edge-to-source navigation cannot find a ref range, it falls back to the source field range

## Existing Parser Compatibility

The existing nested TableGroup preprocessor currently uses ASCII-oriented matching. Update it to reuse or match the source map identifier handling so Chinese and quoted TableGroup names work consistently in nested group preprocessing and source navigation.

## Testing

Add focused unit tests for the source map and identifier handling before production code changes:

- Unicode table and field ranges
- quoted table and field ranges
- TableGroup declaration ranges
- TableGroup member target resolution for tables and nested groups
- standalone and inline ref range mapping where stable
- nested TableGroup preprocessing with Chinese and quoted names

Run TypeScript build after implementation.
