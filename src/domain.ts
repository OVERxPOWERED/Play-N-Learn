```typescript
import { z } from 'zod';

export interface PlayerStats {
  totalGamesPlayed: number;
  totalScore: number;
  averageScore: number;
  totalPlayTime: number;
  modulesCompleted: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedAt: Date | null;
}

export interface Player {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  authProvider: 'email' | 'google' | 'github' | 'discord';
  createdAt: Date;
  updatedAt: Date;
  stats: PlayerStats;
}

export interface GameSession {
  id: string;
  playerId: string;
  gameType: string;
  score: number;
  duration: number;
  completedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface LearningProgress {
  id: string;
  playerId: string;
  subject: string;
  topic: string;
  masteryLevel: number;
  lastPracticed: Date;
}

export type ModuleDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type ModuleCategory = 'math' | 'science' | 'language' | 'logic' | 'memory' | 'creativity';

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  difficulty: ModuleDifficulty;
  category: ModuleCategory;
  prerequisites: string[];
  estimatedDuration: number;
  maxScore: number;
  contentVersion: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type CompletionStatus = 'not_started' | 'in_progress' | 'completed' | 'mastered';

export interface ProgressTracking {
  playerId: string;
  moduleId: string;
  completionStatus: CompletionStatus;
  bestScore: number;
  attempts: number;
  totalPlayTime: number;
  lastAttemptAt: Date | null;
  completedAt: Date | null;
  masteredAt: Date | null;
  attemptHistory: AttemptRecord[];
}

export interface AttemptRecord {
  sessionId: string;
  score: number;
  duration: number;
  completedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PlayerWithProgress extends Player {
  progress: ProgressTracking[];
}

export interface ModuleWithProgress extends LearningModule {
  progress: ProgressTracking | null;
  isUnlocked: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  score: number;
  rank: number;
  moduleId?: string;
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
}

export interface GameSessionCreateInput {
  playerId: string;
  moduleId: string;
  score: number;
  maxPossibleScore: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface ProgressUpdateInput {
  playerId: string;
  moduleId: string;
  sessionId: string;
  score: number;
  duration: number;
  completed: boolean;
}

export const MODULE_DIFFICULTIES: ModuleDifficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];
export const MODULE_CATEGORIES: ModuleCategory[] = ['math', 'science', 'language', 'logic', 'memory', 'creativity'];
export const COMPLETION_STATUSES: CompletionStatus[] = ['not_started', 'in_progress', 'completed', 'mastered'];

export function isValidModuleDifficulty(value: string): value is ModuleDifficulty {
  return MODULE_DIFFICULTIES.includes(value as ModuleDifficulty);
}

export function isValidModuleCategory(value: string): value is ModuleCategory {
  return MODULE_CATEGORIES.includes(value as ModuleCategory);
}

export function isValidCompletionStatus(value: string): value is CompletionStatus {
  return COMPLETION_STATUSES.includes(value as CompletionStatus);
}

const dateSchema = z.union([
  z.date(),
  z.string().datetime().transform((val) => new Date(val)),
  z.number().transform((val) => new Date(val)),
]);

const playerStatsSchema = z.object({
  totalGamesPlayed: z.number().int().nonnegative(),
  totalScore: z.number().nonnegative(),
  averageScore: z.number().nonnegative(),
  totalPlayTime: z.number().nonnegative(),
  modulesCompleted: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  lastPlayedAt: dateSchema.nullable(),
});

export const playerSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  xp: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  authProvider: z.enum(['email', 'google', 'github', 'discord']),
  createdAt: dateSchema,
  updatedAt: dateSchema,
  stats: playerStatsSchema,
});

export const gameSessionSchema = z.object({
  id: z.string().uuid(),
  playerId: z.string().uuid(),
  gameType: z.string().min(1).max(64),
  score: z.number().int().nonnegative(),
  duration: z.number().int().positive(),
  completedAt: dateSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const learningProgressSchema = z.object({
  id: z.string().uuid(),
  playerId: z.string().uuid(),
  subject: z.string().min(1).max(64),
  topic: z.string().min(1).max(128),
  masteryLevel: z.number().min(0).max(1),
  lastPracticed: dateSchema,
});

export const learningModuleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(128),
  description: z.string().min(1).max(1024),
  difficulty: z.enum(MODULE_DIFFICULTIES),
  category: z.enum(MODULE_CATEGORIES),
  prerequisites: z.array(z.string().uuid()),
  estimatedDuration: z.number().int().positive(),
  maxScore: z.number().int().positive(),
  contentVersion: z.string().min(1).max(32),
  isActive: z.boolean(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export const attemptRecordSchema = z.object({
  sessionId: z.string().uuid(),
  score: z.number().int().nonnegative(),
  duration: z.number().int().positive(),
  completedAt: dateSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const progressTrackingSchema = z.object({
  playerId: z.string().uuid(),
  moduleId: z.string().uuid(),
  completionStatus: z.enum(COMPLETION_STATUSES),
  bestScore: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative(),
  totalPlayTime: z.number().nonnegative(),
  lastAttemptAt: dateSchema.nullable(),
  completedAt: dateSchema.nullable(),
  masteredAt: dateSchema.nullable(),
  attemptHistory: z.array(attemptRecordSchema),
});

export const gameSessionCreateInputSchema = z.object({
  playerId: z.string().uuid(),
  moduleId: z.string