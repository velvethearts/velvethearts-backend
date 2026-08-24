import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Ensure database enum values are up to date on connection
prisma.$executeRawUnsafe(`ALTER TYPE "DiarySourceType" ADD VALUE IF NOT EXISTS 'VIDEO';`).catch(() => {});

(prisma as any).$on('query', (e: any) => {
  logger.debug(`Query: ${e.query} | Params: ${e.params} | Duration: ${e.duration}ms`);
});

(prisma as any).$on('error', (e: any) => {
  logger.error(`Prisma Error: ${e.message}`);
});

(prisma as any).$on('warn', (e: any) => {
  logger.warn(`Prisma Warning: ${e.message}`);
});

(prisma as any).$on('info', (e: any) => {
  logger.info(`Prisma Info: ${e.message}`);
});
