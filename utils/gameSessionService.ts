import { Player, GameSession, GameType, GameSessionStatus } from '@/domain';
import { telemetryService } from './telemetryService';

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

export interface CreateSessionInput {
  playerId: string;
  gameType: GameType;
  initialScore?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  status?: GameSessionStatus;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsOptions {
  playerId?: string;
  status?: GameSessionStatus;
  gameType?: GameType;
  limit?: number;
  offset?: number;
}

const VALID_STATE_TRANSITIONS: Record<GameSessionStatus, GameSessionStatus[]> = {
  created: ['active', 'abandoned'],
  active: ['paused', 'completed', 'abandoned'],
  paused: ['active', 'abandoned'],
  completed: [],
  abandoned: [],
};

export class GameSessionService {
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

  private validateStateTransition(sessionId: string, currentState: GameSessionStatus, targetState: GameSessionStatus): void {
    const allowedTransitions = VALID_STATE_TRANSITIONS[currentState];
    if (!allowedTransitions.includes(targetState)) {
      throw new InvalidSessionStateError(sessionId, currentState, targetState);
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

  private emitTelemetry(event: string, session: GameSession, metadata?: Record<string, unknown>): void {
    telemetryService.track(event, {
      sessionId: session.id,
      playerId: session.playerId,
      gameType: session.gameType,
      status: session.status,
      score: session.score,
      ...metadata,
    });
  }

  createSession(input: CreateSessionInput): GameSession {
    this.validatePlayerId(input.playerId);
    this.validateGameType(input.gameType);

    if (input.initialScore !== undefined) {
      this.validateScore(input.initialScore);
    }

    const now = new Date();
    const session: GameSession = {
      id: this.generateId(),
      playerId: input.playerId,
      gameType: input.gameType,
      status: 'created',
      score: input.initialScore ?? 0,
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
    };

    this.sessions.set(session.id, session);
    this.addToPlayerIndex(session.playerId, session.id);

    this.emitTelemetry('session_created', session);

    return session;
  }

  getSession(id: string): GameSession {
    return this.getSessionOrThrow(id);
  }

  updateSession(id: string, input: UpdateSessionInput): GameSession {
    const session = this.getSessionOrThrow(id);

    if (input.status !== undefined) {
      this.validateStateTransition(id, session.status, input.status);
      session.status = input.status;
      
      if (input.status === 'completed' || input.status === 'abandoned') {
        session.completedAt = new Date();
      }
    }

    if (input.score !== undefined) {
      this.validateScore(input.score);
      session.score = input.score;
    }

    if (input.metadata !== undefined) {
      session.metadata = { ...session.metadata, ...input.metadata };
    }

    session.updatedAt = new Date();
    this.sessions.set(id, session);

    this.emitTelemetry('session_updated', session, { changes: input });

    return session;
  }

  completeSession(id: string, finalScore?: number): GameSession {
    const session = this.getSessionOrThrow(id);
    
    this.validateStateTransition(id, session.status, 'completed');
    
    if (finalScore !== undefined) {
      this.validateScore(finalScore);
      session.score = finalScore;
    }

    session.status = 'completed';
    session.completedAt = new Date();
    session.updatedAt = new Date();

    this.sessions.set(id, session);

    this.emitTelemetry('session_completed', session, { finalScore: session.score });

    return session;
  }

  abandonSession(id: string): GameSession {
    const session = this.getSessionOrThrow(id);
    
    this.validateStateTransition(id, session.status, 'abandoned');

    session.status = 'abandoned';
    session.completedAt = new Date();
    session.updatedAt = new Date();

    this.sessions.set(id, session);

    this.emitTelemetry('session_abandoned', session);

    return session;
  }

  listSessions(options: ListSessionsOptions = {}): GameSession[] {
    const { playerId, status, gameType, limit = 50, offset = 0 } = options;

    let sessions: GameSession[];

    if (playerId) {
      const sessionIds = this.playerSessionsIndex.get(playerId);
      if (!sessionIds) {
        return [];
      }
      sessions = Array.from(sessionIds)
        .map(id => this.sessions.get(id))
        .filter((s): s is GameSession => s !== undefined);
    } else {
      sessions = Array.from(this.sessions.values());
    }

    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }

    if (gameType) {
      sessions = sessions.filter(s => s.gameType === gameType);
    }

    sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return sessions.slice(offset, offset + limit);
  }

  listPlayerSessions(playerId: string, options: Omit<ListSessionsOptions, 'playerId'> = {}): GameSession[] {
    this.validatePlayerId(playerId);
    return this.listSessions({ ...options, playerId });
  }

  deleteSession(id: string): void {
    const session = this.getSessionOrThrow(id);
    
    this.sessions.delete(id);
    this.removeFromPlayerIndex(session.playerId, id);

    this.emitTelemetry('session_deleted', session);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getPlayerSessionCount(playerId: string): number {
    const sessionIds = this.playerSessionsIndex.get(playerId);
    return sessionIds?.size ?? 0;
  }

  clear(): void {
    this.sessions.clear();
    this.playerSessionsIndex.clear();
  }
}

export const gameSessionService = new GameSessionService();