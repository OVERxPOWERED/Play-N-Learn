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
  authProvider: 'email' | 'google' | 'github' | 'discord';
  createdAt: Date;
  updatedAt: Date;
  stats: PlayerStats;
}

export interface GameSession {
  id: string;
  playerId: string;
  moduleId: string;
  score: number;
  maxPossibleScore: number;
  duration: number;
  completedAt: Date;
  metadata?: Record<string, unknown>;
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