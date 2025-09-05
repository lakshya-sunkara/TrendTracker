const axios = require("axios");

async function fetchYouTubeStats(keyword, apiKey) {
  const publishedAfter = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let videoCount = 0, totalViews = 0, totalLikes = 0, totalComments = 0;
  let nextPageToken = null;

  do {
    const search = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        key: apiKey,
        part: "snippet",
        type: "video",
        q: keyword,
        maxResults: 50, // max allowed
        publishedAfter,
        pageToken: nextPageToken || ""
      }
    });

    const ids = search.data.items.map(v => v.id.videoId).filter(Boolean);
    videoCount += ids.length;

    if (ids.length) {
      const stats = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: {
          key: apiKey,
          part: "statistics",
          id: ids.join(",")
        }
      });

      for (const v of stats.data.items) {
        const s = v.statistics || {};
        totalViews += parseInt(s.viewCount || 0, 10);
        totalLikes += parseInt(s.likeCount || 0, 10);
        totalComments += parseInt(s.commentCount || 0, 10);
      }
    }

    nextPageToken = search.data.nextPageToken;
  } while (nextPageToken);

  return { videoCount, totalViews, totalLikes, totalComments };
}


module.exports = { fetchYouTubeStats };
