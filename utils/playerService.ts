```typescript
// utils/playerService.ts

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

export interface GameSessionInput {
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

export interface LearningProgress {
  id: string;
  playerId: string;
  conceptId: string;
  conceptName: string;
  masteryLevel: number;
  lastPracticedAt: Date;
  totalAttempts: number;
  correctAttempts: number;
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

export interface PlayerRepository {
  findById(id: string): Promise<Player | null>;
  findByEmail(email: string): Promise<Player | null>;
  findByUsername(username: string): Promise<Player | null>;
  create(player: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<Player>;
  update(id: string, data: Partial<Player>): Promise<Player>;
  delete(id: string): Promise<void>;
  findAll(limit?: number, offset?: number): Promise<Player[]>;
  count(): Promise<number>;
}

export interface GameSessionRepository {
  create(session: Omit<GameSession, 'id' | 'createdAt'>): Promise<GameSession>;
  findByPlayerId(playerId: string, limit?: number, offset?: number): Promise<GameSession[]>;
  findById(id: string): Promise<GameSession | null>;
  countByPlayerId(playerId: string): Promise<number>;
}

export interface LearningProgressRepository {
  findByPlayerId(playerId: string): Promise<LearningProgress[]>;
  upsert(progress: Omit<LearningProgress, 'id'>): Promise<LearningProgress>;
  findByPlayerIdAndConcept(playerId: string, conceptId: string): Promise<LearningProgress | null>;
}

class InMemoryPlayerRepository implements PlayerRepository {
  private players = new Map<string, Player>();
  private idCounter = 0;

  async findById(id: string): Promise<Player | null> {
    return this.players.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<Player | null> {
    for (const player of this.players.values()) {
      if (player.email === email) return player;
    }
    return null;
  }

  async findByUsername(username: string): Promise<Player | null> {
    for (const player of this.players.values()) {
      if (player.username === username) return player;
    }
    return null;
  }

  async create(playerData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<Player> {
    const id = `player_${++this.idCounter}_${Date.now()}`;
    const now = new Date();
    const player: Player = {
      ...playerData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.players.set(id, player);
    return player;
  }

  async update(id: string, data: Partial<Player>): Promise<Player> {
    const player = this.players.get(id);
    if (!player) throw AppError.notFound('Player');
    const updated = { ...player, ...data, updatedAt: new Date() };
    this.players.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.players.delete(id);
  }

  async findAll(limit = 50, offset = 0): Promise<Player[]> {
    const all = Array.from(this.play