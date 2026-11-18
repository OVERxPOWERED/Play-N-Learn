import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { GameStateService } from '@/services/gameStateService';
import { GameStateError, GameStateErrorCode } from '@/lib/errors/gameStateErrors';
import { telemetryService } from '@/services/telemetryService';
import type { GameState, GameMetadata, GameStatus } from '@/types/game';

// Mock telemetry service
vi.mock('@/services/telemetryService', () => ({
  telemetryService: {
    trackEvent: vi.fn(),
    trackError: vi.fn(),
  },
}));

describe('GameStateService', () => {
  let service: GameStateService;
  const mockTelemetry = telemetryService as unknown as {
    trackEvent: Mock;
    trackError: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GameStateService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createGameState', () => {
    it('should create a new game state with valid sessionId', async () => {
      const sessionId = 'session-123';
      const initialLevel = 1;

      const gameState = await service.createGameState(sessionId, initialLevel);

      expect(gameState).toBeDefined();
      expect(gameState.sessionId).toBe(sessionId);
      expect(gameState.currentLevel).toBe(initialLevel);
      expect(gameState.progress).toBe(0);
      expect(gameState.isComplete).toBe(false);
      expect(gameState.finalScore).toBeNull();
      expect(gameState.metadata).toEqual({});
      expect(gameState.createdAt).toBeInstanceOf(Date);
      expect(gameState.updatedAt).toBeInstanceOf(Date);

      expect(mockTelemetry.trackEvent).toHaveBeenCalledWith(
        'game_state_created',
        expect.objectContaining({
          sessionId,
          initialLevel,
        })
      );
    });

    it('should create game state with default level 1 when not provided', async () => {
      const sessionId = 'session-456';

      const gameState = await service.createGameState(sessionId);

      expect(gameState.currentLevel).toBe(1);
    });

    it('should throw GameStateError for invalid sessionId (empty string)', async () => {
      await expect(service.createGameState('')).rejects.toThrow(GameStateError);
      await expect(service.createGameState('')).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_SESSION_ID,
        statusCode: 400,
      });
    });

    it('should throw GameStateError for invalid sessionId (whitespace only)', async () => {
      await expect(service.createGameState('   ')).rejects.toThrow(GameStateError);
      await expect(service.createGameState('   ')).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_SESSION_ID,
      });
    });

    it('should throw GameStateError for initial level below minimum (0)', async () => {
      await expect(service.createGameState('session-1', 0)).rejects.toThrow(GameStateError);
      await expect(service.createGameState('session-1', 0)).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_LEVEL,
        statusCode: 400,
      });
    });

    it('should throw GameStateError for initial level above maximum (100)', async () => {
      await expect(service.createGameState('session-1', 101)).rejects.toThrow(GameStateError);
      await expect(service.createGameState('session-1', 101)).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_LEVEL,
      });
    });

    it('should throw GameStateError when session already exists', async () => {
      const sessionId = 'session-duplicate';
      await service.createGameState(sessionId);

      await expect(service.createGameState(sessionId)).rejects.toThrow(GameStateError);
      await expect(service.createGameState(sessionId)).rejects.toMatchObject({
        code: GameStateErrorCode.SESSION_ALREADY_EXISTS,
        statusCode: 409,
      });
    });

    it('should track telemetry error on creation failure', async () => {
      await expect(service.createGameState('')).rejects.toThrow();

      expect(mockTelemetry.trackError).toHaveBeenCalledWith(
        expect.any(GameStateError),
        expect.objectContaining({
          sessionId: '',
        })
      );
    });
  });

  describe('getGameState', () => {
    it('should return existing game state', async () => {
      const sessionId = 'session-get';
      await service.createGameState(sessionId, 3);

      const gameState = await service.getGameState(sessionId);

      expect(gameState).toBeDefined();
      expect(gameState.sessionId).toBe(sessionId);
      expect(gameState.currentLevel).toBe(3);
    });

    it('should throw GameStateError for non-existent session', async () => {
      await expect(service.getGameState('non-existent')).rejects.toThrow(GameStateError);
      await expect(service.getGameState('non-existent')).rejects.toMatchObject({
        code: GameStateErrorCode.SESSION_NOT_FOUND,
        statusCode: 404,
      });
    });

    it('should throw GameStateError for empty sessionId', async () => {
      await expect(service.getGameState('')).rejects.toThrow(GameStateError);
      await expect(service.getGameState('')).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_SESSION_ID,
      });
    });
  });

  describe('updateGameState', () => {
    it('should update progress and metadata', async () => {
      const sessionId = 'session-update';
      await service.createGameState(sessionId);

      const updated = await service.updateGameState(sessionId, {
        progress: 50,
        metadata: { coinsCollected: 10, enemiesDefeated: 5 },
      });

      expect(updated.progress).toBe(50);
      expect(updated.metadata).toEqual({ coinsCollected: 10, enemiesDefeated: 5 });
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    it('should update current level', async () => {
      const sessionId = 'session-level';
      await service.createGameState(sessionId, 1);

      const updated = await service.updateGameState(sessionId, { currentLevel: 2 });

      expect(updated.currentLevel).toBe(2);
    });

    it('should throw for non-existent session', async () => {
      await expect(service.updateGameState('non-existent', { progress: 10 })).rejects.toThrow(GameStateError);
      await expect(service.updateGameState('non-existent', { progress: 10 })).rejects.toMatchObject({
        code: GameStateErrorCode.SESSION_NOT_FOUND,
      });
    });

    it('should throw for invalid progress (negative)', async () => {
      const sessionId = 'session-progress';
      await service.createGameState(sessionId);

      await expect(service.updateGameState(sessionId, { progress: -1 })).rejects.toThrow(GameStateError);
      await expect(service.updateGameState(sessionId, { progress: -1 })).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_PROGRESS,
      });
    });

    it('should throw for invalid progress (above 100)', async () => {
      const sessionId = 'session-progress';
      await service.createGameState(sessionId);

      await expect(service.updateGameState(sessionId, { progress: 101 })).rejects.toThrow(GameStateError);
      await expect(service.updateGameState(sessionId, { progress: 101 })).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_PROGRESS,
      });
    });

    it('should track telemetry on update', async () => {
      const sessionId = 'session-telemetry';
      await service.createGameState(sessionId);

      await service.updateGameState(sessionId, { progress: 75 });

      expect(mockTelemetry.trackEvent).toHaveBeenCalledWith(
        'game_state_updated',
        expect.objectContaining({
          sessionId,
          progress: 75,
        })
      );
    });
  });

  describe('State Transitions', () => {
    const validTransitions: Array<{ from: GameStatus; to: GameStatus; method: string }> = [
      { from: 'IDLE', to: 'PLAYING', method: 'startGame' },
      { from: 'PLAYING', to: 'PAUSED', method: 'pauseGame' },
      { from: 'PAUSED', to: 'PLAYING', method: 'resumeGame' },
      { from: 'PLAYING', to: 'COMPLETED', method: 'completeGame' },
      { from: 'PAUSED', to: 'COMPLETED', method: 'completeGame' },
      { from: 'IDLE', to: 'COMPLETED', method: 'completeGame' },
    ];

    validTransitions.forEach(({ from, to, method }) => {
      it(`should allow valid transition ${from} -> ${to} via ${method}`, async () => {
        const sessionId = `session-${from}-${to}`;
        await service.createGameState(sessionId);

        // Set initial state if needed
        if (from !== 'IDLE') {
          await service.updateGameState(sessionId, { status: from });
        }

        const result = await (service as any)[method](sessionId);

        expect(result.status).toBe(to);
        expect(mockTelemetry.trackEvent).toHaveBeenCalledWith(
          `game_${to.toLowerCase()}`,
          expect.objectContaining({ sessionId })
        );
      });
    });

    const invalidTransitions: Array<{ from: GameStatus; to: GameStatus; method: string }> = [
      { from: 'COMPLETED', to: 'PLAYING', method: 'startGame' },
      { from: 'COMPLETED', to: 'PAUSED', method: 'pauseGame' },
      { from: 'COMPLETED', to: 'IDLE', method: 'resumeGame' },
      { from: 'IDLE', to: 'PAUSED', method: 'pauseGame' },
      { from: 'PAUSED', to: 'IDLE', method: 'startGame' },
    ];

    invalidTransitions.forEach(({ from, to, method }) => {
      it(`should reject invalid transition ${from} -> ${to} via ${method}`, async () => {
        const sessionId = `session-invalid-${from}-${to}`;
        await service.createGameState(sessionId);

        if (from !== 'IDLE') {
          await service.updateGameState(sessionId, { status: from });
        }

        await expect((service as any)[method](sessionId)).rejects.toThrow(GameStateError);
        await expect((service as any)[method](sessionId)).rejects.toMatchObject({
          code: GameStateErrorCode.INVALID_STATE_TRANSITION,
          statusCode: 400,
        });
      });
    });

    it('should track telemetry error on invalid transition', async () => {
      const sessionId = 'session-error-transition';
      await service.createGameState(sessionId);
      await service.updateGameState(sessionId, { status: 'COMPLETED' });

      await expect(service.startGame(sessionId)).rejects.toThrow();

      expect(mockTelemetry.trackError).toHaveBeenCalledWith(
        expect.any(GameStateError),
        expect.objectContaining({ sessionId })
      );
    });
  });

  describe('Score Calculation', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate base score from progress and level', async () => {
      const sessionId = 'session-score-1';
      await service.createGameState(sessionId, 5);
      await service.updateGameState(sessionId, { progress: 100 });

      const result = await service.completeGame(sessionId, { timeElapsed: 30000 });

      // Base: 100 * 5 * 10 = 5000
      expect(result.finalScore).toBe(5000);
    });

    it('should apply time bonus for fast completion', async () => {
      const sessionId = 'session-score-time';
      await service.createGameState(sessionId, 1);
      await service.updateGameState(sessionId, { progress: 100 });

      // Complete in 10 seconds (under 30s threshold for level 1)
      const result = await service.completeGame(sessionId, { timeElapsed: 10000 });

      // Base: 100 * 1 * 10 = 1000, Time bonus: 1000 * 2 = 2000, Total: 3000
      expect(result.finalScore).toBe(3000);
    });

    it('should apply combo bonus for high progress streaks', async () => {
      const sessionId = 'session-score-combo';
      await service.createGameState(sessionId, 3);
      await service.updateGameState(sessionId, { progress: 100, metadata: { combo: 15 } });

      const result = await service.completeGame(sessionId, { timeElapsed: 60000 });

      // Base: 100 * 3 * 10 = 3000, Combo bonus: 3000 * 0.5 = 1500, Total: 4500
      expect(result.finalScore).toBe(4500);
    });

    it('should apply perfect level bonus for 100% progress with no deaths', async () => {
      const sessionId = 'session-score-perfect';
      await service.createGameState(sessionId, 2);
      await service.updateGameState(sessionId, { 
        progress: 100, 
        metadata: { deaths: 0, perfectRun: true } 
      });

      const result = await service.completeGame(sessionId, { timeElapsed: 45000 });

      // Base: 100 * 2 * 10 = 2000, Perfect bonus: 2000 * 1.5 = 3000, Total: 5000
      expect(result.finalScore).toBe(5000);
    });

    it('should calculate score with all bonuses combined', async () => {
      const sessionId = 'session-score-all';
      await service.createGameState(sessionId, 4);
      await service.updateGameState(sessionId, { 
        progress: 100, 
        metadata: { combo: 20, deaths: 0, perfectRun: true } 
      });

      // Complete in 15 seconds (fast for level 4)
      const result = await service.completeGame(sessionId, { timeElapsed: 15000 });

      // Base: 100 * 4 * 10 = 4000
      // Time bonus: 4000 * 2 = 8000
      // Combo bonus: 4000 * 0.5 = 2000
      // Perfect bonus: 4000 * 1.5 = 6000
      // Total: 4000 + 8000 + 2000 + 6000 = 20000
      expect(result.finalScore).toBe(20000);
    });

    it('should not apply time bonus for slow completion', async () => {
      const sessionId = 'session-score-slow';
      await service.createGameState(sessionId, 1);
      await service.updateGameState(sessionId, { progress: 100 });

      // Complete in 60 seconds (over 30s threshold)
      const result = await service.completeGame(sessionId, { timeElapsed: 60000 });

      expect(result.finalScore).toBe(1000); // Base only
    });

    it('should throw if game not in PLAYING or PAUSED state', async () => {
      const sessionId = 'session-score-invalid';
      await service.createGameState(sessionId);
      // State is IDLE

      await expect(service.completeGame(sessionId, { timeElapsed: 1000 })).rejects.toThrow(GameStateError);
      await expect(service.completeGame(sessionId, { timeElapsed: 1000 })).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_STATE_TRANSITION,
      });
    });
  });

  describe('Level Progression', () => {
    it('should progress to next level on completion', async () => {
      const sessionId = 'session-progress-1';
      await service.createGameState(sessionId, 1);
      await service.updateGameState(sessionId, { progress: 100 });

      const result = await service.completeGame(sessionId, { timeElapsed: 30000 });

      expect(result.currentLevel).toBe(2);
      expect(result.progress).toBe(0);
      expect(result.status).toBe('IDLE'); // Reset for next level
    });

    it('should mark game complete at max level', async () => {
      const sessionId = 'session-progress-max';
      await service.createGameState(sessionId, 100);
      await service.updateGameState(sessionId, { progress: 10