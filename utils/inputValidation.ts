import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// Re-export Zod for consumers who need it
export { z };

// ============================================
// Core Validation Schemas
// ============================================

export const PlayerCreateInputSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters')
    .toLowerCase(),
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .optional(),
  avatarUrl: z.string()
    .url('Invalid avatar URL')
    .max(500, 'Avatar URL too long')
    .optional()
    .nullable(),
});

export const PlayerUpdateInputSchema = z.object({
  displayName: z.string()
    .min(1, 'Display name cannot be empty')
    .max(50, 'Display name must be at most 50 characters')
    .optional(),
  avatarUrl: z.string()
    .url('Invalid avatar URL')
    .max(500, 'Avatar URL too long')
    .optional()
    .nullable(),
  preferences: z.record(z.unknown()).optional(),
});

export const GameSessionCreateInputSchema = z.object({
  gameType: z.enum(['tictactoe', 'connect4', 'chess', 'custom'], {
    errorMap: () => ({ message: 'Invalid game type' }),
  }),
  playerIds: z.array(z.string().uuid('Invalid player ID'))
    .min(2, 'At least 2 players required')
    .max(4, 'Maximum 4 players allowed'),
  settings: z.record(z.unknown()).optional(),
  isRanked: z.boolean().default(false),
});

export const GameStateUpdateInputSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  playerId: z.string().uuid('Invalid player ID'),
  action: z.string().min(1, 'Action is required').max(100, 'Action too long'),
  payload: z.record(z.unknown()).optional(),
  timestamp: z.number().int().positive('Timestamp must be positive').optional(),
});

// ============================================
// Type Exports
// ============================================

export type PlayerCreateInput = z.infer<typeof PlayerCreateInputSchema>;
export type PlayerUpdateInput = z.infer<typeof PlayerUpdateInputSchema>;
export type GameSessionCreateInput = z.infer<typeof GameSessionCreateInputSchema>;
export type GameStateUpdateInput = z.infer<typeof GameStateUpdateInputSchema>;

// ============================================
// Sanitization Utilities
// ============================================

/**
 * Sanitizes a string to prevent XSS attacks
 * Removes HTML tags, javascript: protocols, and event handlers
 */
export function sanitizeString(input: string, options: {
  maxLength?: number;
  allowHtml?: boolean;
  stripTags?: boolean;
} = {}): string {
  const { maxLength = 1000, allowHtml = false, stripTags = true } = options;
  
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim();

  // Length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }

  if (!allowHtml && stripTags) {
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Remove javascript: protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Remove event handlers (onclick, onload, etc.)
    sanitized = sanitized.replace(/\son\w+\s*=/gi, '');
    
    // Remove data: URLs that could contain scripts
    sanitized = sanitized.replace(/data:/gi, '');
  }

  // Encode remaining HTML entities for safe display
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * Sanitizes input for safe use in SQL queries (parameterized queries should be used instead)
 * This is a defense-in-depth measure, NOT a replacement for parameterized queries
 */
export function sanitizeSql(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE)\b/gi, '');
}

/**
 * Sanitizes file paths to prevent directory traversal attacks
 */
