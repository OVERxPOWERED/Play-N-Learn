/**
 * Environment variable schema definition
 * Defines all required environment variables with their validation rules
 */
interface EnvSchema {
  DATABASE_URL: string;
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  GAME_API_KEY: string;
  OGL_CDN_URL: string;
  API_RATE_LIMIT: string;
  REDIS_URL?: string;
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
 * Validates positive integer string
 */
function validatePositiveInteger(value: string): string {
  const num = parseInt(value.trim(), 10);
  if (isNaN(num) || num <= 0) {
    throw new Error('Must be a positive integer');
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

  const requiredVars: Array<{
    key: keyof EnvSchema;
    validator?: (value: string) => string;
  }> = [
    { key: 'DATABASE_URL', validator: validateNonEmpty },
    { key: 'NEXTAUTH_SECRET', validator: validateNonEmpty },
    { key: 'NEXTAUTH_URL', validator: validateUrl },
    { key: 'GAME_API_KEY', validator: validateNonEmpty },
    { key: 'OGL_CDN_URL', validator: validateUrl },
    { key: 'API_RATE_LIMIT', validator: validatePositiveInteger },
  ];

  const optionalVars: Array<{
    key: keyof EnvSchema;
    validator?: (value: string) => string;
  }> = [
    { key: 'REDIS_URL', validator: validateUrl },
  ];

  const missingVars: string[] = [];
  const invalidVars: string[] = [];
  const result: Partial<EnvSchema> = {};

  // Validate required variables
  for (const { key, validator } of requiredVars) {
    const value = process.env[key];
    try {
      result[key] = validateEnvVar(key, value, validator);
    } catch (error) {
      if (error instanceof EnvValidationError) {
        missingVars.push(...error.missingVars);
        invalidVars.push(...error.invalidVars);
      }
    }
  }

  // Validate optional variables
  for (const { key, validator } of optionalVars) {
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      try {
        result[key] = validateEnvVar(key, value, validator);
      } catch (error) {
        if (error instanceof EnvValidationError) {
          invalidVars.push(...error.invalidVars);
        }
      }
    }
  }

  if (missingVars.length > 0 || invalidVars.length > 0) {
    throw new EnvValidationError(missingVars, invalidVars);
  }

  validatedEnv = result as EnvSchema;
  return validatedEnv;
}

/**
 * Returns the validated environment configuration
 * Throws if environment has not been validated yet
 * @returns Validated environment configuration object
 */
export function getEnv(): EnvSchema {
  if (!validatedEnv) {
    return parseEnv();
  }
  return validatedEnv;
}

/**
 * Resets the validated environment cache
 * Useful for testing or re-validation scenarios
 */
export function resetEnv(): void {
  validatedEnv = null;
}

// Validate environment on module load in production
if (process.env.NODE_ENV === 'production') {
  parseEnv();
}

export type { EnvSchema };