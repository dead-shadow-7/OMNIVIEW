const API_CONFIG = {
  BASE_URL: "http://localhost:5000",
  ENDPOINTS: {
    ROAD_DETECTION: "/api/road-detection",
    FLIGHTS: "/api/flights",
    BUILDINGS: "/api/buildings",
    WATER_BODIES: "/api/water-bodies",
    SHIPS: "/api/ships",
    EXTRACT_ROADS: "/api/extract_roads",
    NEWS: "/api/news",
    NEWS_BRIEF: "/api/news_brief",
    GENERATE_REPORT: "/api/generate_report",
    DISASTER_CSV: "/api/disaster-csv",
    ANALYZE_DISASTERS: "/api/analyze-disasters",
    LANDCOVER: "/api/landcover",
    GLACIAL_LAKE_CHANGE: "/api/glacial-lake-change",
  },

  // Helper method to get full URL
  getUrl(endpoint) {
    return this.BASE_URL + this.ENDPOINTS[endpoint];
  },
};

// Export for use in other files
  // Also expose as a global so renderer scripts that expect a global `API_CONFIG`
  // (loaded via <script> tags) will work without changes.
  if (typeof globalThis !== "undefined") {
    try {
      globalThis.API_CONFIG = API_CONFIG;
    } catch (e) {
      // ignore in environments that disallow global assignment
    }
  }

  // Keep CommonJS export for contexts that use require/module.exports
  if (typeof module !== "undefined" && module.exports) {
    module.exports = API_CONFIG;
  }
