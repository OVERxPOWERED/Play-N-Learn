```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerService } from '../playerService';
import type { Player, CreatePlayerInput, UpdatePlayerStatsInput } from '../../types/player';

// Mock the API module
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

    it('should handle network errors', async () => {
      const input: CreatePlayerInput = {
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
      };

      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(playerService.createPlayer(input)).rejects.toThrow('Network error');
    });
  });

  describe('getPlayerById', () => {
    it('should return Player when found', async () => {
      const playerId = 'player-123';
      const expectedPlayer: Player = {
        id: playerId,
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
        level: 5,
        xp: 1250,
        totalScore: 5000,
        gamesPlayed: 25,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      };

      mockApi.get.mockResolvedValueOnce({ data: expectedPlayer });

      const result = await playerService.getPlayerById(playerId);

      expect(mockApi.get).toHaveBeenCalledWith(`/players/${playerId}`);
      expect(result).toEqual(expectedPlayer);
    });

    it('should handle not found error', async () => {
      const playerId = 'non-existent';
      const apiError = new Error('Player not found');
      (apiError as any).status = 404;
      mockApi.get.mockRejectedValueOnce(apiError);

      await expect(playerService.getPlayerById(playerId)).rejects.toThrow('Player not found');
      expect(mockApi.get).toHaveBeenCalledWith(`/players/${playerId}`);
    });

    it('should throw error when playerId is empty', async () => {
      await expect(playerService.getPlayerById('')).rejects.toThrow('Player ID is required');
      expect(mockApi.get).not.toHaveBeenCalled();
    });

    it('should handle server errors', async () => {
      const playerId = 'player-123';
      const apiError = new Error('Internal server error');
      (apiError as any).status = 500;
      mockApi.get.mockRejectedValueOnce(apiError);

      await expect(playerService.getPlayerById(playerId)).rejects.toThrow('Internal server error');
    });
  });

  describe('updatePlayerStats', () => {
    it('should correctly calculate XP and level progression', async () => {
      const playerId = 'player-123';
      const input: UpdatePlayerStatsInput = {
        xpGained: 500,
        scoreGained: 1000,
        gamesPlayed: 1,
      };

      const currentPlayer: Player = {
        id: playerId,
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
        level: 1,
        xp: 0,
        totalScore: 0,
        gamesPlayed: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const updatedPlayer: Player = {
        ...currentPlayer,
        level: 2,
        xp: 500,
        totalScore: 1000,
        gamesPlayed: 1,
        updatedAt: new Date().toISOString(),
      };

      mockApi.get.mockResolvedValueOnce({ data: currentPlayer });
      mockApi.put.mockResolvedValueOnce({ data: updatedPlayer });

      const result = await playerService.updatePlayerStats(playerId, input);

      expect(mockApi.get).toHaveBeenCalledWith(`/players/${playerId}`);
      expect(mockApi.put).toHaveBeenCalledWith(`/players/${playerId