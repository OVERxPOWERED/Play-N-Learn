import { GameSessionService } from './gameSessionService';
import { telemetryService } from './telemetryService';

// Domain types (inline since zod is not in dependencies)
export interface GameState {
  sessionId: string;
  currentLevel: number;
  progress: number; // 0-100
  version: number; // Optimistic locking
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InitializeStateInput {
  sessionId: string;
  initialLevel: number;
}

export interface UpdateProgressInput {
  sessionId: string;
  progressDelta: number;
  expectedVersion: number;
}

export interface SetLevelInput {
  sessionId: string;
  level: number;
  expectedVersion: number;
}

export interface UpdateMetadataInput {
  sessionId: string;
  metadata: Record<string, unknown>;
  expectedVersion: number;
}

export interface CompleteGameStateInput {
  sessionId: string;
  finalScore: number;
  expectedVersion: number;
}

export interface GameStateServiceError extends Error {
  code: 'SESSION_NOT_FOUND' | 'VERSION_CONFLICT' | 'INVALID_PROGRESS' | 'INVALID_LEVEL' | 'STATE_NOT_FOUND';
}

class GameStateService {
  private states: Map<string, GameState> = new Map();
  private sessionService: GameSessionService;

  constructor(sessionService: GameSessionService) {
    this.sessionService = sessionService;
  }

