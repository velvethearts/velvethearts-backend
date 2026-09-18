/**
 * Error message sanitization utility
 * Ensures technical errors (Prisma, database outages, connection timeouts, SQL strings)
 * are NEVER leaked in user-facing HTTP responses.
 */

export function sanitizeErrorMessage(
  error: any,
  fallbackMessage = 'Unable to process your request right now. Please try again after a while.'
): string {
  if (!error) return fallbackMessage;

  const msg = typeof error === 'string' ? error : (error.message || '');
  const lower = msg.toLowerCase();

  // Known technical / internal system patterns to filter out
  const isTechnical =
    lower.includes('prisma') ||
    lower.includes('database') ||
    lower.includes('can\'t reach') ||
    lower.includes('quota') ||
    lower.includes('connect') ||
    lower.includes('connection') ||
    lower.includes('postgres') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('enotfound') ||
    lower.includes('sql') ||
    lower.includes('syntax') ||
    lower.includes('constraint') ||
    lower.includes('foreign key') ||
    lower.includes('duplicate key') ||
    lower.includes('invalid invocation') ||
    lower.includes('deadlock') ||
    lower.includes('token') ||
    lower.includes('select ') ||
    lower.includes('insert ') ||
    lower.includes('update ') ||
    lower.includes('delete ') ||
    lower.includes('neon.tech') ||
    (error.name && error.name.toLowerCase().includes('prisma'));

  if (isTechnical) {
    return 'Our servers are experiencing a brief moment. Please try again after a while.';
  }

  return msg || fallbackMessage;
}
