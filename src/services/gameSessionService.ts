```typescript
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

  private logOperation(operation: string, sessionId: string, correlationId: string, metadata?: Record<string, unknown>): void {
    telemetryService.log({
      level: 'info',
      message: `GameSessionService.${operation}`,
      correlationId,
      metadata: { sessionId, ...metadata },
    });
  }

  createSession(input: CreateSessionInput): GameSession {
    const correlationId = telemetryService.generateCorrelationId();
    
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
      startedAt: now,
      updatedAt: now,
      metadata: {},
    };

    this.sessions.set(session.id, session);
    this.addToPlayerIndex(input.playerId, session.id);

    this.logOperation('createSession', session.id, correlationId, { 
      playerId: input.playerId, 
      gameType: input.gameType,
      initialScore: input.initialScore 
    });

    return { ...session };
  }

  getSession(id: string): GameSession {
    const correlationId = telemetryService.generateCorrelationId();
    const session = this.getSessionOrThrow(id);
    
    this.logOperation('getSession', id, correlationId);
    
    return { ...session };
  }

  updateSession(id: string, updates: UpdateSessionInput): GameSession {
    const correlationId = telemetryService.generateCorrelationId();
    const session = this.getSessionOrThrow(id);
    
    if (updates.status !== undefined) {
      this.validateStateTransition(id, session.status, updates.status);
    }
    
    if (updates.score !== undefined) {
      this.validateScore(updates.score);
    }

    const updatedSession: GameSession = {
      ...session,
      status: updates.status ?? session.status,
      score: updates.score ?? session.score,
      metadata: { ...session.metadata, ...updates.metadata },
      updatedAt: new Date(),
    };

    this.sessions.set(id, updatedSession);

    this.logOperation('updateSession', id, correlationId, { 
      updates: Object.keys(updates),
      previousStatus: session.status,
      newStatus: updatedSession.status 
    });

    return { ...updatedSession };
  }

  deleteSession(id: string): void {
    const correlationId = telemetryService.generateCorrelationId();
    const session = this.getSessionOrThrow(id);
    
    this.sessions.delete(id);
    this.removeFromPlayerIndex(session.playerId, id);

    this.logOperation('deleteSession', id, correlationId, { playerId: session.playerId });
  }

  listSessions(options: ListSessionsOptions = {}): GameSession[] {
    const correlationId = telemetryService.generateCorrelationId();
    let sessions = Array.from