  async initializeState(input: InitializeStateInput): Promise<GameState> {
    const { sessionId, initialLevel } = input;

    // Validate session exists
    const session = await this.sessionService.getSession(sessionId);
    if (!session) {
      const error = new Error(`Session ${sessionId} not found`) as GameStateServiceError;
      error.code = 'SESSION_NOT_FOUND';
      throw error;
    }

    // Validate initial level
    if (initialLevel < 1) {
      const error = new Error('Initial level must be >= 1') as GameStateServiceError;
      error.code = 'INVALID_LEVEL';
      throw error;
    }

    const now = new Date();
    const state: GameState = {
      sessionId,
      currentLevel: initialLevel,
      progress: 0,
      version: 1,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    this.states.set(sessionId, state);
    
    // Emit telemetry event
    telemetryService.emit('game_state_initialized', {
      sessionId,
      initialLevel,
      timestamp: now.toISOString(),
    });

    return state;
  }

  async updateProgress(input: UpdateProgressInput): Promise<GameState> {
    const { sessionId, progressDelta, expectedVersion } = input;

    const state = this.states.get(sessionId);
    if (!state) {
      const error = new Error(`Game state for session ${sessionId} not found`) as GameStateServiceError;
      error.code = 'STATE_NOT_FOUND';
      throw error;
    }

    // Optimistic locking check
    if (state.version !== expectedVersion) {
      const error = new Error(`Version conflict: expected ${expectedVersion}, current ${state.version}`) as GameStateServiceError;
      error.code = 'VERSION_CONFLICT';
      throw error;
    }

    const newProgress = state.progress + progressDelta;
    if (newProgress < 0 || newProgress > 100) {
      const error = new Error('Progress must be between 0 and 100') as GameStateServiceError;
      error.code = 'INVALID_PROGRESS';
      throw error;
    }

    const updatedState: GameState = {
      ...state,
      progress: newProgress,
      version: state.version + 1,
      updatedAt: new Date(),
    };

    this.states.set(sessionId, updatedState);

    // Emit telemetry event
    telemetryService.emit('game_progress_updated', {
      sessionId,
      previousProgress: state.progress,
      newProgress: updatedState.progress,
      progressDelta,
      version: updatedState.version,
      timestamp: updatedState.updatedAt.toISOString(),
    });

    return updatedState;
  }

  async setLevel(input: SetLevelInput): Promise<GameState> {
    const { sessionId, level, expectedVersion } = input;

    const state = this.states.get(sessionId);
    if (!state) {
      const error = new Error(`Game state for session ${sessionId} not found`) as GameStateServiceError;
      error.code = 'STATE_NOT_FOUND';
      throw error;
    }

    if (state.version !== expectedVersion) {
      const error = new Error(`Version conflict: expected ${expectedVersion}, current ${state.version}`) as GameStateServiceError;
      error.code = 'VERSION_CONFLICT';
      throw error;
    }

    if (level < 1) {
      const error = new Error('Level must be >= 1') as GameStateServiceError;
      error.code = 'INVALID_LEVEL';
      throw error;
    }

    const previousLevel = state.currentLevel;
    const updatedState: GameState = {
      ...state,
      currentLevel: level,
      progress: 0, // Reset progress on level change
      version: state.version + 1,
      updatedAt: new Date(),
    };

    this.states.set(sessionId, updatedState);

    // Emit telemetry event
    telemetryService.emit('game_level_changed', {
      sessionId,
      previousLevel,
      newLevel: level,
      version: updatedState.version,
      timestamp: updatedState.updatedAt.toISOString(),
    });

    return updatedState;
  }

  async updateMetadata(input: UpdateMetadataInput): Promise<GameState> {
    const { sessionId, metadata, expectedVersion } = input;

    const state = this.states.get(sessionId);
    if (!state) {
      const error = new Error(`Game state for session ${sessionId} not found`) as GameStateServiceError;
      error.code = 'STATE_NOT_FOUND';
      throw error;
    }

    if (state.version !== expectedVersion) {
      const error = new Error(`Version conflict: expected ${expectedVersion}, current ${state.version}`) as GameStateServiceError;
      error.code = 'VERSION_CONFLICT';
      throw error;
    }

    const updatedState: GameState = {
      ...state,
      metadata: { ...state.metadata, ...metadata },
      version: state.version + 1,
      updatedAt: new Date(),
    };

    this.states.set(sessionId, updatedState);

    // Emit telemetry event
    telemetryService.emit('game_metadata_updated', {
      sessionId,
      metadataKeys: Object.keys(metadata),
      version: updatedState.version,
      timestamp: updatedState.updatedAt.toISOString(),
    });

    return updatedState;
  }

  async completeGameState(input: CompleteGameStateInput): Promise<GameState> {
    const { sessionId, finalScore, expectedVersion } = input;

    const state = this.states.get(sessionId);
    if (!state) {
      const error = new Error(`Game state for session ${sessionId} not found`) as GameStateServiceError;
      error.code = 'STATE_NOT_FOUND';
      throw error;
    }

    if (state.version !== expectedVersion) {
      const error = new Error(`Version conflict: expected ${expectedVersion}, current ${state.version}`) as GameStateServiceError;
      error.code = 'VERSION_CONFLICT';
      throw error;
    }

    if (finalScore < 0) {
      const error = new Error('Final score must be >= 0') as GameStateServiceError;
      error.code = 'INVALID_PROGRESS';
      throw error;
    }

    const completedState: GameState = {
      ...state,
      progress: 100,
      metadata: {
        ...state.metadata,
        finalScore,
        completedAt: new Date().toISOString(),
      },
      version: state.version + 1,
      updatedAt: new Date(),
    };

    this.states.set(sessionId, completedState);

    // Emit telemetry event
    telemetryService.emit('game_completed', {
      sessionId,
      finalScore,
      finalLevel: state.currentLevel,
      totalTimeMs: completedState.updatedAt.getTime() - state.createdAt.getTime(),
      version: completedState.version,
      timestamp: completedState.updatedAt.toISOString(),
    });

    return completedState;
  }

  async getGameState(sessionId: string): Promise<GameState | null> {
    return this.states.get(sessionId) ?? null;
  }

  async deleteGameState(sessionId: string): Promise<boolean> {
    const existed = this.states.has(sessionId);
    if (existed) {
      this.states.delete(sessionId);
      telemetryService.emit('game_state_deleted', {
        sessionId,
        timestamp: new Date().toISOString(),
      });
    }
    return existed;
  }
}

export const gameStateService = new GameStateService(
  // This will be injected properly in the DI container
  // For now, we'll use a lazy getter pattern
  {} as GameSessionService
);

// Factory function for proper DI
export function createGameStateService(sessionService: GameSessionService): GameStateService {
  return new GameStateService(sessionService);
}