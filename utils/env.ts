/**
 * Environment variable schema definition
 * Defines all required environment variables with their validation rules
 */
interface EnvSchema {
  DATABASE_URL: string;
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
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
      } else {
        invalidVars.push(key);
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
        } else {
          invalidVars.push(key);
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
 * Gets a typed environment variable value
 * @param key - The environment variable key
 * @returns The validated environment variable value
 * @throws EnvValidationError if the variable is not validated or missing
 */
export function getEnv<K extends keyof EnvSchema>(key: K): EnvSchema[K] {
  const env = parseEnv();
  const value = env[key];
  
  if (value === undefined) {
    throw new EnvValidationError([key], []);
  }
  
  return value;
}

/**
 * Checks if all required environment variables are valid
 * @returns True if all required variables are present and valid
 */
export function isEnvValid(): boolean {
  try {
    parseEnv();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets all validated environment variables
 * @returns Complete validated environment configuration
 */
export function getAllEnv(): EnvSchema {
  return parseEnv();
}