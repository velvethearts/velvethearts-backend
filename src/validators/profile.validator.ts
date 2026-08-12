import { z } from 'zod';

// [H-3 FIX] Validate photo URLs are Cloudinary URLs or valid HTTPS URLs
const cloudinaryPhotoUrl = z.string().url('Invalid photo URL').refine(
  url => url.startsWith('https://res.cloudinary.com/') || url.startsWith('https://images.unsplash.com/'),
  { message: 'Photo must be hosted on an approved CDN' }
);

const saveProfileSchemaBase = z.object({
  // [M-5 FIX] Add max-length constraints to all string fields
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be 100 characters or less'),
  dobDay: z.coerce.number().min(1).max(31),
  dobMonth: z.coerce.number().min(1).max(12),
  dobYear: z.coerce.number().min(1900).max(new Date().getFullYear()),
  city: z.string().min(2, 'City must be at least 2 characters').max(100, 'City must be 100 characters or less'),
  gender: z.string().max(50),
  showGender: z.boolean().optional().default(true),
  orientation: z.string().max(50),
  showOrientation: z.boolean().optional().default(true),
  relationshipIntent: z.string().max(100),
  relationshipStatus: z.string().max(100),
  interests: z.array(z.string().min(1).max(50)).min(3, 'Select at least 3 interests').max(30, 'Maximum 30 interests'),
  story: z.string().min(20, 'Story must be at least 20 characters').max(5000, 'Story must be 5000 characters or less'),
  hasDisability: z.boolean().optional().default(false),
  disabilityInfo: z.string().max(1000).optional(),
  showDisability: z.boolean().optional().default(false),
  // [H-3 FIX] Restrict photos to approved CDN URLs
  photos: z.array(cloudinaryPhotoUrl).min(1, 'Upload at least 1 photo').max(10, 'Maximum 10 photos'),
  // [H-4 FIX] Validate voiceIntroUrl is a proper URL on approved CDN
  voiceIntroUrl: z.string().url('Invalid voice intro URL').refine(
    url => url.startsWith('https://res.cloudinary.com/') || url.startsWith('https://actions.google.com/'),
    { message: 'Voice intro must be hosted on an approved CDN' }
  ).optional().nullable(),
  sparkNote: z.string().max(20, 'Spark note must be 20 characters or less').optional().nullable(),
  languages: z.array(z.string().max(50)).max(10).optional(),
  education: z.string().max(200).optional(),
  occupation: z.string().max(200).optional(),
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
