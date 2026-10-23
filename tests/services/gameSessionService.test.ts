```typescript
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
    });

    it('should throw ValidationError for invalid gameMode', async () => {
      const invalidInput = { ...validInput, gameMode: 'INVALID_MODE' as any };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for missing correlationId', async () => {
      const invalidInput = { ...validInput, correlationId: '' };
      await expect(service.createSession(invalidInput)).rejects.toThrow(ValidationError);
    });

    it('should propagate correlationId to telemetry', async () => {
      await service.createSession(validInput);

      expect(mockTelemetryService.startSpan).toHaveBeenCalledWith(
        'gameSession.createSession',
        expect.objectContaining({ correlationId: mockCorrelationId })
      );
    });

    it('should use default config when initialConfig not provided', async () => {
      const inputWithoutConfig = { ...validInput, initialConfig: undefined };
      const session = await service.createSession(inputWithoutConfig);

      expect(session.config).toEqual({
        difficulty: 'NORMAL',
        timeLimit: 300,
        powerUpsEnabled: true,
      });
    });
  });

  describe('getSession', () => {
    let existingSession: GameSession;

    beforeEach(async () => {
      existingSession = await service.createSession({
        playerId: 'player-123',
        gameMode: 'CLASSIC',
        correlationId: mockCorrelationId,
      });
    });

    it('should return session when it exists', async () => {
      const session = await service.getSession(existingSession.id);

      expect(session).toEqual(existingSession);
    });

    it('should throw SessionNotFoundError for non-existent session', async () => {
      await expect(service.getSession('non-existent-id')).rejects.toThrow(SessionNotFoundError);
      await expect(service.getSession('non-existent-id')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
        statusCode: