const cache = require('../utils/cache');
const logger = require('../utils/logger');

class InventoryService {
  constructor() {
    this.BATCH_SIZE = 250; // Max items per batch
    this.MAX_ALIASES = 100; // Shopify's mutation alias limit
  }

  /**
   * Generate random quantity between 1 and 2000
   */
  generateRandomQuantity() {
    return Math.floor(Math.random() * 2000) + 1;
  }

  /**
   * Prepare inventory items for quantity updates
   */
  prepareInventoryItems(products, locationId) {
    return products.flatMap(product =>
      product.variants.edges.map(variantEdge => ({
        inventoryItemId: variantEdge.node.inventoryItem.id,
        locationId,
        quantity: this.generateRandomQuantity()
      }))
    );
  }

  /**
   * Enable tracking for inventory items in parallel batches
   */
  async enableTracking(products, shopifyService) {
    const startTime = Date.now();
    logger.info('Starting inventory tracking enablement');

    const inventoryItems = products.flatMap(product =>
      product.variants.edges.map(variantEdge => ({
        inventoryItemId: variantEdge.node.inventoryItem.id
      }))
    );

    let results = [];
    let enableBatchIndex = 0;
    let availableQueryCost = 20000;
    let stuckRetries = 0;
    const MAX_STUCK_RETRIES = 120;
    let enableItems = [...inventoryItems];

    while (enableItems.length > 0) {
      let maxBatchSize = Math.min(this.MAX_ALIASES, enableItems.length);
      let maxBatches = Math.floor(availableQueryCost / (maxBatchSize * 10));

      if (maxBatchSize === 0 || maxBatches === 0) {
        stuckRetries++;
        if (stuckRetries > MAX_STUCK_RETRIES) {
          throw new Error('Stuck waiting for query cost to restore. Aborting.');
        }

        logger.warn(`Not enough query cost. Current: ${availableQueryCost}, Needed: ${maxBatchSize * 10}. Waiting...`);
        
        const throttle = await shopifyService.getThrottleStatus();
        if (throttle) {
          availableQueryCost = throttle.currentlyAvailable;
        }
        
        await new Promise(r => setTimeout(r, 500));
        continue;
      } else {
        stuckRetries = 0;
      }

      const batchPromises = [];
      const batchesThisRound = Math.min(maxBatches, Math.ceil(enableItems.length / maxBatchSize));

      for (let b = 0; b < batchesThisRound; b++) {
        const batch = enableItems.slice(b * maxBatchSize, (b + 1) * maxBatchSize);
        
        const mutationParts = batch.map((item, idx) => 
          `t${idx}: inventoryItemUpdate(id: "${item.inventoryItemId}", input: {tracked: true}) { 
            inventoryItem { id tracked } 
            userErrors { message } 
          }`
        );

        const enableTrackingMutation = `mutation {\n${mutationParts.join('\n')}\n}`;
        
        batchPromises.push(
          shopifyService.graphql(enableTrackingMutation)
            .then(response => {
              if (response.extensions?.cost?.throttleStatus) {
                availableQueryCost = response.extensions.cost.throttleStatus.currentlyAvailable;
              }
              
              if (response.data) {
                Object.entries(response.data).forEach(([alias, mutationResult]) => {
                  if (mutationResult.userErrors?.length > 0) {
                    logger.error(`Batch ${enableBatchIndex} alias ${alias} userErrors`, mutationResult.userErrors);
                  }
                });
              }
              
              return { batch: enableBatchIndex, response };
            })
            .catch(error => {
              logger.error(`Batch ${enableBatchIndex} request error`, error.response?.data || error);
              return { batch: enableBatchIndex, error };
            })
        );
        
        enableBatchIndex++;
      }

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      enableItems = enableItems.slice(batchesThisRound * maxBatchSize);
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.timing('ENABLE_TRACKING', elapsedSeconds, `${inventoryItems.length} items`);
    
    return { results, elapsedSeconds };
  }

  /**
   * Update inventory quantities using setOnHandQuantities
   */
  async updateOnHandQuantities(products, locationId, shopifyService) {
    const startTime = Date.now();
    logger.info('Starting on-hand quantity updates');

    const allSetQuantities = this.prepareInventoryItems(products, locationId);
    const batches = this.createBatches(allSetQuantities);

    const qtyPromises = batches.map((batch, idx) => {
      const mutation = `
        mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
          inventorySetOnHandQuantities(input: $input) {
            userErrors { field message }
          }
        }
      `;
      
      const variables = {
        input: {
          reason: "correction",
          setQuantities: batch
        }
      };

      logger.batch('SET_ONHAND', idx, batches.length, batch.length);

      return shopifyService.graphql(mutation, variables)
        .then(response => {
          if (response.data?.inventorySetOnHandQuantities?.userErrors?.length > 0) {
            logger.error(`Batch ${idx} userErrors`, response.data.inventorySetOnHandQuantities.userErrors);
          }
          return { batch: idx, response };
        })
        .catch(error => {
          logger.error(`Batch ${idx} request error`, error.response?.data || error);
          return { batch: idx, error };
        });
    });

    const results = await Promise.all(qtyPromises);
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logger.timing('UPDATE_ONHAND', elapsedSeconds, `${allSetQuantities.length} items`);
    
    return {
      results,
      elapsedSeconds,
      updatedCount: allSetQuantities.length
    };
  }

  /**
   * Set available quantities with aggressive parallel processing
   */
  async setAvailableQuantities(products, locationId, shopifyService) {
    const startTime = Date.now();
    logger.info('Starting available quantity updates');

    const quantities = this.prepareInventoryItems(products, locationId);
    const batches = this.createBatches(quantities);

    // Aggressive parallel processing - send all batches at once
    const qtyPromises = batches.map((batch, idx) => {
      const mutation = `
        mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
          inventorySetQuantities(input: $input) {
            inventoryAdjustmentGroup { createdAt reason }
            userErrors { field message }
          }
        }
      `;
      
      const variables = {
        input: {
          reason: "correction",
          setQuantities: batch
        }
      };

      logger.batch('SET_AVAILABLE', idx, batches.length, batch.length);

      return shopifyService.graphql(mutation, variables)
        .then(response => {
          if (response.data?.inventorySetQuantities?.userErrors?.length > 0) {
            logger.error(`Batch ${idx} userErrors`, response.data.inventorySetQuantities.userErrors);
          }
          return { batch: idx, response };
        })
        .catch(error => {
          logger.error(`Batch ${idx} request error`, error.response?.data || error);
          return { batch: idx, error };
        });
    });

    // Wait for all batches to complete in parallel
    const results = await Promise.all(qtyPromises);
    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logger.timing('SET_AVAILABLE', elapsedSeconds, `${quantities.length} items`);
    
    return {
      results,
      elapsedSeconds,
      updatedCount: quantities.length
    };
  }

  /**
   * Create batches of items
   */
  createBatches(items) {
    const batches = [];
    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      batches.push(items.slice(i, i + this.BATCH_SIZE));
    }
    return batches;
  }

  /**
   * Full inventory update (enable tracking + update quantities)
   */
  async fullInventoryUpdate(shopifyService) {
    logger.info('Starting full inventory update');
    
    let products;
    if (cache.exists()) {
      products = cache.load();
    } else {
      products = await shopifyService.fetchAllProducts();
      cache.save(products);
    }

    const locationId = await shopifyService.getFirstLocationId();
    
    // Enable tracking first
    const trackingResult = await this.enableTracking(products, shopifyService);
    
    // Then update quantities
    const quantityResult = await this.updateOnHandQuantities(products, locationId, shopifyService);
    
    return {
      tracking: trackingResult,
      quantities: quantityResult
    };
  }
}

module.exports = new InventoryService(); 