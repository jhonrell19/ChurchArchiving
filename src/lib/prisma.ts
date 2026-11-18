import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { authDatabaseUrl } from "./postgres-url";

const adapter = new PrismaPg(
  { connectionString: authDatabaseUrl(), max: 4, connectionTimeoutMillis: 10000 },
  { schema: "parish_auth" },
);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}