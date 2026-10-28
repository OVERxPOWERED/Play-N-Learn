import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { GameStateService } from '@/services/gameStateService';
import { GameStateError, GameStateErrorCode } from '@/lib/errors/gameStateErrors';
import { telemetryService } from '@/services/telemetryService';
import type { GameState, GameMetadata } from '@/types/game';

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
          operation: 'createGameState',
        })
      );
    });
  });

  describe('getGameState', () => {
    it('should return existing game state', async () => {
      const sessionId = 'session-get-1';
      await service.createGameState(sessionId, 5);

      const gameState = await service.getGameState(sessionId);

      expect(gameState).toBeDefined();
      expect(gameState.sessionId).toBe(sessionId);
      expect(gameState.currentLevel).toBe(5);
    });

    it('should throw GameStateError when game state not found', async () => {
      await expect(service.getGameState('non-existent')).rejects.toThrow(GameStateError);
      await expect(service.getGameState('non-existent')).rejects.toMatchObject({
        code: GameStateErrorCode.NOT_FOUND,
        statusCode: 404,
      });
    });

    it('should return a copy to prevent external mutation', async () => {
      const sessionId = 'session-immutable';
      await service.createGameState(sessionId);

      const gameState1 = await service.getGameState(sessionId);
      const gameState2 = await service.getGameState(sessionId);

      expect(gameState1).not.toBe(gameState2);
      expect(gameState1).toEqual(gameState2);
    });
  });

  describe('updateProgress', () => {
    const sessionId = 'session-progress';

    beforeEach(async () => {
      await service.createGameState(sessionId);
    });

    it('should update progress with valid positive delta', async () => {
      const result = await service.updateProgress(sessionId, 25);

      expect(result.progress).toBe(25);
      expect(result.updatedAt).not.toEqual(result.createdAt);
    });

    it('should clamp progress at 100 (upper bound)', async () => {
      await service.updateProgress(sessionId, 80);
      const result = await service.updateProgress(sessionId, 50);

      expect(result.progress).toBe(100);
    });

    it('should clamp progress at 0 (lower bound)', async () => {
      await service.updateProgress(sessionId, 30);
      const result = await service.updateProgress(sessionId, -50);

      expect(result.progress).toBe(0);
    });

    it('should handle overflow beyond 100 correctly', async () => {
      const result = await service.updateProgress(sessionId, 150);

      expect(result.progress).toBe(100);
    });

    it('should handle underflow below 0 correctly', async () => {
      await service.updateProgress(sessionId, 10);
      const result = await service.updateProgress(sessionId, -100);

      expect(result.progress).toBe(0);
    });

    it('should throw GameStateError for non-existent session', async () => {
      await expect(service.updateProgress('non-existent', 10)).rejects.toThrow(GameStateError);
      await expect(service.updateProgress('non-existent', 10)).rejects.toMatchObject({
        code: GameStateErrorCode.NOT_FOUND,
      });
    });

    it('should throw GameStateError when game is already complete', async () => {
      await service.completeGameState(sessionId, 5000);

      await expect(service.updateProgress(sessionId, 10)).rejects.toThrow(GameStateError);
      await expect(service.updateProgress(sessionId, 10)).rejects.toMatchObject({
        code: GameStateErrorCode.GAME_ALREADY_COMPLETE,
        statusCode: 400,
      });
    });

    it('should track telemetry event on progress update', async () => {
      await service.updateProgress(sessionId, 30);

      expect(mockTelemetry.trackEvent).toHaveBeenCalledWith(
        'game_progress_updated',
        expect.objectContaining({
          sessionId,
          progress: 30,
          delta: 30,
        })
      );
    });

    it('should track telemetry event with clamped values', async () => {
      await service.updateProgress(sessionId, 90);
      await service.updateProgress(sessionId, 50);

      expect(mockTelemetry.trackEvent).toHaveBeenLastCalledWith(
        'game_progress_updated',
        expect.objectContaining({
          sessionId,
          progress: 100,
          delta: 50,
        })
      );
    });
  });

  describe('updateLevel', () => {
    const sessionId = 'session-level';

    beforeEach(async () => {
      await service.createGameState(sessionId, 1);
    });

    it('should update to next valid level', async () => {
      const result = await service.updateLevel(sessionId, 2);

      expect(result.currentLevel).toBe(2);
      expect(result.progress).toBe(0);
    });

    it('should allow sequential level progression', async () => {
      await service.updateLevel(sessionId, 2);
      await service.updateLevel(sessionId, 3);
      const result = await service.updateLevel(sessionId, 4);

      expect(result.currentLevel).toBe(4);
    });

    it('should throw GameStateError when skipping levels (skip validation)', async () => {
      await expect(service.updateLevel(sessionId, 5)).rejects.toThrow(GameStateError);
      await expect(service.updateLevel(sessionId, 5)).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_LEVEL_TRANSITION,
        statusCode: 400,
      });
    });

    it('should throw GameStateError for level below 1', async () => {
      await expect(service.updateLevel(sessionId, 0)).rejects.toThrow(GameStateError);
      await expect(service.updateLevel(sessionId, 0)).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_LEVEL,
      });
    });

    it('should throw GameStateError for level above maximum (100)', async () => {
      await expect(service.updateLevel(sessionId, 101)).rejects.toThrow(GameStateError);
      await expect(service.updateLevel(sessionId, 101)).rejects.toMatchObject({
        code: GameStateErrorCode.INVALID_LEVEL,
      });
    });

    it('should throw GameStateError for non-existent session', async () => {
      await expect(service.updateLevel('non-existent', 2)).rejects.toThrow(GameStateError);
    });

    it('should throw GameStateError when game is already complete', async () => {
      await service.completeGameState(sessionId, 1000);

      await expect(service.updateLevel(sessionId, 2)).rejects.toThrow(GameStateError);
      await expect(service.updateLevel(sessionId, 2)).rejects.toMatchObject({
        code: GameStateErrorCode.GAME_ALREADY_COMPLETE,
      });
    });

    it('should reset progress to 0 on level change', async () => {
      await service.updateProgress(sessionId, 75);
      const result = await service.updateLevel(sessionId, 2);

      expect(result.progress).toBe(0);
    });

    it('should track telemetry event on level update', async () => {
      await service.updateLevel(sessionId, 2);

      expect(mockTelemetry.trackEvent).toHaveBeenCalledWith(
        'game_level_updated',
        expect.objectContaining({
          sessionId,
          previousLevel: 1,
          newLevel: 2,
        })
      );
    });
  });

  describe('updateMetadata', () => {
    const sessionId = 'session-metadata';

    beforeEach(async () => {
      await service.createGameState(sessionId);
    });

    it('should merge metadata with existing data', async () => {
      await service.updateMetadata(sessionId, { key1: 'value1' });
      const result = await service.updateMetadata(sessionId, { key2: 'value2' });

      expect(result.metadata).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should overwrite existing keys', async () => {
      await service.updateMetadata(sessionId, { key: 'old' });
      const result = await service.updateMetadata(sessionId, { key: 'new' });

      expect(result.metadata).toEqual({ key: 'new' });
    });

    it('should handle complex nested objects', async () => {
      const complexData = {
        player: { name: 'Test', stats: { hp: 100, mp: 50 } },
        settings: { difficulty: 'hard', sound: true },
      };

      const result = await service.updateMetadata(sessionId, complexData);

      expect(result.metadata).toEqual(complexData);
    });

    it('should throw GameStateError for non-existent session', async () => {
      await expect(service.updateMetadata('non-existent', { key: 'value' })).rejects.toThrow(
        GameStateError
      );
    });

    it('should throw GameStateError when game is already complete', async () => {
      await service.completeGameState(sessionId, 1000);

      await expect(service.updateMetadata(sessionId, { key: 'value' })).rejects.toThrow(
        GameStateError
      );
      await expect(service.updateMetadata(sessionId, { key: 'value' })).rejects.toMatchObject({
        code: GameStateErrorCode.GAME_ALREADY_COMPLETE,
      });
    });

    it('should track telemetry event on metadata update', async () => {
      await service.updateMetadata(sessionId, { customKey: 'customValue' });

      expect(mockTelemetry.trackEvent).toHaveBeenCalledWith(
        'game_metadata_updated',
        expect.objectContaining({
          sessionId,
          metadataKeys: ['customKey'],
        })
      );
    });

    it('should preserve type safety for metadata values', async () => {
      const metadata: GameMetadata = {
        stringVal: 'test',
        numberVal: 42,
        booleanVal: true,
        arrayVal: [1, 2, 3],
        objectVal: { nested: 'value' },
        nullVal: null,
      };

      const result = await service.updateMetadata(sessionId, metadata);

      expect(result.metadata).toEqual(metadata);
    });
  });

  describe('completeGameState', () => {
    const sessionId = 'session-complete';

    beforeEach(async () => {
      await service.createGameState(sessionId, 10);
      await service.updateProgress(sessionId, 100);
    });

    it('should mark game as complete with final score', async () => {
      const finalScore = 10000;
      const result = await service.completeGameState(sessionId, finalScore);

      expect(result.isComplete).toBe(true);
      expect(result.finalScore).toBe(finalScore);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should throw GameStateError for non-existent session', async () => {
      await expect(service.completeGameState('non-existent', 1000)).rejects.toThrow(GameStateError);
    });

    it('should throw GameStateError when already complete', async () => {
      await service.completeGameState(sessionId, 5000);

      await expect(service.completeGameState(sessionId, 6000)).rejects.toThrow(GameStateError);
      await expect(service.completeGameState(sessionId, 6000)).rejects.toMatchObject({
        code: GameStateErrorCode.GAME_ALREADY_COMPLETE,
      });
    });

    it('should enforce immutability after completion - progress updates blocked', async () => {
      await service.completeGameState(sessionId, 5000);

      await expect(service.updateProgress(sessionId, 10)).rejects.toThrow(GameStateError);
    });

    it('should enforce immutability after completion - level updates blocked', async () => {
      await service.completeGameState(sessionId, 5000);

      await expect(service.updateLevel(sessionId, 11)).rejects.toThrow(GameStateError);
    });

    it('should enforce immutability after completion - metadata updates blocked', async () => {
      await service.completeGameState(sessionId, 5000);

      await expect(service.updateMetadata(sessionId, { key: 'value' })).rejects.toThrow(
        GameStateError
      );
    });

    it('should enforce immutability after completion - second completion blocked', async () => {
      await service.completeGameState(sessionId, 5000);

      await expect(service.completeGameState(sessionId, 6000)).rejects.toThrow(GameStateError);
    });

    it('should track telemetry event on game completion', async () => {
      await service.completeGameState(sessionId, 15000);

      expect(mockTelemetry.trackEvent).toHaveBeenCalledWith(
        'game_completed',
        expect.objectContaining({
          sessionId,
          finalScore: 15000,
          finalLevel: 10,
          totalProgress: 100,
        })
      );
    });

    it('should track telemetry error on completion failure', async () => {
      await