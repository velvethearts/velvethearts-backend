import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // Add column if not exists
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT;`);
    
    // Sync existing profile names to User table
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "User" u SET name = p.name FROM "Profile" p WHERE u.id = p."userId" AND (u.name IS NULL OR u.name = '');`
    );
    console.log('Successfully synced user names in Neon database User table:', result);
  } catch (err) {
    console.error('Error syncing user names:', err);
    process.exitCode = 1;
    throw err;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