export function sanitizePath(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/')
    .replace(/\\+/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * Sanitizes HTML content allowing only safe tags and attributes
 */
export function sanitizeHtml(input: string, allowedTags: string[] = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li']): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  const tagRegex = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  return input.replace(tagRegex, (match, tagName) => {
    const lowerTag = tagName.toLowerCase();
    if (allowedTags.includes(lowerTag)) {
      // Remove any attributes from allowed tags for safety
      return match.replace(/\s+[a-z-]+(\s*=\s*(".*?"|'.*?'|[^'">\s]+))?/gi, '');
    }
    return '';
  });
}

/**
 * Deep sanitizes an object, applying sanitizeString to all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T, options?: Parameters<typeof sanitizeString>[1]): T {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, options);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>, options);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item, options) : 
        item && typeof item === 'object' ? sanitizeObject(item as Record<string, unknown>, options) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized as T;
}

// ============================================
// Validation Middleware
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  received?: unknown;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

function formatZodError(error: z.ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: err.received,
  }));
}

/**
 * Creates a validation middleware for request body
 */
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return async (request: NextRequest): Promise<ValidationResult<z.infer<T>>> => {
    try {
      const body = await request.json();
      const sanitizedBody = sanitizeObject(body);
      const result = schema.safeParse(sanitizedBody);
      
      if (!result.success) {
        return {
          success: false,
          errors: formatZodError(result.error),
        };
      }
      
      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          success: false,
          errors: [{
            field: 'body',
            message: 'Invalid JSON in request body',
            code: 'invalid_json',
          }],
        };
      }
      throw error;
    }
  };
}

/**
 * Creates a validation middleware for query parameters
 */
export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (request: NextRequest): ValidationResult<z.infer<T>> => {
    const searchParams = request.nextUrl.searchParams;
    const queryObj: Record<string, string | string[]> = {};
    
    for (const [key, value] of searchParams.entries()) {
      if (queryObj[key]) {
        if (Array.isArray(queryObj[key])) {
          (queryObj[key] as string[]).push(value);
        } else {
          queryObj[key] = [queryObj[key] as string, value];
        }
      } else {
        queryObj[key] = value;
      }
    }
    
    const sanitizedQuery = sanitizeObject(queryObj);
    const result = schema.safeParse(sanitizedQuery);
    
    if (!result.success) {
      return {
        success: false,
        errors: formatZodError(result.error),
      };
    }
    
    return {
      success: true,
      data: result.data,
    };
  };
}

/**
 * Creates a validation middleware for route parameters
 */
export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (params: Record<string, string>): ValidationResult<z.infer<T>> => {
    const sanitizedParams = sanitizeObject(params);
    const result = schema.safeParse(sanitizedParams);
    
    if (!result.success) {
      return {
        success: false,
        errors: formatZodError(result.error),
      };
    }
    
    return {
      success: true,
      data: result.data,
    };
  };
}

// ============================================
// API Route Wrapper
// ============================================

export interface ValidationSchemas {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>>; validatedData: T }
) => Promise<NextResponse>;

export function withValidation<T extends ValidationSchemas>(
  handler: ApiHandler,
  schemas: T
) {
  return async (request: NextRequest, context: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    const validatedData: Record<string, unknown> = {};
    
    // Validate params if schema provided
    if (schemas.params) {
      const params = await context.params;
      const paramsResult = validateParams(schemas.params)(params);
      if (!paramsResult.success) {
        return NextResponse.json(
          { 
            error: 'Validation failed', 
            details: paramsResult.errors,
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
      validatedData.params = paramsResult.data;
    }
    
    // Validate query if schema provided
    if (schemas.query) {
      const queryResult = validateQuery(schemas.query)(request);
      if (!queryResult.success) {
        return NextResponse.json(
          { 
            error: 'Validation failed', 
            details: queryResult.errors,
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
      validatedData.query = queryResult.data;
    }
    
    // Validate body if schema provided
    if (schemas.body) {
      const bodyResult = await validateBody(schemas.body)(request);
      if (!bodyResult.success) {
        return NextResponse.json(
          { 
            error: 'Validation failed', 
            details: bodyResult.errors,
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }
      validatedData.body = bodyResult.data;
    }
    
    // Call the handler with validated data
    return handler(request, { 
      params: context.params, 
      validatedData: validatedData as T 
    });
  };
}

// ============================================
// Pre-built Validation Schemas for Common Use Cases
// ============================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const IdParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const UuidParamSchema = z.object({
  uuid: z.string().uuid('Invalid UUID format'),
});

// ============================================
// Utility: Create validated API route handlers
// ============================================

export function createValidatedHandler<T extends ValidationSchemas>(
  schemas: T,
  handler: ApiHandler
) {
  return withValidation(handler, schemas);
}