const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const ShopifyService = require('../services/shopifyService');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const getShop = (req) => req.shopifyConfig?.shop;

// Track ongoing operations
let isShuttingDown = false;
let activeOperations = new Set();

// Handle cleanup on exit signals
process.on('SIGINT', async () => {
  logger.info('Received SIGINT (Ctrl+C). Cleaning up...');
  isShuttingDown = true;

  // Wait for active operations to complete (with timeout)
  if (activeOperations.size > 0) {
    logger.info(`Waiting for ${activeOperations.size} operations to complete...`);
    const timeout = setTimeout(() => {
      logger.warn('Forced exit due to timeout waiting for operations');
      process.exit(1);
    }, 5000); // Force exit after 5 seconds

    try {
      // Wait for all active operations to complete
      await Promise.race([
        Promise.all(Array.from(activeOperations)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4900))
      ]);
      clearTimeout(timeout);
      logger.info('All operations completed successfully');
    } catch (error) {
      logger.warn('Some operations did not complete:', error.message);
    }
  }

  process.exit(0);
});

class ProductController {
  /**
   * Create 30,000 dummy products using bulk operations
   */
  async createProducts(req, res) {
    try {
      logger.info('Product creation requested');
      const shopifyService = new ShopifyService(req.shopifyConfig);

      // Generate products.jsonl
      const lines = Array.from({ length: 30000 }, (_, i) => {
        const idx = i + 1;
        return JSON.stringify({
          input: {
            title: `Dummy Product ${idx}`,
            descriptionHtml: `<strong>Dummy description for product ${idx}</strong>`,
            vendor: "DummyVendor",
            productType: "DummyType"
          }
        });
      });

      fs.writeFileSync('products.jsonl', lines.join('\n'));
      logger.info('Generated products.jsonl with 30,000 products');

      // Create staged upload
      const stagedTarget = await shopifyService.createStagedUpload('products.jsonl');
      const upload_url = stagedTarget.url;
      const params = {};
      stagedTarget.parameters.forEach(p => { params[p.name] = p.value; });

      // Upload file
      logger.info('Uploading products.jsonl to Shopify');
      const form = new FormData();
      Object.entries(params).forEach(([key, value]) => form.append(key, value));
      form.append('file', fs.createReadStream('products.jsonl'));
      await axios.post(upload_url, form, { headers: form.getHeaders() });

      // Start bulk operation
      const key = stagedTarget.parameters.find(p => p.name === 'key').value;
      const productCreateMutation = `
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product { id }
            userErrors { field message }
          }
        }
      `;

      const bulkOperation = await shopifyService.startBulkOperation(productCreateMutation, key);
      cache.clear(getShop(req));

      logger.info(`Bulk product creation started: ${bulkOperation.id}`);

      res.json({
        success: true,
        result: bulkOperation,
        message: `Bulk operation started for 30,000 products! ID: ${bulkOperation.id}`
      });
    } catch (error) {
      logger.error('Product creation failed', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create more products starting from the highest existing number
   */
  async createMoreProducts(req, res) {
    try {
      logger.info('Create more products requested');
      const shopifyService = new ShopifyService(req.shopifyConfig);

      // Determine highest Dummy Product number
      let products = [];
      if (cache.exists(getShop(req))) {
        products = cache.load(getShop(req));
      } else {
        products = await shopifyService.fetchAllProducts();
        cache.save(products, getShop(req));
      }

      // Find highest number
      let maxNum = 0;
      for (const p of products) {
        const match = p.title.match(/Dummy Product (\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      const startNum = maxNum + 1;
      const endNum = startNum + 30000 - 1;

      logger.info(`Creating products from ${startNum} to ${endNum}`);

      // Generate new products.jsonl
      const lines = Array.from({ length: 30000 }, (_, i) => {
        const idx = startNum + i;
        return JSON.stringify({
          input: {
            title: `Dummy Product ${idx}`,
            descriptionHtml: `<strong>Dummy description for product ${idx}</strong>`,
            vendor: "DummyVendor",
            productType: "DummyType"
          }
        });
      });

      fs.writeFileSync('products.jsonl', lines.join('\n'));

      // Create and upload
      const stagedTarget = await shopifyService.createStagedUpload('products.jsonl');
      const upload_url = stagedTarget.url;
      const params = {};
      stagedTarget.parameters.forEach(p => { params[p.name] = p.value; });

      const form = new FormData();
      Object.entries(params).forEach(([key, value]) => form.append(key, value));
      form.append('file', fs.createReadStream('products.jsonl'));
      await axios.post(upload_url, form, { headers: form.getHeaders() });

      // Start bulk operation
      const key = stagedTarget.parameters.find(p => p.name === 'key').value;
      const productCreateMutation = `
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product { id }
            userErrors { field message }
          }
        }
      `;

      const bulkOperation = await shopifyService.startBulkOperation(productCreateMutation, key);
      cache.clear(getShop(req));

      res.json({
        success: true,
        result: bulkOperation,
        range: { startNum, endNum },
        message: `Bulk operation started for Dummy Product ${startNum} to ${endNum}!`
      });
    } catch (error) {
      logger.error('Create more products failed', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create 5 dummy products using individual GraphQL mutations
   */
  async createFiveDummyProducts(req, res) {
    try {
      logger.info('Create 5 dummy products requested');
      const shopifyService = new ShopifyService(req.shopifyConfig);

      // Determine highest Dummy Product number
      let products = [];
      if (cache.exists(getShop(req))) {
        products = cache.load(getShop(req));
      } else {
        products = await shopifyService.fetchAllProducts();
        cache.save(products, getShop(req));
      }

      // Find highest number
      let maxNum = 0;
      for (const p of products) {
        const match = p.title.match(/Dummy Product (\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }

      const startNum = maxNum + 1;
      const endNum = startNum + 4; // Create 5 products (startNum to startNum+4)

      logger.info(`Creating 5 products from ${startNum} to ${endNum}`);

      const results = [];
      const errors = [];

      // Create products one by one using individual GraphQL mutations
      for (let i = 0; i < 5; i++) {
        const productNum = startNum + i;

        const mutation = `
          mutation {
            productCreate(input: {
              title: "Dummy Product ${productNum}",
              descriptionHtml: "<strong>Dummy description for product ${productNum}</strong>",
              vendor: "DummyVendor",
              productType: "DummyType",
              status: ACTIVE
            }) {
              product {
                id
                title
                handle
                status
                createdAt
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        try {
          const response = await shopifyService.graphql(mutation);

          if (response.data?.productCreate?.userErrors?.length > 0) {
            const userErrors = response.data.productCreate.userErrors;
            logger.error(`Product ${productNum} creation errors:`, userErrors);
            errors.push({ productNum, errors: userErrors });
          } else if (response.data?.productCreate?.product) {
            const product = response.data.productCreate.product;
            logger.info(`Successfully created product ${productNum}: ${product.id}`);
            results.push({ productNum, product });
          } else {
            logger.error(`Unexpected response for product ${productNum}:`, response);
            errors.push({ productNum, error: 'Unexpected response format' });
          }
        } catch (error) {
          logger.error(`Failed to create product ${productNum}:`, error);
          errors.push({ productNum, error: error.message });
        }

        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (results.length > 0) {
        cache.clear(getShop(req));
      }

      res.json({
        success: true,
        message: `Created ${results.length} out of 5 dummy products (${startNum} to ${endNum})`,
        results,
        errors,
        range: { startNum, endNum: startNum + 4 },
        summary: {
          successful: results.length,
          failed: errors.length,
          total: 5
        }
      });
    } catch (error) {
      logger.error('Create 5 dummy products failed', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create multiple products concurrently with rate limiting
   * @param {number} count - Number of products to create
   */
  async createMultipleProducts(req, res) {
    const operationPromise = (async () => {
      try {
        if (isShuttingDown) {
          throw new Error('Server is shutting down');
        }

        const count = parseInt(req.query.count || '5000');
        logger.info(`Creating ${count} products concurrently with rate limiting`);
        const shopifyService = new ShopifyService(req.shopifyConfig);

        // Determine highest Dummy Product number by fetching all products
        logger.info('Fetching existing products to determine next product number...');
        let products = [];
        let highestProductNumber = 0;

        // First try to get from cache
        if (cache.exists(getShop(req))) {
          logger.info('Using cached products list');
          products = cache.load(getShop(req));
        }

        // If cache is empty or products array is empty, fetch from API
        if (!products || products.length === 0) {
          logger.info('Cache empty or invalid, fetching all products from Shopify');
          products = await shopifyService.fetchAllProducts();
          // Update cache with new products
          if (products && products.length > 0) {
            cache.save(products, getShop(req));
          }
        }

        // Find highest number with improved logging
        logger.info(`Processing ${products.length} products to find highest number`);
        for (const p of products) {
          if (p.title) {
            const match = p.title.match(/Dummy Product (\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > highestProductNumber) {
                highestProductNumber = num;
              }
            }
          }
        }

        logger.info(`Highest existing product number found: ${highestProductNumber}`);
        const startNum = highestProductNumber + 1;
        const endNum = startNum + count - 1;

        logger.info(`Will create new products from ${startNum} to ${endNum}`);

        // Get initial throttle status to determine optimal batch size
        const initialThrottle = await shopifyService.getThrottleStatus();
        // Use 90% of currently available points as our batch size, minimum 100
        const BATCH_SIZE = Math.max(100, Math.floor(initialThrottle.currentlyAvailable * 0.90));
        logger.info(`Using batch size of ${BATCH_SIZE} based on available points: ${initialThrottle.currentlyAvailable}`);

        // Create batches of products
        const batches = [];
        for (let i = 0; i < count; i += BATCH_SIZE) {
          const batchProducts = [];
          const batchEnd = Math.min(i + BATCH_SIZE, count);
          for (let j = i; j < batchEnd; j++) {
            batchProducts.push(startNum + j);
          }
          batches.push(batchProducts);
        }

        logger.info(`Split into ${batches.length} batches of up to ${BATCH_SIZE} products each`);

        const results = [];
        const errors = [];
        let successCount = 0;
        let currentBatch = 0;
        const startTime = Date.now();

        // Process batches with rate limiting
        for (const batch of batches) {
          if (isShuttingDown) {
            logger.info('Shutdown signal received, stopping batch processing');
            break;
          }

          currentBatch++;
          const batchStartTime = Date.now();

          logger.info(`Processing batch ${currentBatch}/${batches.length} (${batch.length} products)`);

          // Check throttle status before processing batch
          const preThrottleStatus = await shopifyService.getThrottleStatus();
          if (preThrottleStatus) {
            // Only wait if we have less than 10% of the points needed
            const minimumPointsNeeded = Math.floor(batch.length * 0.10);
            if (preThrottleStatus.currentlyAvailable < minimumPointsNeeded) {
              const pointsNeeded = batch.length - preThrottleStatus.currentlyAvailable;
              const waitTime = Math.ceil((pointsNeeded / preThrottleStatus.restoreRate) * 1000);
              logger.info(`Points too low (${preThrottleStatus.currentlyAvailable}), waiting ${waitTime}ms for ${pointsNeeded} points`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }

          // Split batch into smaller chunks for better concurrency control
          const CHUNK_SIZE = 10; // Process 10 promises at a time to avoid memory issues
          const chunks = [];
          for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
            chunks.push(batch.slice(i, i + CHUNK_SIZE));
          }

          // Process each chunk of the batch
          for (const chunk of chunks) {
            const chunkPromises = chunk.map(async (productNum) => {
              const mutation = `
                mutation {
                  productCreate(input: {
                    title: "Dummy Product ${productNum}",
                    descriptionHtml: "<strong>Dummy description for product ${productNum}</strong>",
                    vendor: "DummyVendor",
                    productType: "DummyType",
                    status: ACTIVE
                  }) {
                    product {
                      id
                      title
                      handle
                      status
                      createdAt
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `;

              try {
                const response = await shopifyService.graphql(mutation);

                if (response.data?.productCreate?.userErrors?.length > 0) {
                  const userErrors = response.data.productCreate.userErrors;
                  logger.error(`Product ${productNum} creation errors:`, userErrors);
                  errors.push({ productNum, errors: userErrors });
                  return null;
                } else if (response.data?.productCreate?.product) {
                  const product = response.data.productCreate.product;
                  successCount++;

                  // Only log every 250 products to reduce log noise
                  if (successCount % 250 === 0) {
                    logger.info(`Progress: ${successCount}/${count} products created (${((successCount/count)*100).toFixed(1)}%)`);
                  }
                  return { productNum, product };
                } else {
                  logger.error(`Unexpected response for product ${productNum}:`, response);
                  errors.push({ productNum, error: 'Unexpected response format' });
                  return null;
                }
              } catch (error) {
                logger.error(`Failed to create product ${productNum}:`, error);
                errors.push({ productNum, error: error.message });
                return null;
              }
            });

            // Wait for current chunk to complete
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults.filter(Boolean));
          }

          const batchEndTime = Date.now();
          const batchDuration = (batchEndTime - batchStartTime) / 1000;
          const batchSuccessRate = (results.length / batch.length) * 100;
          const overallProgress = (successCount / count) * 100;

          logger.info(
            `Batch ${currentBatch}/${batches.length} completed in ${batchDuration.toFixed(2)}s ` +
            `(${batchSuccessRate.toFixed(1)}% success rate, ${overallProgress.toFixed(1)}% total progress)`
          );

          // Check throttle status after batch
          const postThrottleStatus = await shopifyService.getThrottleStatus();
          if (postThrottleStatus) {
            logger.info(`Available points after batch: ${postThrottleStatus.currentlyAvailable}`);

            // Only wait if we're critically low on points (less than 2% of maximum)
            if (postThrottleStatus.currentlyAvailable < (postThrottleStatus.maximumAvailable * 0.02)) {
              const restoreTarget = postThrottleStatus.maximumAvailable * 0.10; // Wait until 10% restored
              const pointsToRestore = restoreTarget - postThrottleStatus.currentlyAvailable;
              const waitTime = Math.ceil((pointsToRestore / postThrottleStatus.restoreRate) * 1000);
              logger.info(`Points critically low, waiting ${waitTime}ms for ${pointsToRestore} points to restore`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }

        const endTime = Date.now();
        const totalDuration = (endTime - startTime) / 1000;
        const avgTimePerProduct = totalDuration / successCount;
        const successRate = (successCount / count) * 100;
        const throughput = successCount / totalDuration;

        logger.info(`Product creation completed in ${totalDuration.toFixed(2)}s`);
        logger.info(`Success rate: ${successRate.toFixed(1)}%`);
        logger.info(`Average time per product: ${avgTimePerProduct.toFixed(3)}s`);
        logger.info(`Throughput: ${throughput.toFixed(1)} products/second`);
        if (successCount > 0) {
          cache.clear(getShop(req));
        }

        res.json({
          success: true,
          message: `Created ${successCount} out of ${count} products (${startNum} to ${endNum})`,
          results,
          errors,
          range: { startNum, endNum },
          summary: {
            successful: successCount,
            failed: errors.length,
            total: count,
            totalTimeSeconds: totalDuration,
            averageTimePerProductSeconds: avgTimePerProduct,
            successRate: successRate,
            throughput: throughput,
            batches: batches.length,
            batchSize: BATCH_SIZE
          },
          performance: {
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            durationSeconds: totalDuration
          }
        });
      } catch (error) {
        logger.error('Create multiple products failed', error);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    })();

    // Track this operation
    activeOperations.add(operationPromise);
    operationPromise.finally(() => {
      activeOperations.delete(operationPromise);
    });
  }

  /**
   * Get bulk operation status
   */
  async getBulkOperationStatus(req, res) {
    try {
      const shopifyService = new ShopifyService(req.shopifyConfig);
      const status = await shopifyService.getBulkOperationStatus();
      res.json(status || { status: 'No current bulk operation' });
    } catch (error) {
      logger.error('Get bulk operation status failed', error);
      res.status(500).json({
        error: error.message,
        details: error.response?.data
      });
    }
  }

  /**
   * Get shop information
   */
  async getShopInfo(req, res) {
    try {
      const shopifyService = new ShopifyService(req.shopifyConfig);
      const shopInfo = await shopifyService.getShopInfo();
      res.json({
        success: true,
        shop: shopInfo
      });
    } catch (error) {
      logger.error('Get shop info failed', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data
      });
    }
  }

  /**
   * Delete all products with "dummy" in handle or title - ULTRA FAST VERSION
   */
  async deleteDummyProducts(req, res) {
    try {
      logger.info('Delete dummy products requested (ULTRA FAST MODE)');

      // Create ShopifyService instance from request
      const shopifyService = new ShopifyService(req.shopifyConfig);

      // First, fetch all products to find the ones with "dummy"
      const allProducts = await shopifyService.fetchAllProducts();

      // Filter products that have "dummy" in handle or title (case-insensitive)
      const dummyProducts = allProducts.filter(product => {
        const title = product.title?.toLowerCase() || '';
        const handle = product.handle?.toLowerCase() || '';
        const hasDummy = title.includes('dummy') || handle.includes('dummy');

        if (hasDummy) {
          logger.info(`Found dummy product: "${product.title}" (handle: ${product.handle}, id: ${product.id})`);
        }

        return hasDummy;
      });

      logger.info(`Filter complete. Found ${dummyProducts.length} dummy products out of ${allProducts.length} total products`);

      if (dummyProducts.length === 0) {
        logger.warn(`NO DUMMY PRODUCTS FOUND! Searched ${allProducts.length} products but none had "dummy" in title or handle`);
        return res.json({
          success: true,
          message: `No dummy products found to delete (searched ${allProducts.length} products)`,
          deletedCount: 0,
          totalSearched: allProducts.length
        });
      }

      logger.info(`Found ${dummyProducts.length} dummy products to delete:`);
      dummyProducts.forEach((p, idx) => {
        logger.info(`  ${idx + 1}. "${p.title}" (handle: ${p.handle})`);
      });

      // Extract product IDs
      const productIds = dummyProducts.map(p => p.id);

      // Track results
      let results = [];
      let processedCount = 0;
      const startTime = Date.now();
      const DELETE_COST = 10; // Approximate cost per delete mutation

      // Process deletions with dynamic parallelism
      let productIdx = 0;
      while (productIdx < productIds.length) {
        // Get current throttle status
        const throttle = await shopifyService.getThrottleStatus();
        if (!throttle) {
          logger.warn('Could not get throttle status, using conservative approach');
          // Fall back to conservative batch size if we can't get throttle status
          const conservativeBatch = productIds.slice(productIdx, productIdx + 10);
          const batchResults = await this.deleteProductBatch(conservativeBatch, productIdx, productIds.length, shopifyService);
          results.push(...batchResults);
          productIdx += conservativeBatch.length;
          continue;
        }

        logger.throttle('DELETE_DUMMY', throttle);

        // Calculate how many deletes we can do in parallel
        // Use 90% of available points to leave some buffer
        const availablePoints = Math.floor(throttle.currentlyAvailable * 0.9);
        const maxParallel = Math.max(1, Math.floor(availablePoints / DELETE_COST));

        // Cap at a reasonable maximum to avoid overwhelming the system
        const parallelDeletes = Math.min(maxParallel, 200, productIds.length - productIdx);

        logger.info(`[DELETE_DUMMY] Processing batch: ${productIdx}-${productIdx + parallelDeletes} of ${productIds.length} (${parallelDeletes} parallel deletes, ${availablePoints} points available)`);

        // Get the batch of products to delete
        const batch = productIds.slice(productIdx, productIdx + parallelDeletes);

        // Create delete promises for this batch
        const deletePromises = batch.map((productId, idx) => {
          const mutation = `
            mutation productDelete($input: ProductDeleteInput!) {
              productDelete(input: $input) {
                deletedProductId
                userErrors {
                  field
                  message
                }
              }
            }
          `;

          const variables = {
            input: {
              id: productId
            }
          };

          const itemNumber = productIdx + idx + 1;

          return shopifyService.graphql(mutation, variables)
            .then(response => {
              if (response.data?.productDelete?.userErrors?.length > 0) {
                logger.error(`❌ FAILED to delete product ${itemNumber}/${productIds.length} (${productId}):`, response.data.productDelete.userErrors);
                return { productId, error: response.data.productDelete.userErrors };
              }

              const deletedId = response.data?.productDelete?.deletedProductId;
              if (deletedId) {
                logger.info(`✅ SUCCESSFULLY deleted product ${itemNumber}/${productIds.length}: ${deletedId}`);
              } else {
                logger.warn(`⚠️ Delete response for ${itemNumber}/${productIds.length} missing deletedProductId`);
              }

              return { productId, success: true, deletedId };
            })
            .catch(error => {
              logger.error(`Delete product ${itemNumber}/${productIds.length} failed:`, error.response?.data || error);
              return { productId, error: error.message };
            });
        });

        // Execute all deletes in this batch in parallel
        const batchResults = await Promise.all(deletePromises);
        results.push(...batchResults);
        processedCount += batch.length;

        // Update index for next batch
        productIdx += parallelDeletes;

        // Log progress
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        const rate = (processedCount / elapsed).toFixed(1);
        logger.info(`[DELETE_DUMMY] Progress: ${processedCount}/${productIds.length} deleted in ${elapsed}s (${rate} products/sec)`);

        // Small delay between batches to avoid rate limit issues
        if (productIdx < productIds.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }

      // Calculate final results
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => r.error).length;
      const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
      const deleteRate = (successCount / elapsedSeconds).toFixed(1);

      logger.info(`Delete operation completed in ${elapsedSeconds}s: ${successCount} succeeded, ${failedCount} failed (${deleteRate} products/sec)`);

      // Get details of deleted products for response
      const deletedProducts = dummyProducts
        .filter(p => results.find(r => r.productId === p.id && r.success))
        .map(p => ({ id: p.id, title: p.title, handle: p.handle }));

      if (successCount > 0) {
        cache.clear(getShop(req));
      }

      res.json({
        success: true,
        message: `🚀 ULTRA FAST: Deleted ${successCount} dummy products in ${elapsedSeconds} seconds (${deleteRate} products/sec)`,
        deletedCount: successCount,
        failedCount,
        totalFound: dummyProducts.length,
        deletedProducts: deletedProducts.slice(0, 10), // Only return first 10 to avoid huge response
        elapsedSeconds,
        deleteRate: `${deleteRate} products/sec`,
        summary: {
          total: productIds.length,
          deleted: successCount,
          failed: failedCount,
          seconds: elapsedSeconds,
          rate: deleteRate
        }
      });

    } catch (error) {
      logger.error('Delete dummy products failed', error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.response?.data
      });
    }
  }

  /**
   * Helper method to delete a batch of products
   */
  async deleteProductBatch(productIds, startIdx, totalCount, shopifyService) {
    const deletePromises = productIds.map((productId, idx) => {
      const mutation = `
        mutation productDelete($input: ProductDeleteInput!) {
          productDelete(input: $input) {
            deletedProductId
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          id: productId
        }
      };

      const itemNumber = startIdx + idx + 1;

      return shopifyService.graphql(mutation, variables)
        .then(response => {
          if (response.data?.productDelete?.userErrors?.length > 0) {
            logger.error(`❌ FAILED to delete product ${itemNumber}/${totalCount} (${productId}):`, response.data.productDelete.userErrors);
            return { productId, error: response.data.productDelete.userErrors };
          }

          const deletedId = response.data?.productDelete?.deletedProductId;
          if (deletedId) {
            logger.info(`✅ SUCCESSFULLY deleted product ${itemNumber}/${totalCount}: ${deletedId}`);
          } else {
            logger.warn(`⚠️ Delete response for ${itemNumber}/${totalCount} missing deletedProductId`);
          }

          return { productId, success: true, deletedId };
        })
        .catch(error => {
          logger.error(`Delete product ${itemNumber}/${totalCount} failed:`, error.response?.data || error);
          return { productId, error: error.message };
        });
    });

    return Promise.all(deletePromises);
  }
}

module.exports = new ProductController();
