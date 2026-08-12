import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // [L-1 FIX] Use safe tagged template $executeRaw instead of $executeRawUnsafe
  const result = await prisma.$executeRaw`DELETE FROM "Like" WHERE "senderId" = "receiverId";`;
  console.log('Successfully removed self likes:', result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
