```typescript
import { Player, GameSession, GameType, GameSessionStatus } from '@/domain';

export class GameSessionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'GameSessionError';
  }
}

export class SessionNotFoundError extends GameSessionError {
  constructor(sessionId: string) {
    super(`Game session with id ${sessionId} not found`, 'SESSION_NOT_FOUND', 404);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionValidationError extends GameSessionError {
  constructor(message: string) {
    super(message, 'SESSION_VALIDATION_ERROR', 400);
    this.name = 'SessionValidationError';
  }
}

export class InvalidSessionStateError extends GameSessionError {
  constructor(sessionId: string, currentState: GameSessionStatus, expectedState: GameSessionStatus) {
    super(
      `Cannot perform action on session ${sessionId}: current state is ${currentState}, expected ${expectedState}`,
      'INVALID_SESSION_STATE',
      409
    );
    this.name = 'InvalidSessionStateError';
  }
}

interface CreateSessionInput {
  playerId: string;
  gameType: GameType;
}

interface UpdateSessionInput {
  status?: GameSessionStatus;
  score?: number;
  metadata?: Record<string, unknown>;
}

class GameSessionService {
  private sessions: Map<string, GameSession> = new Map();
  private playerSessionsIndex: Map<string, Set<string>> = new Map();

  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private validatePlayerId(playerId: string): void {
    if (!playerId || typeof playerId !== 'string') {
      throw new SessionValidationError('Player ID is required and must be a string');
    }
    if (playerId.trim().length === 0) {
      throw new SessionValidationError('Player ID cannot be empty');
    }
  }

  private validateGameType(gameType: GameType): void {
    const validGameTypes: GameType[] = ['puzzle', 'arcade', 'strategy', 'multiplayer'];
    if (!validGameTypes.includes(gameType)) {
      throw new SessionValidationError(`Invalid game type: ${gameType}`);
    }
  }

  private validateScore(score: number): void {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      throw new SessionValidationError('Score must be a finite number');
    }
    if (score < 0) {
      throw new SessionValidationError('Score cannot be negative');
    }
  }

  private getSessionOrThrow(id: string): GameSession {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionNotFoundError(id);
    }
    return session;
  }

  private addToPlayerIndex(playerId: string, sessionId: string): void {
    if (!this.playerSessionsIndex.has(playerId)) {
      this.playerSessionsIndex.set(playerId, new Set());
    }
    this.playerSessionsIndex.get(playerId)!.add(sessionId);
  }

  private removeFromPlayerIndex(playerId: string, sessionId: string): void {
    const playerSessions = this.playerSessionsIndex.get(playerId);
    if (playerSessions) {
      playerSessions.delete(sessionId);
      if (playerSessions.size === 0) {
        this.playerSessionsIndex.delete(playerId);
      }
    }
  }

  createSession(input: CreateSessionInput): GameSession {
    this.validatePlayerId(input.playerId);
    this.validateGameType(input.gameType);

    const now = new Date();
    const session: GameSession = {
      id: this.generateId(),
      playerId: input.playerId,
      gameType: input.gameType,
      status: 'active',
      score: 0,
      startedAt: now,
      updatedAt: now,
      metadata: {},
    };

    this.sessions.set(session.id, session);
    this.addToPlayerIndex(input.playerId, session.id);

    return { ...session };
  }

  getSession(id: string): GameSession {
    const session = this.getSessionOrThrow(id);
    return { ...session };
  }

  updateSession(id: string, updates: UpdateSessionInput): GameSession {
    const session = this.getSessionOrThrow(id);

    if (updates.status !== undefined) {
      const validStatuses: GameSessionStatus[] = ['active', 'paused', 'completed', 'abandoned'];
      if (!validStatuses.includes(updates.status)) {
        throw new SessionValidationError(`Invalid status: ${updates.status}`);
      }
      session.status = updates.status;
    }

    if (updates.score !== undefined) {
      this.validateScore(updates.score);
      session.score = updates.score;
    }

    if (updates.metadata !== undefined) {
      if (typeof updates.metadata !== 'object' || updates.metadata === null) {
        throw new SessionValidationError('Metadata must be an object');
      }
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    session.updatedAt = new Date();
    this.sessions.set(id, session);

    return { ...session };
  }

  completeSession(id: string, score: number): GameSession {
    this.validateScore(score);

    const session = this.getSessionOrThrow(id);

    if (session.status === 'completed') {
      throw new InvalidSessionStateError(id, session.status, 'active');
    }
    if (session.status === 'abandoned') {
      throw new InvalidSessionStateError(id, session.status, 'active');
    }

    session.status = 'completed';
    session.score = score;
    session.completedAt = new Date();
    session.updatedAt = new Date();

    this.sessions.set(id, session);

    return { ...session };
  }

  abandonSession(id: string): GameSession {
    const session = this.getSessionOrThrow(id);

    if (session.status === 'completed') {
      throw new InvalidSessionStateError(id, session.status, 'active');
    }
    if (session.status === 'abandoned') {
      throw new InvalidSessionStateError(id, session.status, 'active');
    }

    session.status = 'abandoned';
    session.completedAt = new Date();
    session.updatedAt = new Date();

    this.sessions.set(id, session);

    return { ...session };
  }

  listPlayerSessions(playerId: string): GameSession[] {
    this.validatePlayerId(playerId);

    const sessionIds = this.playerSessionsIndex.get(playerId);
    if (!sessionIds || sessionIds.size === 0) {
      return [];
    }

    const sessions: GameSession[] = [];
    for (const sessionId of sessionIds) {
      const session = this.sessions.get(sessionId);
      if (session) {
        sessions.push({ ...session });
      }
    }

    return sessions.sort((a, b