const fs = require('fs');
const path = require('path');
const config = require('../config/shopify');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.cacheFile = config.cache.inventoryCacheFile;
    this.cacheDir = config.cache.inventoryCacheDir;
    this.maxAge = config.cache.maxAgeMs;
  }

  sanitizeShop(shop) {
    return String(shop || '')
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/[^a-z0-9.-]/g, '_');
  }

  getCacheFile(shop) {
    if (!shop) {
      return this.cacheFile;
    }

    const safeShop = this.sanitizeShop(shop);
    return path.join(this.cacheDir, `inventory_cache_${safeShop}.json`);
  }

  ensureCacheDir(shop) {
    if (shop && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Check if cache exists and is not expired
   */
  isValid(shop = null) {
    const cacheFile = this.getCacheFile(shop);
    if (!fs.existsSync(cacheFile)) {
      return false;
    }

    const stats = fs.statSync(cacheFile);
    const age = Date.now() - stats.mtimeMs;
    return age < this.maxAge;
  }

  /**
   * Get cache age in minutes
   */
  getAge(shop = null) {
    const cacheFile = this.getCacheFile(shop);
    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    const stats = fs.statSync(cacheFile);
    const ageMs = Date.now() - stats.mtimeMs;
    return (ageMs / 1000 / 60).toFixed(1);
  }

  getStatus(shop = null) {
    const cacheFile = this.getCacheFile(shop);
    const exists = fs.existsSync(cacheFile);
    let count = null;

    if (exists) {
      try {
        const products = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        count = Array.isArray(products) ? products.length : null;
      } catch (error) {
        logger.warn(`Unable to read cache status for ${cacheFile}: ${error.message}`);
      }
    }

    return {
      exists,
      valid: exists ? this.isValid(shop) : false,
      ageMinutes: exists ? this.getAge(shop) : null,
      count,
      shop: shop || null,
      file: cacheFile
    };
  }

  /**
   * Load products from cache
   */
  load(shop = null) {
    try {
      const cacheFile = this.getCacheFile(shop);
      if (!fs.existsSync(cacheFile)) {
        throw new Error('Cache file not found');
      }

      const products = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      const age = this.getAge(shop);
      logger.info(`Cache loaded for ${shop || 'default'}: ${products.length} products (age: ${age} min)`);
      return products;
    } catch (error) {
      logger.error('Error loading cache', error);
      throw error;
    }
  }

  /**
   * Save products to cache
   */
  save(products, shop = null) {
    try {
      this.ensureCacheDir(shop);
      const cacheFile = this.getCacheFile(shop);
      fs.writeFileSync(cacheFile, JSON.stringify(products, null, 2));
      logger.info(`Cache saved for ${shop || 'default'}: ${products.length} products`);
      return products.length;
    } catch (error) {
      logger.error('Error saving cache', error);
      throw error;
    }
  }

  /**
   * Check if cache exists
   */
  exists(shop = null) {
    return fs.existsSync(this.getCacheFile(shop));
  }

  /**
   * Clear cache
   */
  clear(shop = null) {
    try {
      const cacheFile = this.getCacheFile(shop);
      if (fs.existsSync(cacheFile)) {
        fs.unlinkSync(cacheFile);
        logger.info(`Cache cleared for ${shop || 'default'}`);
      }
    } catch (error) {
      logger.error('Error clearing cache', error);
      throw error;
    }
  }
}

module.exports = new CacheManager();
