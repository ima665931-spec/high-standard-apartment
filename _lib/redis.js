const { Redis } = require('@upstash/redis');

// Vercel's Upstash Marketplace integration can inject either naming
// depending on how it was connected — support both so this just works.
const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;

const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

const configured = Boolean(url && token);

if (!configured) {
  console.error(
    'Redis env vars missing. Need KV_REST_API_URL + KV_REST_API_TOKEN, ' +
    'or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN. ' +
    'Connect an Upstash database to this project in Vercel → Storage, ' +
    'then redeploy.'
  );
}

// IMPORTANT: only construct the client if we actually have credentials.
// @upstash/redis throws synchronously when url/token are missing, and
// since this file runs at require() time (before any try/catch in the
// route handlers), that throw would crash the whole serverless function
// with FUNCTION_INVOCATION_FAILED instead of a readable JSON error.
let redis = null;
if (configured) {
  try {
    redis = new Redis({ url, token });
  } catch (e) {
    console.error('Failed to create Redis client:', e);
    redis = null;
  }
}

module.exports = { redis, redisConfigured: configured };
