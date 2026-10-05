```typescript
// lib/services/playerService.ts

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode: number = 500, code: string = 'INTERNAL_ERROR', details?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 400, 'VALIDATION_ERROR', details);
  }

  static notFound(resource: string): AppError {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND', { resource });
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, 409, 'CONFLICT', details);
  }
}

export interface PlayerInput {
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Player {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  currentStreak: number;
  bestStreak: number;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
}

export interface GameSessionData {
  playerId: string;
  gameId: string;
  result: 'win' | 'loss' | 'draw';
  xpEarned: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

export interface GameSession {
  id: string;
  playerId: string;
  gameId: string;
  result: 'win' | 'loss' | 'draw';
  xpEarned: number;
  durationMs: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface PlayerStats {
  player: Player;
  recentSessions: GameSession[];
  winRate: number;
  averageSessionDuration: number;
  xpToNextLevel: number;
  progressToNextLevel: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  totalGamesPlayed: number;
  winRate: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalPlayers: number;
  playerRank?: number;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

const XP_PER_LEVEL = 1000;
const XP_LEVEL_MULTIPLIER = 1.5;

function calculateLevelFromXp(xp: number): number {
  if (xp < 0) return 1;
  let level = 1;
  let xpRequired = XP_PER_LEVEL;
  let remainingXp = xp;

  while (remainingXp >= xpRequired) {
    remainingXp -= xpRequired;
    level++;
    xpRequired = Math.floor(xpRequired * XP_LEVEL_MULTIPLIER);
  }

  return level;
}

function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  let totalXp = 0;
  let xpRequired = XP_PER_LEVEL;

  for (let i = 1; i < level; i++) {
    totalXp += xpRequired;
    xpRequired = Math.floor(xpRequired * XP_LEVEL_MULTIPLIER);
  }

  return totalXp;
}

function calculateXpToNextLevel(currentXp: number): number {
  const currentLevel = calculateLevelFromXp(currentXp);
  const xpForCurrentLevel = calculateXpForLevel(currentLevel);
  const xpForNextLevel = calculateXpForLevel(currentLevel + 1);
  return xpForNextLevel - currentXp;
}

function calculateProgressToNextLevel(currentXp: number): number {
  const currentLevel = calculateLevelFromXp(currentXp);
  const xpForCurrentLevel = calculateXpForLevel(currentLevel);
  const xpForNextLevel = calculateXpForLevel(currentLevel + 1);
  const progressXp = currentXp - xpForCurrentLevel;
  const totalXpForLevel = xpForNextLevel - xpForCurrentLevel;
  return Math.min(100, Math.max(0, (progressXp / totalXpForLevel) * 100));
}

function sanitizeString(input: string, maxLength: number = 100): string {
  return input.trim().slice(0, maxLength);
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const mockPlayerDatabase = new Map<string, Player>();
const mockSessionDatabase = new Map<string, GameSession[]>();

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
      return { data: null, error: errorData.message || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Network error' };
  }