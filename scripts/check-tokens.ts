import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL not set");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const tokens = await db.verificationToken.findMany({
    orderBy: { expires: "desc" },
  });
  console.log(`VerificationToken rows: ${tokens.length}`);
  for (const t of tokens) {
    console.log(`  identifier=${t.identifier}  expires=${t.expires.toISOString()}`);
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
