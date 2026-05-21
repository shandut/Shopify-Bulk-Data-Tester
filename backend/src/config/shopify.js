require('dotenv').config();

const config = {
  shopify: {
    shop: process.env.SHOPIFY_SHOP || "your-shop.myshopify.com",
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || "your-access-token",
    apiVersion: process.env.SHOPIFY_API_VERSION || "2025-07"
  },
  server: {
    port: process.env.PORT || 4000
  },
  cache: {
    inventoryCacheFile: 'inventory_cache.json',
    inventoryCacheDir: '.cache',
    maxAgeMs: 60 * 60 * 1000 // 1 hour
  }
};

// Computed values
config.shopify.graphqlUrl = `https://${config.shopify.shop}/admin/api/${config.shopify.apiVersion}/graphql.json`;
config.shopify.headers = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": config.shopify.accessToken
};

module.exports = config;
