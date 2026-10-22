```typescript
import { z } from 'zod';

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
export function sanitizeForSql(input: string): string {
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

// ============================================
// Validation Functions
// ============================================

/**
 * Validates email format with additional security checks
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  if (typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }

  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'Email must be at most 255 characters' };
  }

  // Basic email regex (RFC 5322 compliant simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Check for suspicious patterns
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return { valid: false, error: 'Invalid email format' };
  }

  // Check domain part
  const [localPart, domain] = trimmed.split('@');
  if