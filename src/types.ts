export interface SpyglassesConfig {
  apiKey?: string;
  debug?: boolean;
  collectEndpoint?: string;
  patternsEndpoint?: string;
  platformType?: string;
  excludePaths?: (string | RegExp)[];
  logging?: {
    blockingTimeout?: number | null;
    awaitBlockedLogging?: boolean;
  };
}

// H3 event type is available in Nuxt/Nitro; keep it loose here to avoid peer type requirements
export type SpyglassesMiddleware = (event: any) => Promise<any>;
export type CreateSpyglassesMiddleware = (config: SpyglassesConfig) => SpyglassesMiddleware;

