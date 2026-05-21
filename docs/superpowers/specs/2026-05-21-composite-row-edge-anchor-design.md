# Composite Row Edge Anchor Design

## Context

Composite foreign keys already parse as one logical edge and render one composite relationship row on each participating table.

The remaining gap is visual anchoring. Today the single composite edge still uses the first participating field handle on each side, so the line appears to come from ordinary field rows rather than from the dedicated composite relationship rows. The composite relationship rows also still show a tooltip, which adds noise now that the row itself is becoming the primary visual representation of the grouped relationship.

## Goal

Make a composite foreign key edge connect directly between the composite relationship rows on the source and target tables, and remove the composite relationship row tooltip.

## Behavior

- A composite foreign key still renders as one edge.
- The edge source anchor is the source table's composite relationship row.
- The edge target anchor is the target table's composite relationship row.
- The edge no longer visually attaches to the first underlying field row for composite refs.
- The composite relationship row keeps its current label format:
  - `(merchant_id, country_code)`
- Hovering the composite relationship row still highlights:
  - the composite row on the current table
  - the matching composite row on the opposite table
  - the single relationship edge
  - every participating field on both sides
- Double-clicking the composite relationship row or the composite edge still jumps to the `Ref:` definition.
- Composite relationship rows no longer show a tooltip.
- Standard single-field relationships and their field-level handles remain unchanged.

## Recommended Approach

Give each composite relationship row a stable pair of row-level handle ids and make composite edges bind to those ids at parse time.

This keeps the React Flow model honest: the edge is attached to the row that visually represents the relationship, rather than being post-adjusted during rendering. It also keeps hover, hit-testing, and future layout behavior aligned with the DOM elements users see.

## Data Model

Composite row derivation should expose stable handle ids that are deterministic from the owning edge id and side:

- source-side row handle id
- target-side row handle id

Composite edges should use those row-level handle ids as `sourceHandle` and `targetHandle` whenever the relationship is composite. The grouped field ids in edge data remain unchanged and continue to drive grouped highlighting and source-map navigation.

## UI Structure

The composite relationship row renderer should:

- render a hidden left handle for inbound anchoring
- render a hidden right handle for outbound anchoring
- keep the existing row text and hover styling
- remove the tooltip wrapper entirely

The row should remain a dedicated block below the normal fields.

## Testing

- A composite edge uses row-level handle ids instead of the first field handle ids.
- A single-column edge still uses the field handle ids it uses today.
- The composite relationship row renderer exposes those row-level handles.
- The composite relationship row renderer no longer renders tooltip-only content.
- Existing grouped hover behavior continues to pass.
- The app still builds successfully.

## Non-Goals

- Changing composite relationship row labels
- Reintroducing composite tooltip content elsewhere
- Changing source-map matching beyond the existing first-field normalization
- Reworking standard field-row handles
