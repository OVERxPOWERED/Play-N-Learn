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
  avatarUrl: string | null;
}