const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const ENV_FILE_PATH = path.join(process.cwd(), '.env');

// Get current settings
router.get('/', async (req, res) => {
  try {
    const envContent = await fs.readFile(ENV_FILE_PATH, 'utf8');
    const settings = {
      apiKey: process.env.SHOPIFY_ACCESS_TOKEN || '',
      storeUrl: process.env.SHOP || ''
    };
    res.json(settings);
  } catch (error) {
    // If .env file doesn't exist, return empty settings
    if (error.code === 'ENOENT') {
      res.json({
        apiKey: '',
        storeUrl: ''
      });
    } else {
      console.error('Error reading settings:', error);
      res.status(500).json({ error: 'Failed to read settings' });
    }
  }
});

// Update settings
router.post('/', async (req, res) => {
  try {
    const { apiKey, storeUrl } = req.body;

    // Create the new .env content with just our required variables
    const newEnvContent = `SHOPIFY_ACCESS_TOKEN=${apiKey}\nSHOP=${storeUrl}\n`;

    // Write the new content to .env file (this will overwrite existing content)
    await fs.writeFile(ENV_FILE_PATH, newEnvContent);

    // Update process.env
    process.env.SHOPIFY_ACCESS_TOKEN = apiKey;
    process.env.SHOP = storeUrl;

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router; 