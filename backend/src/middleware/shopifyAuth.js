const logger = require('../utils/logger');

const formatStoreUrl = (url) => {
  // Remove any protocol prefix if present
  let formattedUrl = url.replace(/^https?:\/\//, '');
  
  // Add .myshopify.com if not present
  if (!formattedUrl.includes('.myshopify.com')) {
    formattedUrl = `${formattedUrl}.myshopify.com`;
  }
  
  return formattedUrl;
};

const shopifyAuth = (req, res, next) => {
  const accessToken = req.headers['x-shopify-access-token'];
  const storeUrl = req.headers['x-shopify-store-url'];

  if (!accessToken || !storeUrl) {
    logger.error('Missing required Shopify headers', {
      hasAccessToken: !!accessToken,
      hasStoreUrl: !!storeUrl
    });
    return res.status(401).json({ 
      error: 'Missing required Shopify authentication headers' 
    });
  }

  const formattedStoreUrl = formatStoreUrl(storeUrl);
  
  // Add Shopify config to the request object
  req.shopifyConfig = {
    shop: formattedStoreUrl,
    accessToken: accessToken,
    apiVersion: process.env.SHOPIFY_API_VERSION || "2025-07",
    graphqlUrl: `https://${formattedStoreUrl}/admin/api/${process.env.SHOPIFY_API_VERSION || "2025-07"}/graphql.json`,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    }
  };

  next();
};

module.exports = shopifyAuth; 