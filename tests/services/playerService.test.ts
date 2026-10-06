import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerService } from '../../services/playerService';
import type { Player, CreatePlayerInput } from '../../types/player';

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
});