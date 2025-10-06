import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpyglassesMiddleware } from '../middleware';

// Mock env
vi.stubEnv('SPYGLASSES_API_KEY', 'default-api-key');

vi.mock('@spyglasses/sdk', () => {
  const mockDetect = vi.fn();
  const mockLogRequest = vi.fn();
  const mockSyncPatterns = vi.fn();
  const mockHasApiKey = vi.fn();

  return {
    Spyglasses: vi.fn().mockImplementation((config) => {
      return {
        apiKey: config.apiKey,
        debug: config.debug,
        detect: mockDetect,
        logRequest: mockLogRequest,
        syncPatterns: mockSyncPatterns,
        hasApiKey: mockHasApiKey
      };
    }),
    _mocks: { detect: mockDetect, logRequest: mockLogRequest, syncPatterns: mockSyncPatterns, hasApiKey: mockHasApiKey }
  };
});

function makeEvent(urlStr: string, headers?: Record<string, string>, method: string = 'GET') {
  const req: any = { url: urlStr, method, headers: headers || {} };
  const resHeaders: Record<string, string> = {};
  const res: any = { statusCode: 200, setHeader: (k: string, v: string) => { resHeaders[k] = v; } };
  const event: any = { node: { req, res } };
  return { event, resHeaders };
}

describe('Spyglasses Nuxt Middleware', () => {
  let mockDetect: any;
  let mockLogRequest: any;
  let mockSyncPatterns: any;
  let mockHasApiKey: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { _mocks } = await import('@spyglasses/sdk') as any;
    mockDetect = _mocks.detect;
    mockLogRequest = _mocks.logRequest;
    mockSyncPatterns = _mocks.syncPatterns;
    mockHasApiKey = _mocks.hasApiKey;

    mockHasApiKey.mockReturnValue(true);
    mockSyncPatterns.mockResolvedValue({ version: '1.0.0', patterns: [], aiReferrers: [], propertySettings: { blockAiModelTrainers: false, customBlocks: [], customAllows: [] } });
    mockLogRequest.mockResolvedValue({});
    mockDetect.mockReturnValue({ isBot: false, shouldBlock: false, sourceType: 'none', matchedPattern: undefined, info: undefined });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Configuration', () => {
    it('creates middleware with defaults', async () => {
      const mw = createSpyglassesMiddleware({});
      const { event } = makeEvent('https://example.com');
      const res = await mw(event);
      expect(res).toBeUndefined();
    });
  });

  describe('Pattern Sync', () => {
    it('syncs when API key present', async () => {
      mockHasApiKey.mockReturnValue(true);
      createSpyglassesMiddleware({ apiKey: 'test' });
      await new Promise((r) => setTimeout(r, 10));
      expect(mockSyncPatterns).toHaveBeenCalled();
    });

    it('skips sync when no API key', async () => {
      mockHasApiKey.mockReturnValue(false);
      createSpyglassesMiddleware({});
      await new Promise((r) => setTimeout(r, 10));
      expect(mockSyncPatterns).not.toHaveBeenCalled();
    });
  });

  describe('Path Filtering', () => {
    it('skips static/internal paths', async () => {
      const mw = createSpyglassesMiddleware({});
      const { event } = makeEvent('https://example.com/_nuxt/app.js');
      await mw(event);
      expect(mockDetect).not.toHaveBeenCalled();
    });
  });

  describe('Detection and Logging', () => {
    it('does not log when no API key', async () => {
      mockHasApiKey.mockReturnValue(false);
      mockDetect.mockReturnValue({ isBot: true, shouldBlock: false, sourceType: 'bot' });
      const mw = createSpyglassesMiddleware({});
      const { event } = makeEvent('https://example.com', { 'user-agent': 'Googlebot' });
      await mw(event);
      expect(mockLogRequest).not.toHaveBeenCalled();
    });

    it('logs bot traffic', async () => {
      mockDetect.mockReturnValue({ isBot: true, shouldBlock: false, sourceType: 'bot', info: { type: 'crawler' } });
      const mw = createSpyglassesMiddleware({ apiKey: 'test' });
      const { event } = makeEvent('https://example.com', { 'user-agent': 'Googlebot', referer: 'https://google.com' });
      await mw(event);
      expect(mockLogRequest).toHaveBeenCalled();
    });
  });

  describe('Blocking', () => {
    it('returns 403 and body when blocked', async () => {
      mockDetect.mockReturnValue({ isBot: true, shouldBlock: true, sourceType: 'bot' });
      const mw = createSpyglassesMiddleware({ apiKey: 'test' });
      const { event, resHeaders } = makeEvent('https://example.com', { 'user-agent': 'AITrainer/1.0' });
      const body = await mw(event);
      expect(event.node.res.statusCode).toBe(403);
      expect(resHeaders['Content-Type']).toBe('text/plain');
      expect(body).toBe('Access Denied');
    });
  });
});

