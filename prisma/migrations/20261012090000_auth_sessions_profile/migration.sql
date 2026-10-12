-- Upgrade the original prototype User table to the current account/profile model.
-- This migration is intended for a migration-managed database. Existing local
-- development databases that have been managed with `prisma db push` should
-- continue using `prisma db push` instead of replaying historical migrations.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "firstName" TEXT,
    "middleName" TEXT,
    "surname" TEXT,
    "phoneNumber" TEXT,
    "address" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" (
    "id", "firstName", "middleName", "surname", "phoneNumber", "address",
    "email", "password", "role", "createdAt", "updatedAt"
)
SELECT
    "id",
    "fullName",
    NULL,
    NULL,
    NULL,
    NULL,
    LOWER("email"),
    "password",
    CASE LOWER("role")
        WHEN 'admin' THEN 'ADMIN'
        WHEN 'burial_admin' THEN 'BURIAL_ADMIN'
        ELSE 'USER'
    END,
    "createdAt",
    "createdAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

PRAGMA foreign_keys=ON;
