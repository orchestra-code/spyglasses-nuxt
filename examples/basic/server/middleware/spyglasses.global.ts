import { createSpyglassesMiddleware } from '@spyglasses/nuxt';

export default createSpyglassesMiddleware({
  apiKey: process.env.SPYGLASSES_API_KEY,
  debug: process.env.SPYGLASSES_DEBUG === 'true'
});

