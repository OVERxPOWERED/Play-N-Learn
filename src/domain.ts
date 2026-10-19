```typescript
export enum PlayerRole {
  PLAYER = 'player',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  GUEST = 'guest',
}

export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  EXPIRED = 'expired',
}

export enum GamePhase {
  LOBBY = 'lobby',
  LOADING = 'loading',
  PLAYING = 'playing',
  PAUSED = 'paused',
  RESULTS = 'results',
  FINISHED = 'finished',
}

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
  role: PlayerRole;
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
  status: SessionStatus;
  startedAt: Date;
  completedAt: Date | null;
  metadata?: Record<string, unknown>;
}

export interface GameState {
  sessionId: string;
  phase: GamePhase;
  currentScore: number;
  maxPossibleScore: number;
  timeRemaining: number;
  level: number;
  lives: number;
  powerUps: string[];
  customData: Record<string, unknown>;
  updatedAt: Date;
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

export interface GameStateUpdateInput {
  sessionId: string;
  phase?: GamePhase;
  currentScore?: number;
  timeRemaining?: number;
  level?: number;
  lives?: number;
  powerUps?: string[];
  customData?: Record<string, unknown>;
}

export interface PlayerCreateInput {
  username: string;
  email: string;
  authProvider: 'email' | 'google' | 'github' | 'discord';
  avatarUrl?: string | null;
}

export interface PlayerUpdateInput {
  username?: string;
  email?: string;
  avatarUrl?: string | null;
  xp?: number;
  level?: number;
  role?: PlayerRole;
}

const MODULE_DIFFICULTIES: ModuleDifficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];
const MODULE_CATEGORIES: ModuleCategory[] = ['math', 'science', 'language', 'logic', 'memory', 'creativity'];
const COMPLETION_STATUSES: CompletionStatus[] = ['not_started', 'in_progress', 'completed', 'mastered'];
const PLAYER_ROLES: PlayerRole[] = [PlayerRole.PLAYER, PlayerRole.ADMIN, PlayerRole.MODERATOR, PlayerRole.GUEST];
const SESSION_STATUSES: SessionStatus[] = [SessionStatus.PENDING, SessionStatus.ACTIVE, SessionStatus.PAUSED, SessionStatus.COMPLETED, SessionStatus.ABANDONED, SessionStatus.EXPIRED];
const GAME_PHASES: GamePhase[] = [GamePhase.LOBBY, GamePhase.LOADING, GamePhase.PLAYING, GamePhase.PAUSED, GamePhase.RESULTS, GamePhase.FINISHED];
const AUTH_PROVIDERS = ['email', 'google', 'github', 'discord'] as const;
const LEADERBOARD_PERIODS = ['daily', 'weekly', 'monthly', 'all_time'] as const;

export function isValidModuleDifficulty(value: string): value is ModuleDifficulty {
  return MODULE_DIFFICULTIES.includes(value as ModuleDifficulty);
}

export function isValidModuleCategory(value: string): value is ModuleCategory {
  return MODULE_CATEGORIES.includes(value as ModuleCategory);
}

export function isValidCompletionStatus(value: string): value is CompletionStatus {
  return COMPLETION_STATUSES.includes(value as CompletionStatus);
}

export function isValidPlayerRole(value: string): value is PlayerRole {
  return PLAYER_ROLES.includes(value as PlayerRole);
}

export function isValidSessionStatus(value: string): value is SessionStatus {
  return SESSION_STATUSES.includes(value as SessionStatus);
}

export function isValidGamePhase(value: string): value is GamePhase {
  return GAME_PHASES.includes(value as GamePhase);
}

export function isValidAuthProvider(value: string): value is 'email' | 'google' | 'github' | 'discord' {
  return AUTH_PROVIDERS.includes(value as 'email