import {
    FIELD_BORDER,
    FIELD_HEIGHT_TOTAL,
    FIELD_SPACING,
    HEADER_HEIGHT,
    ICON_SIZE,
} from "@/components/table-constants";
import { getTextWidth } from "@/lib/utils";
import type { Table } from "@dbml/core";
import { hasFieldDetails, isUniqueFieldOrPK } from "./dbml.utils";

const FIELD_FONT = "14px Inconsolata, monospace";
const HEADER_FONT = "600 15px Inconsolata, monospace";
const INLINE_PADDING = 8;
const FOLD_BUTTON_WIDTH = 14;
const HEADER_PADDING_X = 16;
const NOTE_ICON_WIDTH = 20;

export const tableWidth = [150, 200, 250, 300].map((w) => ({
  width: w,
}));
const TABLE_WIDTH_STEP = 50;

function getFieldRowWidth(table: Table): number {
    let max = 0;
    for (const field of table.fields) {
        const textWidth = getTextWidth(
            `${field.name}${field.type.type_name}`,
            FIELD_FONT,
        );
        const { pk } = isUniqueFieldOrPK(field);
        const iconCount = (pk ? 1 : 0) + (hasFieldDetails(field) ? 1 : 0);
        const iconsWidth =
            iconCount > 0 ? iconCount * ICON_SIZE + (iconCount - 1) * 2 + 4 : 0;
        const rowWidth =
            textWidth +
            iconsWidth +
            INLINE_PADDING * 2 +
            FIELD_SPACING +
            FIELD_BORDER * 2;
        max = Math.max(max, rowWidth);
    }
    return max;
}

function getHeaderRowWidth(table: Table): number {
    const labelWidth = getTextWidth(table.name, HEADER_FONT);
    const noteWidth = table.note ? NOTE_ICON_WIDTH : 0;
    return labelWidth + FOLD_BUTTON_WIDTH + noteWidth + HEADER_PADDING_X;
}

function getCompositeRowWidth(compositeRelationLabels: string[] = []): number {
    return Math.max(
        0,
        ...compositeRelationLabels.map(
            (label) =>
                getTextWidth(label, FIELD_FONT) +
                INLINE_PADDING * 2 +
                FIELD_BORDER * 2,
        ),
    );
}

function getContentWidth(table: Table, compositeRelationLabels: string[] = []): number {
    return Math.max(
        getFieldRowWidth(table),
        getHeaderRowWidth(table),
        getCompositeRowWidth(compositeRelationLabels),
    );
}

export function findClosestSize(table: Table, compositeRelationLabels: string[] = []) {
    const contentWidth = getContentWidth(table, compositeRelationLabels);
    const width =
        tableWidth.find((s) => contentWidth <= s.width)?.width ??
        Math.ceil(contentWidth / TABLE_WIDTH_STEP) * TABLE_WIDTH_STEP;
    return {
        width,
        height: getHeight(table),
    };
}

export function guessSize(table: Table, compositeRelationLabels: string[] = []) {
    return {
        width: getContentWidth(table, compositeRelationLabels),
        height: getHeight(table),
    };
}

function getHeight(table: Table) {
    return table.fields.length * FIELD_HEIGHT_TOTAL + HEADER_HEIGHT;
}
