const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const shopifyAuth = require('./middleware/shopifyAuth');

// Import routes
const inventoryRoutes = require('./routes/inventory');
const productRoutes = require('./routes/products');
const priceRoutes = require('./routes/prices');
const settingsRoutes = require('./routes/settings');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    query: req.query, 
    body: req.method !== 'GET' ? req.body : undefined 
  });
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Settings routes (no auth required)
app.use('/api/settings', settingsRoutes);

// Apply Shopify auth middleware to all other routes
app.use(shopifyAuth);

// API routes
app.use('/products', productRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/prices', priceRoutes);

// Legacy route mappings for backward compatibility
app.use('/refresh-inventory-cache', inventoryRoutes);
app.use('/update-inventory', inventoryRoutes);
app.use('/enable-tracking', inventoryRoutes);
app.use('/update-inventory-quantities', inventoryRoutes);
app.use('/update-inventory-from-csv', inventoryRoutes);
app.use('/set-available-quantities', inventoryRoutes);
app.use('/create-products', productRoutes);
app.use('/create-more-products', productRoutes);
app.use('/bulk-operation-status', productRoutes);
app.use('/update-prices', priceRoutes);
app.use('/update-prices-bulk', priceRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app; 