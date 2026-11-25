// Simple cache mechanism to avoid repeated API calls
const dataCache = {
  categories: null,
  products: null,
  news: null,
  dashboardStats: null,
  lastFetch: {
    categories: 0,
    products: 0,
    news: 0,
    dashboardStats: 0
  },
  cacheDuration: 5 * 60 * 1000 // 5 minutes
};

export const getCachedData = (key) => {
  const now = Date.now();
  const lastFetch = dataCache.lastFetch[key];
  
  if (dataCache[key] && (now - lastFetch) < dataCache.cacheDuration) {
    return dataCache[key];
  }
  
  return null;
};

export const setCachedData = (key, data) => {
  dataCache[key] = data;
  dataCache.lastFetch[key] = Date.now();
};

export const clearCache = (key) => {
  if (key) {
    dataCache[key] = null;
    dataCache.lastFetch[key] = 0;
  } else {
    // Clear all cache
    Object.keys(dataCache.lastFetch).forEach(k => {
      dataCache[k] = null;
      dataCache.lastFetch[k] = 0;
    });
  }
};

export const invalidateCache = (key) => {
  clearCache(key);
};
