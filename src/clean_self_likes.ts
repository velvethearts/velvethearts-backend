import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`DELETE FROM "Like" WHERE "senderId" = "receiverId";`);
  console.log('Successfully removed self likes:', result);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
