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
  TELEMETRY_ENDPOINT: string;
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
    // Required: Telemetry endpoint for observability
    config.TELEMETRY_ENDPOINT = validateRequired(
      'TELEMETRY_ENDPOINT',
      process.env.TELEMETRY_ENDPOINT,
      isValidUrl,
      'TELEMETRY_ENDPOINT must be a valid URL'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  try {
    // Required: Public API URL for client-side requests
    config.NEXT_PUBLIC_API_URL = validateRequired(
      'NEXT_PUBLIC_API_URL',
      process.env.NEXT_PUBLIC_API_URL,
      isValidUrl,
      'NEXT_PUBLIC_API_URL must be a valid URL'
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  // Optional: GSAP debug mode (defaults to false)
  config.NEXT_PUBLIC_GSAP_DEBUG = parseBoolean(process.env.NEXT_PUBLIC_GSAP_DEBUG, false);

  // Optional: OGL debug mode (defaults to false)
  config.NEXT_PUBLIC_OGL_DEBUG = parseBoolean(process.env.NEXT_PUBLIC_OGL_DEBUG, false);

  // Optional: Node environment (defaults to development)
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv === 'test') {
    config.NODE_ENV = nodeEnv;
  } else {
    config.NODE_ENV = 'development';
  }

  // If any errors collected, throw aggregated error
  if (errors.length > 0) {
    const errorMessage = [
      'Environment validation failed at startup:',
      ...errors.map((err, i) => `  ${i + 1}. ${err}`),
      '',
      'Please check your .env file or deployment environment configuration.',
    ].join('\n');
    
    throw new Error(errorMessage);
  }

  // Cache and return fully validated config
  validatedEnv = config as EnvConfig;
  return validatedEnv;
}

/**
 * Returns validated environment configuration.
 * Calls validateEnv() if not already validated.
 * Use this in application code to access typed environment variables.
 */
export function getEnv(): EnvConfig {
  if (!validatedEnv) {
    return validateEnv();
  }
  return validatedEnv;
}

/**
 * Resets the validation cache. Primarily useful for testing.
 * @internal
 */
export function resetEnvValidation(): void {
  validatedEnv = null;
}

/**
 * Checks if environment has been validated without throwing.
 * Useful for health checks or conditional initialization.
 */
export function isEnvValidated(): boolean {
  return validatedEnv !== null;
}