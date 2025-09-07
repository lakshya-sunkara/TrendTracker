const axios = require("axios");

async function fetchCountryStats(keyword, apiKey) {
  const countries = ["IN", "US", "GB", "CA", "AU"];
  const publishedAfter = new Date(Date.now() - 24*60*60*1000).toISOString();
  const results = [];

  for (const country of countries) {
    let totalCount = 0;
    let nextPageToken = null;

    try {
      do {
        const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: {
            key: apiKey,
            part: "snippet",
            type: "video",
            q: keyword,
            maxResults: 50,
            publishedAfter,
            regionCode: country,
            pageToken: nextPageToken
          }
        });

        totalCount += res.data.items.length;
        nextPageToken = res.data.nextPageToken;
      } while (nextPageToken);

      results.push({ country, videoCount: totalCount });
    } catch (err) {
      console.error(`Error fetching for ${country}:`, err.message);
      results.push({ country, videoCount: 0 });
    }
  }

  return results;
}

module.exports = { fetchCountryStats };
