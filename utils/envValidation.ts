// utils/envValidation.ts

/**
 * Environment variable validation utilities with strict schema validation
 * and fail-fast startup checks. Uses native TypeScript validation without external dependencies.
 */

// Define the shape of validated environment configuration
export interface EnvConfig {
  // Required variables
  DATABASE_URL: string;
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  REDIS_URL: string;
  OTEL_EXPORTER_OTLP_ENDPOINT: string;
  NEXT_PUBLIC_API_URL: string;
  
  // Optional variables with defaults
  NEXT_PUBLIC_GSAP_DEBUG: boolean;
  NEXT_PUBLIC_OGL_DEBUG: boolean;
  NODE_ENV: 'development' | 'production' | 'test';
}

// Internal cache for validated environment
let validatedEnv: EnvConfig | null = null;

/**
 * Validates a single environment variable with custom validation logic
 */
function validateRequired(
  key: string,
  value: string | undefined,
  validator?: (val: string) => boolean,
  errorMessage?: string
): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  
  if (validator && !validator(value)) {
    throw new Error(errorMessage || `Invalid value for ${key}: ${value}`);
  }
  
  return value.trim();
}

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that a string is at least minimum length
 */
function minLength(min: number) {
  return (val: string): boolean => val.length >= min;
}

/**
 * Parses boolean from string environment variable
 */
function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Validates NODE_ENV is one of the allowed values
 */
function validateNodeEnv(value: string | undefined): 'development' | 'production' | 'test' {
  const allowed = ['development', 'production', 'test'] as const;
  const env = (value || 'development').toLowerCase();
  
  if (!allowed.includes(env as typeof allowed[number])) {
    throw new Error(`NODE_ENV must be one of: ${allowed.join(', ')}, got: ${env}`);
  }
  
  return env as 'development' | 'production' | 'test';
}

/**
 * Validates Redis URL format (redis:// or rediss://)
 */
function isValidRedisUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'redis:' || parsed.protocol === 'rediss:';
  } catch {
    return false;
  }
}

/**
 * Validates all environment variables and returns typed configuration.
 * Throws descriptive errors on missing or invalid configuration.
 * Implements fail-fast behavior for application startup.
 */
export function validateEnv(): EnvConfig {
  // Return cached validation if already performed
  if (validatedEnv) {
    return validatedEnv;
  }

  const errors: string[] = [];
  const config: Partial<EnvConfig> = {};

  try {
    // Required: Database connection string
    config.DATABASE_URL = validateRequired(
      'DATABASE_URL',
      process.env.DATABASE_URL,
      (val) => val.length > 0,
      'DATABASE_URL must not be empty'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    // Required: NextAuth secret (minimum 32 characters for security)
    config.NEXTAUTH_SECRET = validateRequired(
      'NEXTAUTH_SECRET',
      process.env.NEXTAUTH_SECRET,
      minLength(32),
      'NEXTAUTH_SECRET must be at least 32 characters for security'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    // Required: NextAuth URL (must be valid URL)
    config.NEXTAUTH_URL = validateRequired(
      'NEXTAUTH_URL',
      process.env.NEXTAUTH_URL,
      isValidUrl,
      'NEXTAUTH_URL must be a valid URL (e.g., https://example.com)'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    // Required: Redis URL for caching (must be valid redis:// or rediss:// URL)
    config.REDIS_URL = validateRequired(
      'REDIS_URL',
      process.env.REDIS_URL,
      isValidRedisUrl,
      'REDIS_URL must be a valid Redis URL (e.g., redis://localhost:6379 or rediss://user:pass@host:port)'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    // Required: OpenTelemetry exporter endpoint for telemetry
    config.OTEL_EXPORTER_OTLP_ENDPOINT = validateRequired(
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      isValidUrl,
      'OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL (e.g., https://otel-collector:4318/v1/traces)'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    // Required: Public API URL for client-side API calls
    config.NEXT_PUBLIC_API_URL = validateRequired(
      'NEXT_PUBLIC_API_URL',
      process.env.NEXT_PUBLIC_API_URL,
      isValidUrl,
      'NEXT_PUBLIC_API_URL must be a valid URL (e.g., https://api.example.com)'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  // Optional: GSAP debug flag
  config.NEXT_PUBLIC_GSAP_DEBUG = parseBoolean(process.env.NEXT_PUBLIC_GSAP_DEBUG, false);

  // Optional: OGL debug flag
  config.NEXT_PUBLIC_OGL_DEBUG = parseBoolean(process.env.NEXT_PUBLIC_OGL_DEBUG, false);

  // Optional: NODE_ENV with validation
  config.NODE_ENV = validateNodeEnv(process.env.NODE_ENV);

  // If any errors collected, throw aggregated error
  if (errors.length > 0) {
    const errorMessage = [
      'Environment validation failed:',
      ...errors.map((err, i) => `  ${i + 1}. ${err}`),
      '',
      'Please check your .env file and ensure all required variables are set correctly.',
    ].join('\n');
    
    throw new Error(errorMessage);
  }

  // Cache and return validated config
  validatedEnv = config as EnvConfig;
  return validatedEnv;
}

/**
 * Returns the validated environment configuration.
 * Throws if validation hasn't been run or failed.
 * Use this for typed access to environment variables throughout the application.
 */
export function getEnv(): EnvConfig {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Resets the cached validation (useful for testing)
 */
export function resetEnvValidation(): void {
  validatedEnv = null;
}

/**
 * Type-safe accessor for a specific environment variable
 */
export function getEnvVar<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
  return getEnv()[key];
}

// Run validation at module load time in non-test environments
// This ensures fail-fast behavior during application startup
if (process.env.NODE_ENV !== 'test') {
  // Use IIFE to avoid top-level await and handle errors gracefully
  (() => {
    try {
      validateEnv();
    } catch (error) {
      // In development, log the error but don't throw to allow hot-reloading
      // In production, the error will be thrown by getEnv() when first accessed
      if (process.env.NODE_ENV === 'development') {
        console.error('[envValidation] Environment validation failed:', error instanceof Error ? error.message : String(error));
      }
    }
  })();
}