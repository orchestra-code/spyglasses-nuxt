import { Spyglasses } from '@spyglasses/sdk';
import type { SpyglassesConfig, SpyglassesMiddleware } from './types';

function getEnv(name: string): string | undefined {
  const env = (globalThis as any)?.process?.env as Record<string, string | undefined> | undefined;
  return env ? env[name] : undefined;
}

const COLLECTOR_ENDPOINT = getEnv('SPYGLASSES_COLLECTOR_ENDPOINT') || 'https://www.spyglasses.io/api/collect';
const PATTERNS_ENDPOINT = getEnv('SPYGLASSES_PATTERNS_ENDPOINT') || 'https://www.spyglasses.io/api/patterns';
const API_KEY = getEnv('SPYGLASSES_API_KEY');
const DEBUG = getEnv('SPYGLASSES_DEBUG') === 'true';

let patternSyncPromise: Promise<unknown> | null = null;

async function syncPatterns(spyglasses: Spyglasses, debug: boolean = false): Promise<void> {
  if (patternSyncPromise) {
    if (debug) console.log('Spyglasses(Nuxt): Pattern sync already in progress, waiting...');
    await patternSyncPromise;
    return;
  }

  if (spyglasses.hasApiKey()) {
    if (debug) console.log('Spyglasses(Nuxt): Starting pattern sync...');
    patternSyncPromise = spyglasses.syncPatterns();
    try {
      await patternSyncPromise;
    } catch (err) {
      if (debug) console.error('Spyglasses(Nuxt): Pattern sync failed, using defaults:', err);
    } finally {
      patternSyncPromise = null;
    }
  } else if (debug) {
    console.warn('Spyglasses(Nuxt): No API key provided, using default patterns only');
  }
}

function shouldExcludePath(path: string, excludePatterns: (string | RegExp)[] = [], debug: boolean = false): boolean {
  if (
    path.startsWith('/_nuxt/') ||
    path.startsWith('/__nuxt') ||
    path.startsWith('/api/') ||
    path.match(/\.(ico|png|jpg|jpeg|gif|svg|js|css|woff|woff2|webp|avif)$/)
  ) {
    if (debug) console.log(`Spyglasses(Nuxt): Excluding path (default): ${path}`);
    return true;
  }

  for (const pattern of excludePatterns) {
    if (typeof pattern === 'string' && path.includes(pattern)) {
      if (debug) console.log(`Spyglasses(Nuxt): Excluding path (custom string "${pattern}"): ${path}`);
      return true;
    } else if (pattern instanceof RegExp && pattern.test(path)) {
      if (debug) console.log(`Spyglasses(Nuxt): Excluding path (custom regex ${pattern}): ${path}`);
      return true;
    }
  }
  return false;
}

export function createSpyglassesMiddleware(config: SpyglassesConfig = {}): SpyglassesMiddleware {
  const debugMode = config.debug !== undefined ? config.debug : DEBUG;

  const spyglasses = new Spyglasses({
    apiKey: config.apiKey || API_KEY,
    debug: debugMode,
    collectEndpoint: config.collectEndpoint || COLLECTOR_ENDPOINT,
    patternsEndpoint: config.patternsEndpoint || PATTERNS_ENDPOINT,
    platformType: config.platformType || 'nuxt'
  });

  const excludePaths = config.excludePaths || [];

  if (spyglasses.hasApiKey()) {
    syncPatterns(spyglasses, debugMode).catch(() => {
      if (debugMode) console.error('Spyglasses(Nuxt): Background pattern sync failed, continuing with defaults');
    });
  }

  const blockingTimeout = config.logging?.blockingTimeout ?? 2000;
  const awaitBlockedLogging = config.logging?.awaitBlockedLogging ?? true;

  return async (event: any) => {
    const req: any = event?.node?.req;
    const res: any = event?.node?.res;

    const reqUrl = req?.url || '/';
    const url = new URL(reqUrl, 'http://localhost');
    const path = url.pathname;

    if (shouldExcludePath(path, excludePaths, debugMode)) {
      return;
    }

    const headers: Record<string, string> = Object.fromEntries(Object.entries(req?.headers || {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)]));
    const userAgent = headers['user-agent'] || '';
    const referrer = headers['referer'] || headers['referrer'] || '';

    if (debugMode) {
      console.log(`Spyglasses(Nuxt): Processing request to ${path}`);
      console.log(`Spyglasses(Nuxt): User-Agent: ${userAgent.substring(0, 100)}${userAgent.length > 100 ? '...' : ''}`);
      if (referrer) console.log(`Spyglasses(Nuxt): Referrer: ${referrer}`);
    }

    const detectionResult = spyglasses.detect(userAgent, referrer);

    if (debugMode && detectionResult.sourceType !== 'none') {
      console.log('Spyglasses(Nuxt): Detection result:', {
        sourceType: detectionResult.sourceType,
        isBot: detectionResult.isBot,
        shouldBlock: detectionResult.shouldBlock,
        matchedPattern: detectionResult.matchedPattern,
        info: detectionResult.info
      });
    }

    if (detectionResult.sourceType !== 'none' && spyglasses.hasApiKey()) {
      if (detectionResult.shouldBlock) {
        if (debugMode) console.log(`Spyglasses(Nuxt): Blocking ${detectionResult.sourceType}: ${detectionResult.matchedPattern}`);

        const logBlocked = async () => {
          try {
            const timeoutPromise = blockingTimeout && blockingTimeout > 0
              ? new Promise((_, reject) => setTimeout(() => reject(new Error('Logging timeout')), blockingTimeout))
              : new Promise((resolve) => resolve(undefined));

            await Promise.race([
              spyglasses.logRequest(detectionResult, {
                url: reqUrl,
                method: req?.method || 'GET',
                path: url.pathname,
                query: url.search,
                userAgent,
                referrer,
                ip: headers['x-forwarded-for'] || '',
                headers,
                responseStatus: 403
              }),
              timeoutPromise as Promise<unknown>
            ]);
          } catch (err) {
            if (debugMode) console.error('Spyglasses(Nuxt): Error logging blocked visit:', err);
          }
        };

        if (awaitBlockedLogging) {
          await logBlocked();
        } else {
          void logBlocked();
        }

        if (res) {
          res.statusCode = 403;
          if (typeof res.setHeader === 'function') {
            res.setHeader('Content-Type', 'text/plain');
          }
        }
        return 'Access Denied';
      }

      const logPromise = spyglasses.logRequest(detectionResult, {
        url: reqUrl,
        method: req?.method || 'GET',
        path: url.pathname,
        query: url.search,
        userAgent,
        referrer,
        ip: headers['x-forwarded-for'] || '',
        headers,
        responseStatus: 200
      });

      logPromise.catch((err: unknown) => {
        if (debugMode) console.error('Spyglasses(Nuxt): Error logging visit:', err);
      });
    }
  };
}

export default createSpyglassesMiddleware({});

