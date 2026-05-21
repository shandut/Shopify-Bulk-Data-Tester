const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { readEnv, writeEnv } = require('../utils/envFile');
const logger = require('../utils/logger');

const router = express.Router();
const oauthStates = new Map();
const DEFAULT_SCOPES = [
  'read_products',
  'write_products',
  'read_inventory',
  'write_inventory',
  'read_locations'
].join(',');

const formatStoreUrl = (url) => {
  let formattedUrl = String(url || '').trim().toLowerCase();
  formattedUrl = formattedUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  if (formattedUrl && !formattedUrl.includes('.myshopify.com')) {
    formattedUrl = `${formattedUrl}.myshopify.com`;
  }

  return formattedUrl;
};

const isValidShop = (shop) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop);

const normalizeBaseUrl = (url) => String(url || '').trim().replace(/\/$/, '');

const timingSafeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const getHmacMessage = (query) => {
  return Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => {
      const value = Array.isArray(query[key]) ? query[key].join(',') : query[key];
      return `${key}=${value}`;
    })
    .join('&');
};

const verifyHmac = (query, clientSecret) => {
  if (!query.hmac || !clientSecret) return false;

  const message = getHmacMessage(query);
  const digest = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex');

  return timingSafeEqual(digest, query.hmac);
};

const getOAuthConfig = async () => {
  const env = await readEnv();
  return {
    clientId: process.env.SHOPIFY_API_KEY || env.SHOPIFY_API_KEY || '',
    clientSecret: process.env.SHOPIFY_API_SECRET || env.SHOPIFY_API_SECRET || '',
    appUrl: process.env.SHOPIFY_APP_URL || env.SHOPIFY_APP_URL || '',
    frontendUrl: process.env.SHOPIFY_FRONTEND_URL || env.SHOPIFY_FRONTEND_URL || 'http://localhost:3000',
    scopes: process.env.SHOPIFY_SCOPES || env.SHOPIFY_SCOPES || DEFAULT_SCOPES
  };
};

router.get('/config', async (req, res) => {
  try {
    const config = await getOAuthConfig();
    res.json({
      clientId: config.clientId,
      appUrl: config.appUrl,
      frontendUrl: config.frontendUrl,
      scopes: config.scopes,
      hasClientSecret: Boolean(config.clientSecret)
    });
  } catch (error) {
    logger.error('Failed to read OAuth config', error);
    res.status(500).json({ success: false, error: 'Failed to read OAuth config' });
  }
});

router.post('/config', async (req, res) => {
  try {
    const { clientId, clientSecret, appUrl, frontendUrl, scopes } = req.body;
    const updates = {
      SHOPIFY_API_KEY: String(clientId || '').trim(),
      SHOPIFY_APP_URL: normalizeBaseUrl(appUrl),
      SHOPIFY_FRONTEND_URL: normalizeBaseUrl(frontendUrl || 'http://localhost:3000'),
      SHOPIFY_SCOPES: String(scopes || DEFAULT_SCOPES).trim()
    };

    if (clientSecret) {
      updates.SHOPIFY_API_SECRET = String(clientSecret).trim();
    }

    await writeEnv(updates);

    res.json({
      success: true,
      config: {
        clientId: updates.SHOPIFY_API_KEY,
        appUrl: updates.SHOPIFY_APP_URL,
        frontendUrl: updates.SHOPIFY_FRONTEND_URL,
        scopes: updates.SHOPIFY_SCOPES,
        hasClientSecret: Boolean(process.env.SHOPIFY_API_SECRET)
      }
    });
  } catch (error) {
    logger.error('Failed to save OAuth config', error);
    res.status(500).json({ success: false, error: 'Failed to save OAuth config' });
  }
});

router.get('/install', async (req, res) => {
  try {
    const shop = formatStoreUrl(req.query.shop);
    const config = await getOAuthConfig();

    if (!shop) {
      return res.status(400).send('Missing shop');
    }

    if (!isValidShop(shop)) {
      return res.status(400).send('Invalid shop');
    }

    if (!config.clientId || !config.clientSecret || !config.appUrl) {
      return res.status(400).send('Missing Shopify app config. Add client ID, client secret, and app URL in Settings.');
    }

    const state = crypto.randomBytes(24).toString('hex');
    oauthStates.set(state, {
      shop,
      createdAt: Date.now()
    });

    const callbackUrl = `${normalizeBaseUrl(config.appUrl)}/api/oauth/callback`;
    const params = new URLSearchParams({
      client_id: config.clientId,
      scope: config.scopes,
      redirect_uri: callbackUrl,
      state
    });

    const authUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;
    logger.info(`Starting Shopify OAuth install for ${shop}`);
    res.redirect(authUrl);
  } catch (error) {
    logger.error('OAuth install failed', error);
    res.status(500).send(`OAuth install failed: ${error.message}`);
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { code, shop, state } = req.query;
    const formattedShop = formatStoreUrl(shop);
    const config = await getOAuthConfig();
    const stateEntry = oauthStates.get(state);

    if (!code || !formattedShop || !state) {
      return res.status(400).send('Missing OAuth callback parameters');
    }

    if (!isValidShop(formattedShop)) {
      return res.status(400).send('Invalid shop');
    }

    if (!stateEntry || stateEntry.shop !== formattedShop) {
      return res.status(400).send('Invalid OAuth state');
    }

    oauthStates.delete(state);

    if (Date.now() - stateEntry.createdAt > 10 * 60 * 1000) {
      return res.status(400).send('OAuth state expired. Start the install again.');
    }

    if (!verifyHmac(req.query, config.clientSecret)) {
      return res.status(400).send('Invalid OAuth HMAC');
    }

    const tokenResponse = await axios.post(`https://${formattedShop}/admin/oauth/access_token`, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code
    });

    const accessToken = tokenResponse.data?.access_token;

    if (!accessToken) {
      throw new Error('Shopify did not return an access token');
    }

    await writeEnv({
      SHOP: formattedShop,
      SHOPIFY_ACCESS_TOKEN: accessToken,
      SHOPIFY_API_KEY: config.clientId,
      SHOPIFY_API_SECRET: config.clientSecret,
      SHOPIFY_APP_URL: normalizeBaseUrl(config.appUrl),
      SHOPIFY_FRONTEND_URL: normalizeBaseUrl(config.frontendUrl),
      SHOPIFY_SCOPES: config.scopes
    });

    logger.info(`Shopify OAuth install completed for ${formattedShop}`);
    res.redirect(`${normalizeBaseUrl(config.frontendUrl)}/?shopify_oauth=success`);
  } catch (error) {
    logger.error('OAuth callback failed', error.response?.data || error);
    res.status(500).send(`OAuth callback failed: ${error.message}`);
  }
});

module.exports = router;
