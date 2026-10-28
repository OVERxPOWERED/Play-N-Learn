import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // OGL/GSAP config vars (optional, with defaults)
  NEXT_PUBLIC_GSAP_DEBUG: z.string().optional(),
  NEXT_PUBLIC_OGL_DEBUG: z.string().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

let validatedEnv: EnvConfig | null = null;

export function validateEnv(): EnvConfig {
  if (validatedEnv) {
    return validatedEnv;
  }

  const rawEnv = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_GSAP_DEBUG: process.env.NEXT_PUBLIC_GSAP_DEBUG,
    NEXT_PUBLIC_OGL_DEBUG: process.env.NEXT_PUBLIC_OGL_DEBUG,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.errors.map(
      (err) => `${err.path.join('.')}: ${err.message}`
    );
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
    throw new Error(errorMessage);
  }

  validatedEnv = result.data;
  return validatedEnv;
}

export function getEnv(): EnvConfig {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

export type { EnvConfig };