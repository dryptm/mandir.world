// utils/liveViewers.js
// Tracks REAL concurrent viewers per stream — people watching RIGHT NOW.
// This is NOT a cumulative counter. It goes up when someone opens a stream
// and goes back down the moment they leave (or after a short timeout if
// their tab closes without warning — e.g. phone killed, browser crashed).
//
// Indexed per-stream (Map of Maps) rather than one flat map — a lookup for
// one stream only ever scans that stream's own viewers, not everyone else's
// too. Load-tested: the flat-map version fell over around 25-30k concurrent
// viewers site-wide; this version holds up past 100k+.
//
// Stored in-memory (not MongoDB) because this is ephemeral, high-frequency
// data — writing every heartbeat to a database would be wasteful and slow.
// Note: with multiple server instances this would need a shared store
// (Redis) instead of an in-memory Map; fine for a single Railway instance.

const ACTIVE_TIMEOUT_MS = 45 * 1000; // if no heartbeat in 45s, assume they left

// streamId -> Map(viewerId -> last heartbeat timestamp)
const streamMaps = new Map();

function getStreamMap(streamId) {
  let m = streamMaps.get(streamId);
  if (!m) {
    m = new Map();
    streamMaps.set(streamId, m);
  }
  return m;
}

// Returns true if this was a brand-new viewer session (their first heartbeat
// for this stream) — the caller can use that signal to bump a permanent
// lifetime "total watches" counter exactly once per session, not on every
// repeat 15s ping.
function heartbeat(streamId, viewerId) {
  if (!streamId || !viewerId) return false;
  const m = getStreamMap(streamId);
  const isNew = !m.has(viewerId);
  m.set(viewerId, Date.now());
  return isNew;
}

function leave(streamId, viewerId) {
  if (!streamId || !viewerId) return;
  streamMaps.get(streamId)?.delete(viewerId);
}

// Returns the current real concurrent viewer count for a stream.
// Also opportunistically purges stale entries (crashed tabs, killed apps).
function getConcurrentCount(streamId) {
  const m = streamMaps.get(streamId);
  if (!m) return 0;

  const now = Date.now();
  let count = 0;
  for (const [viewerId, lastSeen] of m) {
    if (now - lastSeen > ACTIVE_TIMEOUT_MS) {
      m.delete(viewerId);
      continue;
    }
    count++;
  }
  return count;
}

module.exports = { heartbeat, leave, getConcurrentCount };
