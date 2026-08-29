const { Redis } = require('@upstash/redis');

// Vercel's Upstash Marketplace integration can inject either naming
// depending on how it was connected — support both so this just works.
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

if (!url || !token) {
  console.error(
    'Redis env vars missing. Need KV_REST_API_URL + KV_REST_API_TOKEN, ' +
    'or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN. ' +
    'Connect an Upstash database to this project in Vercel → Storage.'
  );
}

const redis = new Redis({ url, token });

module.exports = { redis };
