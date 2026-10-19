```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerService } from '@/services/playerService';
import { PlayerSchema, CreatePlayerInputSchema, UpdatePlayerInputSchema } from '@/domain';
import type { Player, CreatePlayerInput, UpdatePlayerInput, GameSession, LearningProgress, PaginatedResponse } from '@/types/player';
import { Result, Ok, Err } from '@/utils/result';

vi.mock('@/repositories/playerRepository', () => ({
  PlayerRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByUsername: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    count: vi.fn(),
    findGameSessionsByPlayerId: vi.fn(),
    findLearningProgressByPlayerId: vi.fn(),
    deleteGameSessionsByPlayerId: vi.fn(),
    deleteLearningProgressByPlayerId: vi.fn(),
  })),
}));

import { PlayerRepository } from '@/repositories/playerRepository';

describe('PlayerService', () => {
  let playerService: PlayerService;
  let mockRepository: ReturnType<typeof PlayerRepository>;

  const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
    id: 'player-123',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    level: 1,
    xp: 0,
    totalScore: 0,
    gamesPlayed: 0,
    createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  });

  const createMockCreateInput = (overrides: Partial<CreatePlayerInput> = {}): CreatePlayerInput => ({
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    ...overrides,
  });

  const createMockUpdateInput = (overrides: Partial<UpdatePlayerInput> = {}): UpdatePlayerInput => ({
    displayName: 'Updated Name',
    ...overrides,
  });

  beforeEach(() => {
    mockRepository = new PlayerRepository() as ReturnType<typeof PlayerRepository>;
    playerService = new PlayerService(mockRepository);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createPlayer', () => {
    it('should validate input and return Ok(Player) on success', async () => {
      const input = createMockCreateInput();
      const expectedPlayer = createMockPlayer();

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.findByUsername.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedPlayer);

      const result = await playerService.createPlayer(input);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(expectedPlayer);
        expect(PlayerSchema.parse(result.value)).toEqual(expectedPlayer);
      }
      expect(mockRepository.findByEmail).toHaveBeenCalledWith(input.email);
      expect(mockRepository.findByUsername).toHaveBeenCalledWith(input.username);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        username: input.username,
        email: input.email,
        displayName: input.displayName,
      }));
    });

    it('should return Err when username is empty', async () => {
      const input = createMockCreateInput({ username: '' });

      const result = await playerService.createPlayer(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('username');
      }
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should return Err when email is invalid', async () => {
      const input = createMockCreateInput({ email: 'invalid-email' });

      const result = await playerService.createPlayer(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('email');
      }
    });

    it('should return Err when displayName is empty', async () => {
      const input = createMockCreateInput({ displayName: '' });

      const result = await playerService.createPlayer(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('VALIDATION_ERROR');
        expect(result.error.message).toContain('displayName');
      }
    });

    it('should return Err when email already exists', async () => {
      const input = createMockCreateInput();
      const existingPlayer = createMockPlayer({ email: input.email });

      mockRepository.findByEmail.mockResolvedValue(existingPlayer);

      const result = await playerService.createPlayer(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('CONFLICT');
        expect(result.error.message).toContain('email');
      }
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should return Err when username already exists', async () => {
      const input = createMockCreateInput();
      const existingPlayer = createMockPlayer({ username: input.username });

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.findByUsername.mockResolvedValue(existingPlayer);

      const result = await playerService.createPlayer(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('CONFLICT');
        expect(result.error.message).toContain('username');
      }
    });

    it('should return Err when repository create fails', async () => {
      const input = createMockCreateInput();

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.findByUsername.mockResolvedValue(null);
      mockRepository.create.mockRejectedValue(new Error('Database connection failed'));

      const result = await playerService.createPlayer(input);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('INTERNAL_ERROR');
      }
    });

    it('should sanitize input before creating', async () => {
      const input = createMockCreateInput({
        username: '  testuser  ',
        email: '  TEST@EXAMPLE.COM  ',
        displayName: '  Test User  ',
      });
      const expectedPlayer = createMockPlayer({
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      });

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.findByUsername.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(expectedPlayer);

      const result = await playerService.createPlayer(input);

      expect(result.isOk()).toBe(true);
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      }));
    });
  });

  describe('getPlayer', () => {
    it('should return Ok(Player) when player exists', async () => {
      const player = createMockPlayer();
      mockRepository.findById.mockResolvedValue(player);

      const result = await playerService.getPlayer