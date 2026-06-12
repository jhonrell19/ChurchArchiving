import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

const prisma = new PrismaClient({
  adapter,
});

async function createUser(
  fullName: string,
  email: string,
  password: string,
  role: string
) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { email },
      data: {
        fullName,
        role,
      },
    });

    console.log(`${role} already exists, role updated: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      fullName,
      email,
      password: hashedPassword,
      role,
    },
  });

  console.log(`${role} account created: ${email}`);
}

async function main() {
  await createUser(
    "Parish Administrator",
    "admin@ifimaragondon.com",
    "Admin12345",
    "admin"
  );

  await createUser(
    "Burial Office Administrator",
    "burial@ifimaragondon.com",
    "Burial12345",
    "burial_admin"
  );

  console.log("");
  console.log("Main Admin Account:");
  console.log("Email: admin@ifimaragondon.com");
  console.log("Password: Admin12345");
  console.log("");
  console.log("Burial Admin Account:");
  console.log("Email: burial@ifimaragondon.com");
  console.log("Password: Burial12345");
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });