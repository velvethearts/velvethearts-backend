import { z } from 'zod';

export const blockSchema = z.object({
  blockedUserId: z.string().uuid('Invalid user ID format'),
  reason: z.string().optional(),
});

export const reportSchema = z.object({
  targetUserId: z.string().uuid('Invalid target user ID format'),
  reason: z.string().min(3, 'Reason must specify details'),
  comment: z.string().optional(),
});
export type BlockInput = z.infer<typeof blockSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
