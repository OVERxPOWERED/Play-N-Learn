import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { GameSessionService } from '@/services/gameSessionService';
import { TelemetryService } from '@/services/telemetryService';
import {
  GameSession,
  GameSessionState,
  CreateSessionInput,
  UpdateScoreInput,
  SessionNotFoundError,
  InvalidSessionStateError,
  ValidationError,
  GameSessionError,
} from '@/types/gameSession';

vi.mock('@/services/telemetryService');

describe('GameSessionService', () => {
  let service: GameSessionService;
  let mockTelemetryService: Mocked<TelemetryService>;
  const mockCorrelationId = 'test-correlation-id-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockTelemetryService = {
      startSpan: vi.fn().mockReturnValue({
        end: vi.fn(),
        setAttribute: vi.fn(),
        recordException: vi.fn(),
      }),
      recordMetric: vi.fn(),
      addEvent: vi.fn(),
    } as unknown as Mocked<TelemetryService>;

    (TelemetryService.getInstance as Mock).mockReturnValue(mockTelemetryService);

    service = new GameSessionService();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Error Classes', () => {
    it('SessionNotFoundError should have correct code and status', () => {
      const error = new SessionNotFoundError('session-123');
      expect(error.code).toBe('SESSION_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Game session session-123 not found');
      expect(error.sessionId).toBe('session-123');
    });

    it('InvalidSessionStateError should have correct code and status', () => {
      const error = new InvalidSessionStateError('ACTIVE', 'COMPLETED', 'session-123');
      expect(error.code).toBe('INVALID_SESSION_STATE_TRANSITION');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Cannot transition session session-123 from ACTIVE to COMPLETED');
      expect(error.currentState).toBe('ACTIVE');
      expect(error.requestedState).toBe('COMPLETED');
      expect(error.sessionId).toBe('session-123');
    });

    it('ValidationError should have correct code and status', () => {
      const error = new ValidationError('Invalid player ID', 'playerId');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Invalid player ID');
      expect(error.field).toBe('playerId');
    });

    it('GameSessionError should be base class with correct defaults', () => {
      const error = new GameSessionError('Base error', 'BASE_ERROR', 500);
      expect(error.code).toBe('BASE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('Base error');
    });
  });

  describe('createSession', () => {
    const validInput: CreateSessionInput = {
      playerId: 'player-123',
      gameMode: 'CLASSIC',
      initialConfig: { difficulty: 'NORMAL', timeLimit: 300 },
      correlationId: mockCorrelationId,
    };

    it('should create a session with valid input', async () => {
      const session = await service.createSession(validInput);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.playerId).toBe(validInput.playerId);
      expect(session.gameMode).toBe(validInput.gameMode);
      expect(session.state).toBe(GameSessionState.CREATED);
      expect(session.config).toEqual(validInput.initialConfig);
      expect(session.score).toBe(0);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.correlationId).toBe(mockCorrelationId);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await service.createSession(validInput);
      const session2 = await service.createSession(validInput);

      expect(session1.id).not.toBe(session2.id);
    });

    it('should throw ValidationError for missing playerId', async () => {
      const invalidInput = { ...validInput, playerId: '' };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
      await expect(service.createSession(invalidInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        field: 'playerId',
      });
    });

    it('should throw ValidationError for missing gameMode', async () => {
      const invalidInput = { ...validInput, gameMode: '' as any };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
      await expect(service.createSession(invalidInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        field: 'gameMode',
      });
    });

    it('should throw ValidationError for invalid gameMode', async () => {
      const invalidInput = { ...validInput, gameMode: 'INVALID_MODE' as any };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
      await expect(service.createSession(invalidInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        field: 'gameMode',
      });
    });

    it('should throw ValidationError for missing initialConfig', async () => {
      const invalidInput = { ...validInput, initialConfig: null as any };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
      await expect(service.createSession(invalidInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        field: 'initialConfig',
      });
    });

    it('should throw ValidationError for invalid timeLimit in config', async () => {
      const invalidInput = { ...validInput, initialConfig: { difficulty: 'NORMAL', timeLimit: -1 } };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
      await expect(service.createSession(invalidInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        field: 'initialConfig.timeLimit',
      });
    });

    it('should throw ValidationError for invalid difficulty in config', async () => {
      const invalidInput = { ...validInput, initialConfig: { difficulty: 'INVALID', timeLimit: 300 } };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
      await expect(service.createSession(invalidInput)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        field: 'initialConfig.difficulty',
      });
    });

    it('should record telemetry metrics on session creation', async () => {
      await service.createSession(validInput);

      expect(mockTelemetryService.recordMetric).toHaveBeenCalledWith(
        'game_session_created',
        1,
        expect.objectContaining({
          gameMode: validInput.gameMode,
          playerId: validInput.playerId,
        })
      );
    });
  });

  describe('getSession', () => {
    it('should return session when it exists', async () => {
      const input: CreateSessionInput = {
        playerId: 'player-123',
        gameMode: 'CLASSIC',
        initialConfig: { difficulty: 'NORMAL', timeLimit: 300 },
        correlationId: mockCorrelationId,
      };
      const created = await service.createSession(input);
      const session = await service.getSession(created.id);

      expect(session).toEqual(created);
    });

    it('should throw SessionNotFoundError for non-existent session', async () => {
      await expect(service.getSession('non-existent-id')).rejects.toThrow(SessionNotFoundError);
      await expect(service.getSession('non-existent-id')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
        sessionId: 'non-existent-id',
        statusCode: 404,
      });
    });

    it('should throw SessionNotFoundError for empty session ID', async () => {
      await expect(service.getSession('')).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('updateScore', () => {
    let sessionId: string;

    beforeEach(async () => {
      const input: CreateSessionInput = {
        playerId: 'player-123',
        gameMode: 'CLASSIC',
        initialConfig: { difficulty: 'NORMAL', timeLimit: 300 },
        correlationId: mockCorrelationId,
      };
      const session = await service.createSession(input);
      sessionId = session.id;
      // Transition to ACTIVE to allow score updates
      await service.transitionState(sessionId, GameSessionState.ACTIVE);
    });

    it('should update score for active session', async () => {
      const input: UpdateScoreInput = {
        sessionId,
        scoreDelta: 100,
        correlationId: mockCorrelationId,
      };

      const updated = await service.updateScore(input);

      expect(updated.score).toBe(100);
      expect(updated.updatedAt).toBeInstanceOf(Date);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(new Date().getTime() - 1000);
    });

    it('should accumulate score across multiple updates', async () => {
      await service.updateScore({ sessionId, scoreDelta: 50, correlationId: mockCorrelationId });
      await service.updateScore({ sessionId, scoreDelta: 75, correlationId: mockCorrelationId });
      const updated = await service.updateScore({ sessionId, scoreDelta: 25, correlationId: mockCorrelationId });

      expect(updated.score).toBe(150);
    });

    it('should throw SessionNotFoundError for non-existent session', async () => {
      await expect(
        service.updateScore({ sessionId: 'non-existent', scoreDelta: 100, correlationId: mockCorrelationId })
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw InvalidSessionStateError for CREATED state session', async () => {
      const input: CreateSessionInput = {
        playerId: 'player-456',
        gameMode: 'CLASSIC',
        initialConfig: { difficulty: 'NORMAL', timeLimit: 300 },
        correlationId: mockCorrelationId,
      };
      const created = await service.createSession(input);
      // Session is in CREATED state, not ACTIVE

      await expect(
        service.updateScore({ sessionId: created.id, scoreDelta: 100, correlationId: mockCorrelationId })
      ).rejects.toThrow(InvalidSessionStateError);
    });

    it('should throw InvalidSessionStateError for COMPLETED session', async () => {
      await service.transitionState(sessionId, GameSessionState.COMPLETED);

      await expect(
        service.updateScore({ sessionId, scoreDelta: 100, correlationId: mockCorrelationId })
      ).rejects.toThrow(InvalidSessionStateError);
    });

    it('should throw InvalidSessionStateError for ABANDONED session', async () => {
      await service.transitionState(sessionId, GameSessionState.ABANDONED);

      await expect(
        service.updateScore({ sessionId, scoreDelta: 100, correlationId: mockCorrelationId })
      ).rejects.toThrow(InvalidSessionStateError);
    });

    it('should throw ValidationError for negative scoreDelta', async () => {
      await expect(
        service.updateScore({ sessionId, scoreDelta: -50, correlationId: mockCorrelationId })
      ).rejects.toThrow(ValidationError);
      await expect(
        service.updateScore({ sessionId, scoreDelta: -50, correlationId: mockCorrelationId })
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        field: 'scoreDelta',
      });
    });

    it('should throw ValidationError for non-integer scoreDelta', async () => {
      await expect(
        service.updateScore({ sessionId, scoreDelta: 10.5, correlationId: mockCorrelationId })
      ).rejects.toThrow(ValidationError);
    });

    it('should record telemetry metrics on score update', async () => {
      await service.updateScore({ sessionId, scoreDelta: 100, correlationId: mockCorrelationId });

      expect(mockTelemetryService.recordMetric).toHaveBeenCalledWith(
        'game_session_score_updated',
        100,
        expect.objectContaining({
          sessionId,
          newScore: 100,
        })
      );
    });
  });

  describe('completeSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      const input: CreateSessionInput = {
        playerId: 'player-123',
        gameMode: 'CLASSIC',
        initialConfig: { difficulty: 'NORMAL', timeLimit: 300 },
        correlationId: mockCorrelationId,
      };
      const session = await service.createSession(input);
      sessionId = session.id;
      await service.transitionState(sessionId, GameSessionState.ACTIVE);
      await service.updateScore({ sessionId, scoreDelta: 500, correlationId: mockCorrelationId });
    });

    it('should complete an active session', async () => {
      const completed = await service.completeSession(sessionId, mockCorrelationId);

      expect(completed.state).toBe(GameSessionState.COMPLETED);
      expect(completed.score).toBe(500);
      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(completed.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw SessionNotFoundError for non-existent session', async () => {
      await expect(service.completeSession('non-existent', mockCorrelationId)).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw InvalidSessionStateError for CREATED state session', async () => {
      const input: CreateSessionInput = {
        playerId: 'player-456',
        gameMode: 'CLASSIC',
        initialConfig: { difficulty: 'NORMAL', timeLimit: 300 },
        correlationId: mockCorrelationId,
      };
      const created = await service.createSession(input);

      await expect(service.completeSession(created.id, mockCorrelationId)).rejects.toThrow(InvalidSessionStateError);
    });

    it('should throw InvalidSessionStateError for already COMPLETED session', async () => {
      await service.completeSession(sessionId, mockCorrelationId);

      await expect(service.completeSession(sessionId, mockCorrelationId)).rejects.toThrow(InvalidSessionStateError);
    });

    it('should throw InvalidSessionStateError for ABANDONED session', async () => {
      await service.transitionState(sessionId, GameSessionState.ABANDONED);

      await expect(service.completeSession(sessionId, mockCorrelationId)).rejects.toThrow(InvalidSessionStateError);
    });

    it('should record telemetry metrics on session completion', async () => {
      await service.completeSession(sessionId, mockCorrelationId);

      expect(mockTelemetryService.recordMetric).toHaveBeenCalledWith(
        'game_session_completed',
        1,
        expect.objectContaining({
          sessionId,
          finalScore: 500,
          durationMs: expect.any(Number),
        })
      );
    });
  });

  describe('transitionState', () => {
    let sessionId: string;

    beforeEach(async () => {
      const input: CreateSessionInput = {
        playerId: 'player-123',
        gameMode: 'CLASSIC',
        initialConfig: { difficulty: 'NORMAL', timeLimit: 300 },
        correlationId: mockCorrelationId,
      };
      const session = await service.createSession(input);
      sessionId = session.id;
    });

    describe('valid transitions', () => {
      it('should transition from CREATED to ACTIVE', async () => {
        const updated = await service.transitionState(sessionId, GameSessionState.ACTIVE);

        expect(updated.state).toBe(GameSessionState.ACTIVE);
        expect(updated.startedAt).toBeInstanceOf(Date);
      });

      it('should transition from ACTIVE to COMPLETED', async () => {
        await service.transitionState(sessionId, GameSessionState.ACTIVE);
        const updated = await service.transitionState(sessionId, GameSessionState.COMPLETED);

        expect(updated.state).toBe(GameSessionState.COMPLETED);
        expect(updated.completedAt).toBeInstanceOf(Date);
      });

      it('should transition from ACTIVE to ABANDONED', async () => {
        await service.transitionState(sessionId, GameSessionState.ACTIVE);
        const updated = await service.transitionState(sessionId, GameSessionState.ABANDONED);

        expect(updated.state).toBe(GameSessionState.ABANDONED);
        expect(updated.abandonedAt).toBeInstanceOf(Date);
      });

      it('should transition from CREATED to ABANDONED', async () => {
        const updated = await service.transitionState(sessionId, GameSessionState.ABANDONED);

        expect(updated.state).toBe(GameSessionState.ABANDONED);
        expect(updated.abandonedAt).toBeInstanceOf(Date);
      });
    });

    describe('invalid transitions