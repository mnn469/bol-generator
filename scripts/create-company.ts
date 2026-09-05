import "dotenv/config";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

function usageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    `Usage: npm run create-company -- \\
  --name "Acme Trading Ltd." \\
  --code ACME \\
  --admin-name "Jane Doe" \\
  --admin-email jane@acme.com \\
  [--prefix ACME] [--start 1] [--padding 6]

--code must be unique across all companies and is used in generated file
paths, so keep it short and filesystem-safe (letters/numbers only).
A template still needs to be uploaded afterward from Admin -> BOL template
(it requires an actual PDF file, which this script can't take as input).`
  );
  process.exit(1);
}

async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      code: { type: "string" },
      prefix: { type: "string" },
      start: { type: "string", default: "1" },
      padding: { type: "string", default: "6" },
      "admin-name": { type: "string" },
      "admin-email": { type: "string" },
    },
  });

  const name = values.name;
  const code = values.code?.toUpperCase();
  const prefix = values.prefix?.toUpperCase() ?? code;
  const adminName = values["admin-name"];
  const adminEmail = values["admin-email"]?.toLowerCase().trim();
  const start = Number(values.start);
  const padding = Number(values.padding);

  if (!name) usageAndExit("--name is required");
  if (!code || !/^[A-Z0-9]{2,10}$/.test(code)) {
    usageAndExit("--code is required and must be 2-10 letters/numbers");
  }
  if (!adminName) usageAndExit("--admin-name is required");
  if (!adminEmail) usageAndExit("--admin-email is required");
  if (!Number.isInteger(start) || start < 1) usageAndExit("--start must be a positive integer");
  if (!Number.isInteger(padding) || padding < 1 || padding > 12) {
    usageAndExit("--padding must be between 1 and 12");
  }

  const existing = await prisma.company.findUnique({ where: { code } });
  if (existing) usageAndExit(`A company with code "${code}" already exists`);

  const company = await prisma.company.create({
    data: { name, code },
  });

  await prisma.bolSequence.create({
    data: { companyId: company.id, prefix: prefix!, nextNumber: start, padding },
  });

  let user = await prisma.user.findUnique({ where: { email: adminEmail } });
  let temporaryPassword: string | undefined;

  if (!user) {
    temporaryPassword = Math.random().toString(36).slice(2, 10);
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    user = await prisma.user.create({
      data: { name: adminName!, email: adminEmail, passwordHash },
    });
  }

  await prisma.companyUser.create({
    data: { companyId: company.id, userId: user.id, role: "ADMIN" },
  });

  console.log(`\nCreated company "${name}" (code: ${code}).`);
  console.log(`BOL numbers will start at ${prefix}-${String(start).padStart(padding, "0")}.`);
  console.log(`Added ${adminEmail} as an admin.`);
  if (temporaryPassword) {
    console.log(`Temporary password: ${temporaryPassword} (share securely; change it after first login).`);
  } else {
    console.log(`This user already existed — reused their existing password.`);
  }
  console.log(
    `\nNext step: log in as ${adminEmail}, go to Admin -> BOL template, and upload this company's blank BOL/tally PDF plus its field layout.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
