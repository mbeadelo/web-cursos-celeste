import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: required("DATABASE_URL") }),
});

async function main() {
  // ADMIN_EMAIL (singular, required) is the bootstrap/recovery admin.
  // ADMIN_EMAILS (optional, comma-separated) pins extra co-owner admins.
  // Both are upserted to ADMIN. Deduped + lowercased so the same email in both
  // vars doesn't run twice.
  const emails = [
    ...new Set(
      [required("ADMIN_EMAIL"), ...(process.env.ADMIN_EMAILS ?? "").split(",")]
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  for (const email of emails) {
    const user = await db.user.upsert({
      where: { email },
      update: { role: "ADMIN" },
      create: { email, role: "ADMIN" },
    });
    console.log(`✔ Admin asegurado: ${user.email} (id=${user.id}, role=${user.role})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
