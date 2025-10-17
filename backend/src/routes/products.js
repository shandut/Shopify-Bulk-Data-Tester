const express = require('express');
const productController = require('../controllers/productController');
const ShopifyService = require('../services/shopifyService');
const logger = require('../utils/logger');

const router = express.Router();

// Create a new Shopify service instance for each request using the config from middleware
const getShopifyService = (req) => new ShopifyService(req.shopifyConfig);

// Product creation
router.post('/create', (req, res) => productController.createProducts(req, res));
router.post('/create-more', (req, res) => productController.createMoreProducts(req, res));
router.post('/create-five', (req, res) => productController.createFiveDummyProducts(req, res));
router.post('/create-multiple', (req, res) => productController.createMultipleProducts(req, res));

// Product deletion
router.delete('/delete-dummy', (req, res) => productController.deleteDummyProducts(req, res));

// Shop information
router.get('/shop-info', (req, res) => productController.getShopInfo(req, res));

// Bulk operations status
router.get('/bulk-operation-status', (req, res) => productController.getBulkOperationStatus(req, res));

module.exports = router; 