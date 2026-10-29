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

  private transitionState(sessionId: string, targetState: GameSessionStatus): GameSession {
    const session = this.getSessionOrThrow(sessionId);
    this.validateStateTransition(sessionId, session.status, targetState);
    
    const updatedSession: GameSession = {
      ...session,
      status: targetState,
      updatedAt: new Date(),
    };
    
    this.sessions.set(sessionId, updatedSession);
    
    telemetryService.track('session_state_changed', {
      sessionId,
      previousState: session.status,
      newState: targetState,
      playerId: session.playerId,
      gameType: session.gameType,
    });
    
    return updatedSession;
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
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(session.id, session);
    this.addToPlayerIndex(input.playerId, session.id);

    telemetryService.track('session_created', {
      sessionId: session.id,
      playerId: session.playerId,
      gameType: session.gameType,
      initialScore: session.score,
    });

    return session;
  }

  getSession(sessionId: string): GameSession {
    return this.getSessionOrThrow(sessionId);
  }

  updateSession(sessionId: string, updates: UpdateSessionInput): GameSession {
    const session = this.getSessionOrThrow(sessionId);
    
    if (updates.status !== undefined) {
      this.validateStateTransition(sessionId, session.status, updates.status);
    }
    
    if (updates.score !== undefined) {
      this.validateScore(updates.score);
    }

    const updatedSession: GameSession = {
      ...session,
      ...updates,
      metadata: {
        ...session.metadata,
        ...updates.metadata,
      },
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);

    telemetryService.track('session_updated', {
      sessionId,
      playerId: session.playerId,
      changes: Object.keys(updates),
    });

    return updatedSession;
  }

  deleteSession(sessionId: string): void {
    const session = this.getSessionOrThrow(sessionId);
    
    this.sessions.delete(sessionId);
    this.removeFromPlayerIndex(session.playerId, sessionId);

    telemetryService.track('session_deleted', {
      sessionId,
      playerId: session.playerId,
      gameType: session.gameType,
      status: session.status,
    });
  }

  listSessions(options: ListSessionsOptions = {}): GameSession[] {
    let sessions = Array.from(this.sessions.values());

    if (options.playerId) {
      sessions = sessions.filter(s => s.playerId === options.playerId);
    }
    if (options.status) {
      sessions = sessions.filter(s => s.status === options.status);
    }
    if (options.gameType) {
      sessions = sessions.filter(s => s.gameType === options.gameType);
    }

    sessions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;

    return sessions.slice(offset, offset + limit);
  }

  startSession(sessionId: string): GameSession {
    return this.transitionState(sessionId, 'active');
  }

  pauseSession(sessionId: string): GameSession {
    return this.transitionState(sessionId, 'paused');
  }

  resumeSession(sessionId: string): GameSession {
    return this.transitionState(sessionId, 'active');
  }

  completeSession(sessionId: string, score: number): GameSession {
    this.validateScore(score);
    
    const session = this.getSessionOrThrow(sessionId);
    this.validateStateTransition(sessionId, session.status, 'completed');

    const updatedSession: GameSession = {
      ...session,
      status: 'completed',
      score,
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);

    telemetryService.track('session_completed', {
      sessionId,
      playerId: session.playerId,
      gameType: session.gameType,
      finalScore: score,
      durationMs: updatedSession.completedAt.getTime() - session.createdAt.getTime(),
    });

    return updatedSession;
  }

  abandonSession(sessionId: string): GameSession {
    return this.transitionState(sessionId, 'abandoned');
  }
}

export const gameSessionService = new GameSessionService();