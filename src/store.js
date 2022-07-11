import { Redis } from "@upstash/redis/fastly";

// The name of the backend providing the Upstash Redis service.
const UPSTASH_BACKEND = "upstash";

const CURSOR_KEY = "queue:cursor";
const LENGTH_KEY = "queue:length";
const AUTO_KEY_PREFIX = "queue:auto";

// Get the current queue cursor, i.e. how many visitors have been let in
export async function getQueueCursor(store) {
  return parseInt((await store.get(CURSOR_KEY)) || 0);
}

// Increment the current queue cursor, letting in `amt` visitors.
//
// Returns the new cursor value.
export async function incrementQueueCursor(store, amt) {
  return await store.incrby(CURSOR_KEY, amt);
}

// Get the current length of the queue. Subtracting the cursor from this
// shows how many visitors are waiting.
export async function getQueueLength(store) {
  return parseInt(await store.get(LENGTH_KEY));
}

// Add the given amount of visitors to the queue.
//
// Returns the new queue length.
export async function incrementQueueLength(store, amt) {
  return await store.incrby(LENGTH_KEY, amt);
}

// Increment the request counter for the current period.
//
// Returns the new counter value.
export async function incrementAutoPeriod(store, config) {
  let period = Math.ceil(
    new Date().getTime() / (config.queue.automatic * 1000)
  );

  return await store.incr(`${AUTO_KEY_PREFIX}:${period}`);
}

// Helper function for configuring a Redis client.
export function getStore(config) {
  return new Redis({
    url: config.upstash.url,
    token: config.upstash.token,
    backend: UPSTASH_BACKEND,
  });
}
