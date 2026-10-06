import { type NextAuthConfig } from 'next-auth';

/**
 * Environment variable schema definition
 * Defines all required environment variables with their validation rules
 */
interface EnvSchema {
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APPLE_CLIENT_ID: string;
  APPLE_TEAM_ID: string;
  APPLE_KEY_ID: string;
  APPLE_PRIVATE_KEY: string;
}

/**
 * Validated environment configuration
 * Populated at module initialization with parsed and validated values
 */
let validatedEnv: EnvSchema | null = null;

/**
 * Validation error class for descriptive error messages
 */
export class EnvValidationError extends Error {
  public readonly missingVars: string[];
  public readonly invalidVars: string[];

  constructor(missingVars: string[] = [], invalidVars: string[] = []) {
    const messages: string[] = [];
    
    if (missingVars.length > 0) {
      messages.push(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    if (invalidVars.length > 0) {
      messages.push(`Invalid environment variables: ${invalidVars.join(', ')}`);
    }

    super(messages.join('; ') || 'Environment validation failed');
    this.name = 'EnvValidationError';
    this.missingVars = missingVars;
    this.invalidVars = invalidVars;
    
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EnvValidationError);
    }
  }
}

/**
 * Validates a single environment variable
 * @param key - The environment variable name
 * @param value - The environment variable value (or undefined)
 * @param validator - Optional custom validation function
 * @returns The validated value
 * @throws EnvValidationError if validation fails
 */
function validateEnvVar<T>(
  key: string,
  value: string | undefined,
  validator?: (value: string) => T
): T {
  if (value === undefined || value === '') {
    throw new EnvValidationError([key], []);
  }

  if (validator) {
    try {
      return validator(value);
    } catch {
      throw new EnvValidationError([], [key]);
    }
  }

  return value as T;
}

/**
 * Validates URL format
 */
function validateUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    return value;
  } catch {
    throw new Error('Invalid URL format');
  }
}

/**
 * Validates non-empty string
 */
function validateNonEmpty(value: string): string {
  if (value.trim().length === 0) {
    throw new Error('Empty value');
  }
  return value;
}

/**
 * Validates base64 or PEM format private key
 */
function validatePrivateKey(value: string): string {
  const trimmed = value.trim();
  // Check for PEM format (-----BEGIN ... PRIVATE KEY-----)
  const isPem = /^-----BEGIN [A-Z ]+PRIVATE KEY-----/m.test(trimmed);
  // Check for base64 format (common for Apple private keys)
  const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed.replace(/\s/g, ''));
  
  if (!isPem && !isBase64 && trimmed.length < 32) {
    throw new Error('Invalid private key format');
  }
  
  return value;
}

/**
 * Parses and validates all required environment variables
 * @returns Validated environment configuration object
 * @throws EnvValidationError if any required variable is missing or invalid
 */
export function parseEnv(): EnvSchema {
  if (validatedEnv) {
    return validatedEnv;
  }

  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  const requiredVars: Array<{
    key: keyof EnvSchema;
    validator?: (value: string) => string;
  }> = [
    { key: 'NEXTAUTH_SECRET', validator: validateNonEmpty },
    { key: 'NEXTAUTH_URL', validator: validateUrl },
    { key: 'DATABASE_URL', validator: validateNonEmpty },
    { key: 'GOOGLE_CLIENT_ID', validator: validateNonEmpty },
    { key: 'GOOGLE_CLIENT_SECRET', validator: validateNonEmpty },
    { key: 'GITHUB_CLIENT_ID', validator: validateNonEmpty },
    { key: 'GITHUB_CLIENT_SECRET', validator: validateNonEmpty },
    { key: 'APPLE_CLIENT_ID', validator: validateNonEmpty },
    { key: 'APPLE_TEAM_ID', validator: validateNonEmpty },
    { key: 'APPLE_KEY_ID', validator: validateNonEmpty },
    { key: 'APPLE_PRIVATE_KEY', validator: validatePrivateKey },
  ];

  const env: Partial<EnvSchema> = {};

  for (const { key, validator } of requiredVars) {
    try {
      env[key] = validateEnvVar(key, process.env[key], validator);
    } catch (error) {
      if (error instanceof EnvValidationError) {
        missingVars.push(...error.missingVars);
        invalidVars.push(...error.invalidVars);
      } else {
        invalidVars.push(key);
      }
    }
  }

  if (missingVars.length > 0 || invalidVars.length > 0) {
    throw new EnvValidationError(missingVars, invalidVars);
  }

  validatedEnv = env as EnvSchema;
  return validatedEnv;
}

/**
 * Gets the validated environment configuration
 * Parses on first call, returns cached result on subsequent calls
 * @returns Validated environment configuration
 */
export function getEnv(): EnvSchema {
  return parseEnv();
}

/**
 * Checks if the application is running in production mode
 * @returns True if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Checks if the application is running in development mode
 * @returns True if NODE_ENV is 'development' or not set
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * Checks if the application is running in test mode
 * @returns True if NODE_ENV is 'test'
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Gets the NextAuth configuration options from environment
 * Useful for constructing NextAuth config dynamically
 * @returns NextAuth configuration object
 */
export function getNextAuthConfig(): Partial<NextAuthConfig> {
  const env = getEnv();
  
  return {
    secret: env.NEXTAUTH_SECRET,
    url: env.NEXTAUTH_URL,
    // Additional NextAuth options can be added here
  };
}

/**
 * Resets the cached environment configuration
 * Primarily useful for testing
 */
export function resetEnvCache(): void {
  validatedEnv = null;
}

/**
 * Type-safe access to individual environment variables
 * Throws if the variable hasn't been validated yet
 */
export const env = {
  get NEXTAUTH_SECRET(): string {
    return getEnv().NEXTAUTH_SECRET;
  },
  get NEXTAUTH_URL(): string {
    return getEnv().NEXTAUTH_URL;
  },
  get DATABASE_URL(): string {
    return getEnv().DATABASE_URL;
  },
  get GOOGLE_CLIENT_ID(): string {
    return getEnv().GOOGLE_CLIENT_ID;
  },
  get GOOGLE_CLIENT_SECRET(): string {
    return getEnv().GOOGLE_CLIENT_SECRET;
  },
  get GITHUB_CLIENT_ID(): string {
    return getEnv().GITHUB_CLIENT_ID;
  },
  get GITHUB_CLIENT_SECRET(): string {
    return getEnv().GITHUB_CLIENT_SECRET;
  },
  get APPLE_CLIENT_ID():