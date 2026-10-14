```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerService } from '../../services/playerService';
import type { Player, CreatePlayerInput, GameSession, LearningProgress } from '../../types/player';

vi.mock('../../api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../../api';

describe('PlayerService', () => {
  let playerService: PlayerService;
  const mockApi = vi.mocked(api);

  beforeEach(() => {
    playerService = new PlayerService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createPlayer', () => {
    it('should validate input and return Player on success', async () => {
      const input: CreatePlayerInput = {
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      const expectedPlayer: Player = {
        id: 'player-123',
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
        level: 1,
        xp: 0,
        totalScore: 0,
        gamesPlayed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockApi.post.mockResolvedValueOnce({ data: expectedPlayer });

      const result = await playerService.createPlayer(input);

      expect(mockApi.post).toHaveBeenCalledWith('/players', input);
      expect(result).toEqual(expectedPlayer);
    });

    it('should throw error when username is empty', async () => {
      const input: CreatePlayerInput = {
        username: '',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      await expect(playerService.createPlayer(input)).rejects.toThrow('Username is required');
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('should throw error when email is invalid', async () => {
      const input: CreatePlayerInput = {
        username: 'testuser',
        email: 'invalid-email',
        displayName: 'Test User',
      };

      await expect(playerService.createPlayer(input)).rejects.toThrow('Invalid email format');
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('should throw error when displayName is empty', async () => {
      const input: CreatePlayerInput = {
        username: 'testuser',
        email: 'test@example.com',
        displayName: '',
      };

      await expect(playerService.createPlayer(input)).rejects.toThrow('Display name is required');
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('should handle API error when player already exists', async () => {
      const input: CreatePlayerInput = {
        username: 'existinguser',
        email: 'existing@example.com',
        displayName: 'Existing User',
      };

      const apiError = new Error('Player already exists');
      (apiError as any).status = 409;
      mockApi.post.mockRejectedValueOnce(apiError);

      await expect(playerService.createPlayer(input)).rejects.toThrow('Player already exists');
      expect(mockApi.post).toHaveBeenCalledWith('/players', input);
    });

    it('should handle generic API errors', async () => {
      const input: CreatePlayerInput = {
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      const apiError = new Error('Internal server error');
      (apiError as any).status = 500;
      mockApi.post.mockRejectedValueOnce(apiError);

      await expect(playerService.createPlayer(input)).rejects.toThrow('Internal server error');
    });
  });

  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(playerService.calculateLevel(0)).toBe(1);
    });

    it('should return level 1 for XP below first threshold', () => {
      expect(playerService.calculateLevel(50)).toBe(1);
      expect(playerService.calculateLevel(99)).toBe(1);
    });

    it('should return level 2 at 100 XP boundary', () => {
      expect(playerService.calculateLevel(100)).toBe(2);
    });

    it('should return level 2 for XP between 100 and 399', () => {
      expect(playerService.calculateLevel(150)).toBe(2);
      expect(playerService.calculateLevel(399)).toBe(2);
    });

    it('should return level 3 at 400 XP boundary', () => {
      expect(playerService.calculateLevel(400)).toBe(3);
    });

    it('should return level 3 for XP between 400 and 899', () => {
      expect(playerService.calculateLevel(500)).toBe(3);
      expect(playerService.calculateLevel(899)).toBe(3);
    });

    it('should return level 4 at 900 XP boundary', () => {
      expect(playerService.calculateLevel(900)).toBe(4);
    });

    it('should calculate higher levels correctly using XP curve formula', () => {
      expect(playerService.calculateLevel(1600)).toBe(5);
      expect(playerService.calculateLevel(2500)).toBe(6);
      expect(playerService.calculateLevel(3600)).toBe(7);
      expect(playerService.calculateLevel(4900)).toBe(8);
      expect(playerService.calculateLevel(6400)).toBe(9);
      expect(playerService.calculateLevel(8100)).toBe(10);
    });

    it('should handle very large XP values', () => {
      expect(playerService.calculateLevel(100000)).toBe(32);
      expect(playerService.calculateLevel(1000000)).toBe(100);
    });

    it('should throw error for negative XP', () => {
      expect(() => playerService.calculateLevel(-1)).toThrow('XP cannot be negative');
      expect(() => playerService.calculateLevel(-100)).toThrow('XP cannot be negative');
    });
  });

  describe('awardXp', () => {
    const mockPlayer: Player = {
      id: 'player-123',
      username: 'testuser',
      email: 'test@example.com',
      displayName: 'Test User',
      level: 1,
      xp: 50,
      totalScore: 100,
      gamesPlayed: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should award XP and return updated player when no level up', async () => {
      const updatedPlayer: Player = {
        ...mockPlayer,
        xp: 100,
        updatedAt: new Date().toISOString(),
      };

      mockApi.put.mockResolvedValueOnce({ data: updatedPlayer });

      const result = await playerService.awardXp('player-123', 50);

      expect(mockApi.put).toHaveBeenCalledWith('/players/player-123/xp', { xp: 50 });
      expect(result).toEqual(updatedPlayer);
      expect(result