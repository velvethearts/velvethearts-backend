import { z } from 'zod';

export const firebaseLoginSchema = z.object({
  firebaseIdToken: z.string({
    required_error: 'Firebase ID token is required',
  }),
});
