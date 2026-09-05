import { z } from "zod";

/**
 * Defines one piece of shipment data a user fills in when generating a BOL,
 * and exactly where it's drawn (in PDF points, bottom-left origin) on every
 * copy page. Stored as BolTemplate.fields, so each company's template can
 * have its own set of fields without a schema change.
 */
const baseFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  x: z.number(),
  y: z.number(),
  fontSize: z.number().min(4).max(72).default(10),
  maxLength: z.number().int().positive().max(500).default(80),
});

const textFieldSchema = baseFieldSchema.extend({
  kind: z.literal("text"),
});

const checkboxFieldSchema = baseFieldSchema.extend({
  kind: z.literal("checkbox"),
});

const tableColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  x: z.number(),
  width: z.number().positive(),
});

const tableFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.literal("table"),
  startY: z.number(),
  rowHeight: z.number().positive(),
  maxRows: z.number().int().positive().max(50),
  fontSize: z.number().min(4).max(72).default(9),
  columns: z.array(tableColumnSchema).min(1),
});

export const fieldDefSchema = z.discriminatedUnion("kind", [
  textFieldSchema,
  checkboxFieldSchema,
  tableFieldSchema,
]);

export const fieldDefListSchema = z.array(fieldDefSchema);

export type TextFieldDef = z.infer<typeof textFieldSchema>;
export type CheckboxFieldDef = z.infer<typeof checkboxFieldSchema>;
export type TableFieldDef = z.infer<typeof tableFieldSchema>;
export type FieldDef = z.infer<typeof fieldDefSchema>;

/**
 * Builds a zod schema for the form-submission payload from a template's
 * field defs: one entry per text/checkbox field, plus one array entry per
 * table field (rows of { [columnKey]: string }, capped at maxRows).
 */
export function buildFormDataSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.kind === "text") {
      shape[field.key] = z.string().max(field.maxLength).optional().default("");
    } else if (field.kind === "checkbox") {
      shape[field.key] = z.boolean().optional().default(false);
    } else {
      const rowShape: Record<string, z.ZodTypeAny> = {};
      for (const col of field.columns) {
        rowShape[col.key] = z.string().max(200).optional().default("");
      }
      shape[field.key] = z
        .array(z.object(rowShape))
        .max(field.maxRows)
        .optional()
        .default([]);
    }
  }
  return z.object(shape);
}

export type FormData = Record<string, string | boolean | Record<string, string>[]>;

/**
 * User-chosen text style applied to every form-field value drawn onto a
 * BOL's PDF (not the BOL number or copy label, which stay controlled by
 * BolTemplate). Chosen at generation time on the /generate form; either
 * property left unset falls back to that field's own default from
 * BolTemplate.fields.
 */
export const TEXT_FONT_SIZE_OPTIONS = [8, 9, 10, 11, 12, 14, 16] as const;

export const TEXT_COLOR_OPTIONS = [
  { label: "Black", value: "#000000" },
  { label: "Dark gray", value: "#333333" },
  { label: "Blue", value: "#1a3fa8" },
  { label: "Red", value: "#a81a1a" },
  { label: "Dark green", value: "#1a6b1a" },
] as const;

export const textStyleSchema = z.object({
  fontSize: z
    .number()
    .refine((n) => (TEXT_FONT_SIZE_OPTIONS as readonly number[]).includes(n))
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

export type TextStyle = z.infer<typeof textStyleSchema>;
