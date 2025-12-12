/**
 * Prisma Client Singleton
 * Why: Prevents multiple Prisma client instances in development due to hot reloading.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Global type declaration for Prisma client singleton.
 * Why: TypeScript needs to know about the global prisma property.
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma client instance.
 * Why: Reuses existing client in development, creates new one in production.
 */
export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;


