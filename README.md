# Spyglasses for Nuxt

[![npm version](https://badge.fury.io/js/@spyglasses%2Fnuxt.svg)](https://www.npmjs.com/package/@spyglasses/nuxt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Server middleware for Nuxt (Nitro) to detect AI Agents, bots, and AI referrers. Matches the behavior and options of the Next.js package.

## Installation

```bash
npm install @spyglasses/nuxt
# or
yarn add @spyglasses/nuxt
# or
pnpm add @spyglasses/nuxt
```

## Quick Start (Global server middleware)

Create `server/middleware/spyglasses.global.ts` in your Nuxt app:

```ts
// server/middleware/spyglasses.global.ts
import { createSpyglassesMiddleware } from '@spyglasses/nuxt';

export default createSpyglassesMiddleware({
  apiKey: process.env.SPYGLASSES_API_KEY,
  debug: process.env.SPYGLASSES_DEBUG === 'true'
});
```

That's it. The middleware runs for all requests on the server.

## Environment Variables

Same as the Next.js package: `SPYGLASSES_API_KEY`, `SPYGLASSES_CACHE_TTL`, `SPYGLASSES_DEBUG`, optional `SPYGLASSES_COLLECTOR_ENDPOINT`, `SPYGLASSES_PATTERNS_ENDPOINT`.

## Examples

See `examples` for basic usage.

## License

MIT License - see `LICENSE` for details.

