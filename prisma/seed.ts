import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import type { FieldDef } from "../src/lib/pdf/fieldTypes";

// Field layout for BOL_SAMPLE.pdf (A4, 595x842pt). Coordinates were measured
// by overlaying a labeled coordinate grid on the actual blank template
// (rendered at 400dpi via pdftoppm) and reading off exactly where each ruled
// line/box sits — not eyeballed from a compressed preview. See the
// "Calibrating a BOL template" section in the README for the technique.
const southsideFields: FieldDef[] = [
  // The label's OCR text layer (from pdftotext -bbox) claimed it ended at
  // x=55, but that's unreliable on this scanned form — the label is
  // actually visually rendered out to ~x=113; verified against the real
  // ruled line position via the coordinate-grid technique.
  { kind: "text", key: "shipper", label: "Shipper", x: 122, y: 665, fontSize: 10, maxLength: 55 },
  { kind: "text", key: "destinationLine1", label: "Destination (line 1)", x: 112, y: 625, fontSize: 10, maxLength: 55 },
  { kind: "text", key: "destinationLine2", label: "Destination (line 2)", x: 112, y: 605, fontSize: 10, maxLength: 55 },
  { kind: "text", key: "destinationLine3", label: "Destination (line 3)", x: 112, y: 587, fontSize: 10, maxLength: 55 },
  { kind: "text", key: "destinationLine4", label: "Destination (line 4)", x: 112, y: 568, fontSize: 10, maxLength: 55 },
  { kind: "text", key: "date", label: "Date", x: 395, y: 629, fontSize: 10, maxLength: 20 },
  { kind: "text", key: "po", label: "PO #", x: 386, y: 611, fontSize: 10, maxLength: 30 },
  { kind: "checkbox", key: "freezerChecked", label: "Freezer", x: 365, y: 586, fontSize: 10, maxLength: 1 },
  { kind: "checkbox", key: "coolerChecked", label: "Cooler", x: 365, y: 572, fontSize: 10, maxLength: 1 },
  { kind: "checkbox", key: "otherChecked", label: "Other", x: 365, y: 559, fontSize: 10, maxLength: 1 },
  {
    kind: "table",
    key: "lineItems",
    label: "Line items",
    startY: 511,
    rowHeight: 20,
    maxRows: 10,
    fontSize: 9,
    columns: [
      { key: "lot", label: "Lot no / Marking", x: 18, width: 115 },
      { key: "quantity", label: "Quantity", x: 140, width: 48 },
      { key: "packed", label: "Packed", x: 196, width: 44 },
      { key: "netWeight", label: "Net weight lb/case", x: 248, width: 60 },
      { key: "totalLb", label: "Total lb", x: 315, width: 65 },
      { key: "size", label: "Size", x: 388, width: 75 },
      { key: "description", label: "Description", x: 472, width: 100 },
    ],
  },
  { kind: "text", key: "totalCases", label: "Total cases/totes", x: 132, y: 278, fontSize: 10, maxLength: 8 },
  { kind: "text", key: "totalWeight", label: "Total weight (lb)", x: 310, y: 278, fontSize: 10, maxLength: 8 },
  { kind: "text", key: "timePickUp", label: "Time of pick up", x: 138, y: 248, fontSize: 10, maxLength: 10 },
  { kind: "text", key: "timeDelivery", label: "Time of delivery", x: 140, y: 220, fontSize: 10, maxLength: 10 },
  // Carrier/Driver/Consignee: value drawn above its label (not below) for
  // symmetry. Box borders sit at y=235/195/163, labels at y=222/185/150 —
  // each box only has ~10-13pt of clearance above its label, so these use a
  // small font pushed right up against the box's own top border.
  { kind: "text", key: "carrierName", label: "Name of carrier", x: 482, y: 230, fontSize: 6, maxLength: 28 },
  { kind: "text", key: "driverName", label: "Driver's printed name & sign", x: 482, y: 191, fontSize: 6, maxLength: 28 },
  { kind: "text", key: "consignee", label: "Consignee", x: 482, y: 157, fontSize: 6, maxLength: 28 },
  { kind: "text", key: "truckTemp", label: "Truck temperature (pre-loading)", x: 290, y: 150, fontSize: 10, maxLength: 20 },
];

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@example.com",
      passwordHash,
    },
  });

  const company = await prisma.company.upsert({
    where: { code: "SPI" },
    update: {},
    create: {
      name: "Southside Processing Inc.",
      code: "SPI",
    },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: admin.id } },
    update: { role: "ADMIN" },
    create: { companyId: company.id, userId: admin.id, role: "ADMIN" },
  });

  await prisma.bolSequence.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      prefix: "SPI",
      nextNumber: 44311,
      padding: 5,
    },
  });

  // Coordinates for BOL_SAMPLE.pdf (A4, 595x842pt), calibrated against the
  // printed "№ 44,310" text extracted via `pdftotext -bbox` (bbox x
  // 411-488, y 55-71 from the top → pdf-lib bottom-left y ≈ 771-787).
  // coverExistingNumber whites that box out before the new number is drawn
  // in the same spot. Re-check with Admin Settings' "Generate test PDF" if
  // the source template ever changes.
  const templateData = {
    name: "Southside Shipping Tally",
    filePath: "templates/southside-shipping-tally.pdf",
    numberX: 408,
    numberY: 774,
    numberFontSize: 12,
    numberPrefixText: "No. ",
    coverExistingNumber: true,
    coverX: 402,
    coverY: 766,
    coverWidth: 145,
    coverHeight: 28,
    copyLabels: ["SHIPPER COPY", "RECEIVER COPY", "RECORDS COPY"],
    copyLabelX: 408,
    copyLabelY: 758,
    copyFontSize: 9,
    fields: southsideFields,
  };

  // Unlike company/sequence above, the template is re-applied on every seed
  // run (not left alone on conflict) — it's what this script is used to
  // iterate on while calibrating a template's layout.
  await prisma.bolTemplate.upsert({
    where: { companyId: company.id },
    update: templateData,
    create: { companyId: company.id, ...templateData },
  });

  console.log("Seed complete.");
  console.log("Login with admin@example.com / ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
