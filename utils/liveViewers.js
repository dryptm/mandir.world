// utils/liveViewers.js
// Tracks REAL concurrent viewers per stream — people watching RIGHT NOW.
// This is NOT a cumulative counter. It goes up when someone opens a stream
// and goes back down the moment they leave (or after a short timeout if
// their tab closes without warning — e.g. phone killed, browser crashed).
//
// Stored in-memory (not MongoDB) because this is ephemeral, high-frequency
// data — writing every heartbeat to a database would be wasteful and slow.
// Note: with multiple server instances this would need a shared store
// (Redis) instead of an in-memory Map; fine for a single Railway instance.

const ACTIVE_TIMEOUT_MS = 45 * 1000; // if no heartbeat in 45s, assume they left

// key = `${streamId}:${viewerId}` → last heartbeat timestamp (ms)
const activeViewers = new Map();

function heartbeat(streamId, viewerId) {
  if (!streamId || !viewerId) return;
  activeViewers.set(`${streamId}:${viewerId}`, Date.now());
}

function leave(streamId, viewerId) {
  if (!streamId || !viewerId) return;
  activeViewers.delete(`${streamId}:${viewerId}`);
}

// Returns the current real concurrent viewer count for a stream.
// Also opportunistically purges stale entries (crashed tabs, killed apps)
// so the Map doesn't grow forever.
function getConcurrentCount(streamId) {
  const now = Date.now();
  const prefix = `${streamId}:`;
  let count = 0;

  for (const [key, lastSeen] of activeViewers) {
    if (!key.startsWith(prefix)) continue;
    if (now - lastSeen > ACTIVE_TIMEOUT_MS) {
      activeViewers.delete(key); // stale — they're gone, clean it up
      continue;
    }
    count++;
  }
  return count;
}

module.exports = { heartbeat, leave, getConcurrentCount };
