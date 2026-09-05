import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import type { BolTemplate } from "@prisma/client";
import { fieldDefListSchema, type FormData, type TextStyle } from "./fieldTypes";

function hexToRgb(hex: string): Color {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

export async function createBolPdf({
  templatePath,
  outputPath,
  bolNumber,
  template,
  formData = {},
  style,
}: {
  templatePath: string;
  outputPath: string;
  bolNumber: string;
  template: BolTemplate;
  formData?: FormData;
  style?: TextStyle;
}) {
  const templateBytes = await fs.readFile(templatePath);
  const templatePdf = await PDFDocument.load(templateBytes);
  const outputPdf = await PDFDocument.create();
  const boldFont = await outputPdf.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await outputPdf.embedFont(StandardFonts.Helvetica);

  const fields = fieldDefListSchema.parse(template.fields ?? []);

  // One page per copy label; an empty array produces a single unlabeled page.
  const pages = template.copyLabels.length > 0 ? template.copyLabels : [null];

  for (const label of pages) {
    const [templatePage] = await outputPdf.copyPages(templatePdf, [0]);
    outputPdf.addPage(templatePage);
    const page = outputPdf.getPages()[outputPdf.getPageCount() - 1];

    if (template.coverExistingNumber) {
      page.drawRectangle({
        x: template.coverX,
        y: template.coverY,
        width: template.coverWidth,
        height: template.coverHeight,
        color: rgb(1, 1, 1),
      });
    }

    page.drawText(`${template.numberPrefixText}${bolNumber}`, {
      x: template.numberX,
      y: template.numberY,
      size: template.numberFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    if (label) {
      page.drawText(label, {
        x: template.copyLabelX,
        y: template.copyLabelY,
        size: template.copyFontSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
    }

    drawFormData(page, regularFont, boldFont, fields, formData, style);
  }

  const pdfBytes = await outputPdf.save();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, pdfBytes);
}

function drawFormData(
  page: PDFPage,
  regularFont: PDFFont,
  boldFont: PDFFont,
  fields: ReturnType<typeof fieldDefListSchema.parse>,
  formData: FormData,
  style?: TextStyle
) {
  const color = style?.color ? hexToRgb(style.color) : rgb(0, 0, 0);

  for (const field of fields) {
    const size = style?.fontSize ?? field.fontSize;

    if (field.kind === "text") {
      const value = formData[field.key];
      if (typeof value === "string" && value) {
        page.drawText(value.slice(0, field.maxLength), {
          x: field.x,
          y: field.y,
          size,
          font: regularFont,
          color,
        });
      }
    } else if (field.kind === "checkbox") {
      if (formData[field.key] === true) {
        page.drawText("X", {
          x: field.x,
          y: field.y,
          size,
          font: boldFont,
          color,
        });
      }
    } else {
      const rows = formData[field.key];
      if (!Array.isArray(rows)) continue;
      rows.slice(0, field.maxRows).forEach((row, i) => {
        const rowY = field.startY - i * field.rowHeight;
        for (const col of field.columns) {
          const value = row?.[col.key];
          if (typeof value === "string" && value) {
            page.drawText(value.slice(0, 40), {
              x: col.x,
              y: rowY,
              size,
              font: regularFont,
              color,
            });
          }
        }
      });
    }
  }
}
