import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTrack, getClips, stemClip } from '../suno';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubEnv('SUNO_API_KEY', 'test-key-123');
});

describe('suno client', () => {
  describe('generateTrack', () => {
    it('sends POST with correct body and Bearer token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'gen-1', clips: [], metadata: {}, created_at: '' }),
      });

      await generateTrack({ topic: 'lofi vibes', tags: 'lofi, chill' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key-123',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ topic: 'lofi vibes', tags: 'lofi, chill' }),
        })
      );
    });

    it('throws on non-retryable error (e.g. 400)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      });

      await expect(generateTrack({ topic: 'test' })).rejects.toThrow('Suno request failed (400)');
    });

    it('retries on 429 rate limit then succeeds', async () => {
      // First call: rate limited
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers(),
        text: () => Promise.resolve('Rate limited'),
      });
      // Second call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'gen-1', clips: [], metadata: {}, created_at: '' }),
      });

      const result = await generateTrack({ topic: 'test' });
      expect(result.id).toBe('gen-1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries on persistent 429', async () => {
      // All 4 attempts (1 initial + 3 retries) rate limited
      const errorResponse = {
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '0' }),
        text: () => Promise.resolve('Rate limited'),
      };
      mockFetch
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse)
        .mockResolvedValueOnce(errorResponse);

      await expect(generateTrack({ topic: 'test' })).rejects.toThrow('Suno request failed (429)');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('getClips', () => {
    it('sends GET with ids query param', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 'clip-1', status: 'complete' }]),
      });

      await getClips(['clip-1', 'clip-2']);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/clips?ids=clip-1,clip-2'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key-123',
          }),
        })
      );
    });
  });

  describe('stemClip', () => {
    it('sends POST with clip_id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'stem-1', clips: [] }),
      });

      await stemClip('clip-abc');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/stem'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ clip_id: 'clip-abc' }),
        })
      );
    });

    it('retries on 500 then succeeds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: () => Promise.resolve('Server error'),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'stem-1', clips: [] }),
      });

      const result = await stemClip('bad-id');
      expect(result.id).toBe('stem-1');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on non-retryable error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(stemClip('bad-id')).rejects.toThrow('Suno request failed (404)');
    });
  });
});
