import { z } from 'zod';

const saveProfileSchemaBase = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  dobDay: z.coerce.number().min(1).max(31),
  dobMonth: z.coerce.number().min(1).max(12),
  dobYear: z.coerce.number().min(1900).max(new Date().getFullYear()),
  city: z.string().min(2, 'City must be at least 2 characters'),
  gender: z.string(),
  showGender: z.boolean().optional().default(true),
  orientation: z.string(),
  showOrientation: z.boolean().optional().default(true),
  relationshipIntent: z.string(),
  relationshipStatus: z.string(),
  interests: z.array(z.string()).min(3, 'Select at least 3 interests'),
  story: z.string().min(20, 'Story must be at least 20 characters'),
  hasDisability: z.boolean().optional().default(false),
  disabilityInfo: z.string().optional(),
  showDisability: z.boolean().optional().default(false),
  photos: z.array(z.string()).min(1, 'Upload at least 1 photo'),
  voiceIntroUrl: z.string().optional().nullable(),
  sparkNote: z.string().max(20, 'Spark note must be 20 characters or less').optional().nullable(),
  languages: z.array(z.string()).optional(),
  education: z.string().optional(),
  occupation: z.string().optional(),
});

export const saveProfileSchema = saveProfileSchemaBase.refine((data) => {
  const { dobDay, dobMonth, dobYear } = data;
  const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const maxDays = (dobMonth === 2)
    ? (isLeapYear(dobYear) ? 29 : 28)
    : ([4, 6, 9, 11].includes(dobMonth) ? 30 : 31);
  return dobDay <= maxDays;
}, {
  message: 'Invalid day of birth for the selected month/year',
  path: ['dobDay'],
});
