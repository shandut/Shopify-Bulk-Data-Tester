const express = require('express');
const inventoryController = require('../controllers/inventoryController');

const router = express.Router();

// Cache management
router.get('/locations', inventoryController.getLocations);
router.get('/cache-status', inventoryController.cacheStatus);
router.post('/refresh-cache', inventoryController.refreshCache);
router.delete('/cache', inventoryController.clearCache);

// Inventory tracking and quantities
router.post('/enable-tracking', inventoryController.enableTracking);
router.post('/update-quantities', inventoryController.updateQuantities);
router.post('/set-available-quantities', inventoryController.setAvailableQuantities);
router.post('/update-from-csv', inventoryController.updateFromCSV);

// Full inventory update (legacy endpoint for backward compatibility)
router.post('/update', inventoryController.fullUpdate);

module.exports = router;
