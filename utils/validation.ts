```typescript
import { NextRequest, NextResponse } from 'next/server';

export class ValidationError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
    
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export interface EnvSchema {
  NEXTAUTH_SECRET: string;
  DATABASE_URL: string;
  NEXTAUTH_URL: string;
  NODE_ENV: 'development' | 'production' | 'test';
  [key: string]: string | undefined;
}

const requiredEnvVars: (keyof EnvSchema)[] = [
  'NEXTAUTH_SECRET',
  'DATABASE_URL',
  'NEXTAUTH_URL',
];

export function validateEnv(): EnvSchema {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const key of requiredEnvVars) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else if (key === 'NEXTAUTH_SECRET' && value.length < 32) {
      invalid.push(`${key} must be at least 32 characters`);
    } else if (key === 'DATABASE_URL' && !value.startsWith('postgresql://') && !value.startsWith('postgres://')) {
      invalid.push(`${key} must be a valid PostgreSQL connection string`);
    } else if (key === 'NEXTAUTH_URL' && !isValidUrl(value)) {
      invalid.push(`${key} must be a valid URL`);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const messages: string[] = [];
    if (missing.length > 0) {
      messages.push(`Missing required environment variables: ${missing.join(', ')}`);
    }
    if (invalid.length > 0) {
      messages.push(`Invalid environment variables: ${invalid.join('; ')}`);
    }
    throw new ValidationError(messages.join(' | '), {
      missing: missing.length > 0 ? missing : undefined,
      invalid: invalid.length > 0 ? invalid : undefined,
    } as Record<string, string[]>);
  }

  return {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    DATABASE_URL: process.env.DATABASE_URL!,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL!,
    NODE_ENV: (process.env.NODE_ENV as EnvSchema['NODE_ENV']) || 'development',
  };
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<img\b[^>]*onerror\s*=/gi,
  /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi,
];

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

export function sanitizeInput(input: string, options: { allowHtml?: boolean; maxLength?: number } = {}): string {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  if (!options.allowHtml) {
    sanitized = sanitized.replace(/[&<>"'/]/g, (char) => HTML_ENTITIES[char] || char);
  }

  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.slice(0, options.maxLength);
  }

  return sanitized.trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T, options?: { allowHtml?: boolean; maxLength?: number }): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value, options);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => 
        typeof item === 'string' ? sanitizeInput(item, options) : 
        typeof item === 'object' && item !== null ? sanitizeObject(item as Record<string, unknown>, options) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

export interface ValidationSchema<T> {
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: ValidationError };
}

export function createSchema<T>(validator: (data: unknown) => T, errorMessage: string = 'Validation failed'): ValidationSchema<T> {
  return {
    parse: (data: unknown) => {
      try {
        return validator(data);
      } catch (error) {
        if (error instanceof ValidationError) throw error;
        throw new ValidationError(errorMessage, { _schema: [error instanceof Error ? error.message : 'Unknown validation error'] });
      }
    },
    safeParse: (data: unknown) => {
      try {
        return { success: true, data: validator(data) };
      } catch (error) {
        const validationError = error instanceof ValidationError ? error : new ValidationError(errorMessage, { _schema: [error instanceof Error ? error.message : 'Unknown validation error'] });
        return { success: false, error: validationError };
      }
    },
  };
}

export function stringSchema(minLength = 0, maxLength?: number) {
  return createSchema<string>((data) => {
    if (typeof data !== 'string') throw new ValidationError('Expected string');
    if (data.length < minLength) throw new ValidationError(`String must be at least ${minLength} characters`);
    if (maxLength !== undefined && data.length > maxLength) throw new ValidationError(`String must be at most ${maxLength} characters`);
    return data;
  });
}

export function number