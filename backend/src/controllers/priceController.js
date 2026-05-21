const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const ShopifyService = require('../services/shopifyService');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

// Get Shopify service instance for the current request
const getShopifyService = (req) => new ShopifyService(req.shopifyConfig);
const getShop = (req) => req.shopifyConfig?.shop;

class PriceController {
  constructor() {
    this.MUTATION_COST = 50; // Approximate cost per productVariantsBulkUpdate
  }

  /**
   * Update prices using individual productVariantsBulkUpdate calls (aggressive parallel)
   */
  async updatePrices(req, res) {
    try {
      logger.info('Price update requested (individual approach)');
      const shopifyService = getShopifyService(req);

      if (!cache.exists(getShop(req))) {
        return res.status(400).json({
          success: false,
          error: 'Inventory cache not found. Please refresh cache first.'
        });
      }

      const products = cache.load(getShop(req));
      let results = [];
      let updatedVariants = 0;
      const globalStart = Date.now();
      let productIdx = 0;
      let throttleStatus = {
        maximumAvailable: 20000,
        currentlyAvailable: 20000,
        restoreRate: 1000
      };

      // Helper to poll throttle status
      const pollThrottle = async () => {
        const throttle = await shopifyService.getThrottleStatus();
        if (throttle) {
          throttleStatus = throttle;
          logger.throttle('PRICE_UPDATE', throttle);
        }
      };

      let prevParallel = 10;
      while (productIdx < products.length) {
        await pollThrottle();

        // Calculate max safe parallelism (use 90% of available points)
        let maxParallel = Math.floor((throttleStatus.currentlyAvailable * 0.9) / this.MUTATION_COST);
        maxParallel = Math.max(1, Math.min(maxParallel, 500)); // Cap to 500 for safety

        if (maxParallel !== prevParallel) {
          logger.info(`Adjusting parallelism from ${prevParallel} to ${maxParallel}`);
          prevParallel = maxParallel;
        }

        const batch = products.slice(productIdx, productIdx + maxParallel);
        const batchStart = Date.now();

        logger.batch('PRICE_UPDATE', productIdx, products.length, batch.length);

        const batchPromises = batch.map(async (product) => {
          if (!product.variants?.edges?.length) return null;

          // Split variants into batches of 250 (Shopify limit)
          const variantEdges = product.variants.edges;
          let variantResults = [];

          for (let i = 0; i < variantEdges.length; i += 250) {
            const variantBatch = variantEdges.slice(i, i + 250).map(edge => ({
              id: edge.node.id,
              price: "100.00"
            }));

            const mutation = `
              mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                  product { id }
                  productVariants { id price }
                  userErrors { field message }
                }
              }
            `;

            const variables = {
              productId: product.id,
              variants: variantBatch
            };

            try {
              const response = await shopifyService.graphql(mutation, variables);
              updatedVariants += variantBatch.length;

              if (response.errors || response.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
                logger.error(`Product ${product.id} errors`, response.errors || response.data.productVariantsBulkUpdate.userErrors);
              }

              variantResults.push({
                productId: product.id,
                variantCount: variantBatch.length,
                response
              });
            } catch (error) {
              logger.error(`Product ${product.id} error`, error.response?.data || error);
              variantResults.push({
                productId: product.id,
                error: error.response?.data || error
              });
            }
          }

          return variantResults;
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.flat().filter(Boolean));

        const batchEnd = Date.now();
        logger.timing(`PRICE_UPDATE_BATCH_${productIdx}`, ((batchEnd - batchStart) / 1000).toFixed(2));

        productIdx += maxParallel;

        // Short delay between batches
        await new Promise(r => setTimeout(r, 50));
      }

      const globalEnd = Date.now();
      const elapsedSeconds = ((globalEnd - globalStart) / 1000).toFixed(2);

      logger.timing('PRICE_UPDATE_TOTAL', elapsedSeconds, `${products.length} products, ${updatedVariants} variants`);

      res.json({
        success: true,
        updatedVariants,
        productCount: products.length,
        elapsedSeconds,
        results
      });
    } catch (error) {
      logger.error('Price update failed', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data
      });
    }
  }

  /**
   * Update prices using bulk operations (ultra-fast)
   */
  async updatePricesBulk(req, res) {
    try {
      logger.info('Bulk price update requested (bulk operations approach)');
      const shopifyService = getShopifyService(req);

      if (!cache.exists(getShop(req))) {
        return res.status(400).json({
          success: false,
          error: 'Inventory cache not found. Please refresh cache first.'
        });
      }

      const products = cache.load(getShop(req));

      // Prepare JSONL with productVariantsBulkUpdate mutations
      let jsonlLines = [];
      for (const product of products) {
        if (product.variants?.edges?.length > 0) {
          // Prepare variants for this product
          const variants = product.variants.edges.map(edge => ({
            id: edge.node.id,
            price: "100.00"
          }));

          // Split into batches of 250 variants per mutation (Shopify limit)
          for (let i = 0; i < variants.length; i += 250) {
            const variantBatch = variants.slice(i, i + 250);
            jsonlLines.push(JSON.stringify({
              productId: product.id,
              variants: variantBatch
            }));
          }
        }
      }

      logger.info(`Generated ${jsonlLines.length} productVariantsBulkUpdate operations`);

      // Write JSONL file
      const jsonlFile = 'bulk_price_updates.jsonl';
      fs.writeFileSync(jsonlFile, jsonlLines.join('\n'));

      // Create staged upload
      const stagedTarget = await shopifyService.createStagedUpload(jsonlFile);
      const upload_url = stagedTarget.url;
      const params = {};
      stagedTarget.parameters.forEach(p => { params[p.name] = p.value; });

      // Upload the JSONL file
      logger.info('Uploading bulk price updates to Shopify');
      const form = new FormData();
      Object.entries(params).forEach(([key, value]) => form.append(key, value));
      form.append('file', fs.createReadStream(jsonlFile));
      await axios.post(upload_url, form, { headers: form.getHeaders() });

      // Start bulk operation
      const key = stagedTarget.parameters.find(p => p.name === 'key').value;
      const bulkMutation = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants { id price }
            userErrors { field message }
          }
        }
      `;

      const bulkOperation = await shopifyService.startBulkOperation(bulkMutation, key);

      // Clean up the JSONL file
      fs.unlinkSync(jsonlFile);

      const totalVariants = products.reduce((sum, p) => sum + (p.variants?.edges?.length || 0), 0);

      logger.info(`Bulk price update started: ${bulkOperation.id} for ${totalVariants} variants`);

      res.json({
        success: true,
        bulkOperationId: bulkOperation.id,
        status: bulkOperation.status,
        variantCount: totalVariants,
        operationCount: jsonlLines.length,
        message: 'Ultra-fast bulk price update started using productVariantsBulkUpdate. Use /bulk-operation-status to check progress.'
      });

    } catch (error) {
      logger.error('Bulk price update failed', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data
      });
    }
  }
}

// Export controller methods individually
module.exports = {
  updatePrices: (req, res) => new PriceController().updatePrices(req, res),
  updatePricesBulk: (req, res) => new PriceController().updatePricesBulk(req, res)
};
