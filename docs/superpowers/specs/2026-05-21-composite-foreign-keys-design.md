# Composite Foreign Keys Design

## Context

The app already parses and renders standard DBML relationships as single React Flow edges, with field hover, edge hover, editor navigation, and table-local field highlighting. Composite foreign keys are currently listed as unsupported in `ReadMe.md`.

Today the relationship parser only uses `fields[0]` on each endpoint, which means a DBML ref such as:

```dbml
Ref: ecommerce.merchant_periods.(merchant_id, country_code) > ecommerce.merchants.(id, country_code)
```

loses every field after the first one. As a result, the edge does not represent the full relationship, and the table UI has no way to show that multiple fields participate together in one foreign key.

## Goal

Support composite foreign keys as one logical relationship edge, with a dedicated composite-relationship row shown in both participating tables.

## Behavior

- A composite foreign key renders as a single edge.
- The source table shows one composite relationship row for that edge.
- The target table also shows one composite relationship row for that edge.
- The row label is only the local field group:
  - source example: `(merchant_id, country_code)`
  - target example: `(id, country_code)`
- Composite relationship rows are rendered in a dedicated table section below normal fields.
- Composite relationship rows do not display field types or reuse normal field metadata icons.
- Hovering a composite relationship row highlights:
  - that row
  - the matching composite row in the opposite table
  - the single relationship edge
  - every participating field on both sides
- Hovering any participating field also highlights the full composite relationship group.
- Double-clicking the composite edge or either composite relationship row jumps Monaco to the `Ref:` definition.
- Standard single-column relationships keep their current behavior unchanged.

## Tooltip Behavior

Hovering a composite relationship row shows a tooltip with:

- a short title such as `Composite FK -> merchants`
- the field pair mapping, one per line

Example for the source table side:

- `merchant_id -> id`
- `country_code -> country_code`

## Recommended Approach

Model a composite foreign key as one edge with multi-field endpoint metadata, rather than splitting it into multiple edges.

This keeps the relationship model aligned with DBML semantics and makes hover, selection, and navigation state much simpler. The existing single-field identifiers should remain in the edge data for non-composite relationships so current code paths stay stable.

## Data Model

Extend edge data to support grouped fields:

- `sourcefieldId` and `targetfieldId` remain for ordinary relationships
- `sourceFieldIds: string[]`
- `targetFieldIds: string[]`
- `isComposite: boolean`

For non-composite relationships, the array fields may contain one item or be omitted, but the single-field properties must continue to work for existing logic.

## UI Structure

Each table node gets a derived list of composite relationship rows relevant to that table.

Each row contains:

- a stable row id
- the local field ids participating in the composite relationship
- the opposite table label for tooltip text
- the ordered field-pair mapping for tooltip display
- a pointer back to the owning edge id

The composite relationship rows are rendered in a dedicated block below the normal field rows.

## Interaction Model

The hover model must expand from one field id per edge to grouped field membership.

That means:

- edge hover checks all grouped field ids
- field hover can light up a composite edge if the field belongs to the grouped ids
- composite row hover sets a row-level hover target that can be matched from both tables and the edge
- jump-to-source for composite rows reuses the existing edge source-map path

## Non-Goals

- Rendering multiple visual edges for a single composite foreign key
- Showing remote table names directly in the composite row label
- Adding editing UI for composite relations
- Changing DBML syntax handling beyond composite ref endpoint support
- Reworking ordinary field-row rendering outside what is needed for grouped highlights

## Testing

- Parse a composite DBML ref into a single edge with grouped source and target field ids.
- Keep ordinary single-column refs working without regressions.
- Derive one composite relationship row for the source table and one for the target table.
- Highlight all participating fields when hovering a composite relationship row.
- Highlight the composite relationship row and edge when hovering any participating field.
- Jump from a composite relationship row to the correct `Ref:` source declaration.
- Include composite relationship row width in table sizing.
- Mark composite foreign keys as supported in `ReadMe.md`.

## Risks

- Current hover logic is spread across edge visuals, field helpers, and store selection logic; grouped-field support must be wired consistently to avoid partial highlighting.
- Table sizing currently assumes the header and field rows define width; adding a second row block means width calculation must be updated in one place instead of patched ad hoc in the component.
