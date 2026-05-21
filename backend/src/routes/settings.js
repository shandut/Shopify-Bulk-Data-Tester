const express = require('express');
const router = express.Router();
const { readEnv, writeEnv } = require('../utils/envFile');

// Get current settings
router.get('/', async (req, res) => {
  try {
    const env = await readEnv();
    const settings = {
      apiKey: process.env.SHOPIFY_ACCESS_TOKEN || env.SHOPIFY_ACCESS_TOKEN || '',
      storeUrl: process.env.SHOP || env.SHOP || ''
    };
    res.json(settings);
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

// Update settings
router.post('/', async (req, res) => {
  try {
    const { apiKey, storeUrl } = req.body;

    await writeEnv({
      SHOPIFY_ACCESS_TOKEN: apiKey,
      SHOP: storeUrl
    });

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
