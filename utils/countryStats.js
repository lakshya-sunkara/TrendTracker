const axios = require("axios");

async function fetchCountryStats(keyword, apiKey) {
  // ISO 2-letter country codes (safe set – supported by YouTube API)
  const countries = [
    "US", "IN", "GB", "CA", "AU",
    "DE", "FR", "BR", "RU", "JP",
    "KR", "IT", "ES", "MX", "ZA",
    "NG", "SA", "AE", "SG", "ID"
  ];

  const results = [];

  for (const country of countries) {
    try {
      // Instead of search (which fails for some countries),
      // we use videos.list with chart=mostPopular
      const res = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params: {
          key: apiKey,
          part: "id",
          chart: "mostPopular",
          regionCode: country,
          maxResults: 50
        }
      });

      results.push({
        country,
        videoCount: res.data.items.length
      });
    } catch (err) {
      if (err.response && err.response.status === 403) {
        console.warn(`⚠️ RegionCode ${country} not supported, skipping...`);
      } else {
        console.error(`❌ Error fetching for ${country}:`, err.message);
      }
      results.push({ country, videoCount: 0 });
    }
  }

  return results;
}

module.exports = { fetchCountryStats };
