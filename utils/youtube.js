// utils/youtube.js
// Fetches the REAL number of people currently watching a live broadcast on YouTube.
//
// This ONLY returns concurrentViewers (live, right-now viewer count).
// It deliberately does NOT fall back to total/lifetime view count —
// if a video isn't currently live on YouTube, this returns 0.
//
// Results are cached in-memory for CACHE_TTL_MS. Because the client polls
// /api/streams/:id/views every 20s and this cache sits in front of that,
// concurrent viewers of the same stream from many users still only cost
// one real API call per cache window (videos.list = 1 quota unit).

const CACHE_TTL_MS = 30 * 1000; // 30 seconds — live counts should feel fresh
const cache = new Map(); // videoId -> { data, expires }

async function fetchLiveViewers(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !videoId) return 0;

  const cached = cache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.data;

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`;
    const res = await fetch(url);
    const json = await res.json();

    const item = json.items?.[0];
    // concurrentViewers only exists while a video is actively broadcasting live.
    // If it's absent (video ended, is a VOD, or isn't live right now), return 0 —
    // we never substitute total view count here.
    const concurrent = item?.liveStreamingDetails?.concurrentViewers;
    const liveViewers = concurrent != null ? Number(concurrent) : 0;

    cache.set(videoId, { data: liveViewers, expires: Date.now() + CACHE_TTL_MS });
    return liveViewers;
  } catch (err) {
    console.error('YouTube API error:', err.message);
    return 0;
  }
}

module.exports = { fetchLiveViewers };
