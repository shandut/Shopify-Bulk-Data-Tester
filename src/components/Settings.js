import React, { useEffect, useState } from 'react';
import {
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  Banner,
  Layout,
  BlockStack,
  InlineStack
} from '@shopify/polaris';
import { useSettings } from '../context/SettingsContext';

const formatStoreUrl = (url) => {
  // Remove any protocol prefix and trailing slashes
  let formattedUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Add .myshopify.com if not present
  if (!formattedUrl.includes('.myshopify.com')) {
    formattedUrl = `${formattedUrl}.myshopify.com`;
  }

  return formattedUrl;
};

const Settings = () => {
  const { settings, updateSettings } = useSettings();
  const [formData, setFormData] = useState(settings);
  const [oauthConfig, setOauthConfig] = useState({
    clientId: '',
    clientSecret: '',
    appUrl: '',
    frontendUrl: 'http://localhost:3000',
    scopes: 'read_products,write_products,read_inventory,write_inventory,read_locations',
    hasClientSecret: false
  });
  const [oauthLoading, setOauthLoading] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    status: 'success'
  });

  useEffect(() => {
    const loadOAuthConfig = async () => {
      try {
        const response = await fetch('/api/oauth/config');
        if (!response.ok) return;

        const data = await response.json();
        setOauthConfig(prev => ({
          ...prev,
          ...data,
          clientSecret: ''
        }));
      } catch (error) {
        console.error('Error loading OAuth config:', error);
      }
    };

    loadOAuthConfig();
  }, []);

  const handleChange = (value, name) => {
    let processedValue = value;

    // Format store URL as user types
    if (name === 'storeUrl') {
      processedValue = value.toLowerCase().trim();
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
  };

  const handleOAuthChange = (value, name) => {
    setOauthConfig(prev => ({
      ...prev,
      [name]: name === 'appUrl' || name === 'frontendUrl' ? value.trim() : value
    }));
  };

  const handleSubmit = async () => {
    try {
      // Format the store URL before submitting
      const dataToSubmit = {
        ...formData,
        storeUrl: formatStoreUrl(formData.storeUrl)
      };

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSubmit),
      });

      if (response.ok) {
        updateSettings(dataToSubmit);
        setNotification({
          show: true,
          message: 'Settings saved successfully! The new settings will be used for all future requests.',
          status: 'success'
        });
        // Update form data with formatted URL
        setFormData(dataToSubmit);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      setNotification({
        show: true,
        message: 'Error saving settings: ' + error.message,
        status: 'critical'
      });
    }
  };

  const handleSaveOAuthConfig = async () => {
    try {
      setOauthLoading(true);
      const response = await fetch('/api/oauth/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(oauthConfig)
      });

      const data = await response.json();
      if (!response.ok || data.success === false) {
        throw new Error(data.error || 'Failed to save app config');
      }

      setOauthConfig(prev => ({
        ...prev,
        ...data.config,
        clientSecret: ''
      }));
      setNotification({
        show: true,
        message: 'Shopify app config saved.',
        status: 'success'
      });
      return true;
    } catch (error) {
      setNotification({
        show: true,
        message: 'Error saving Shopify app config: ' + error.message,
        status: 'critical'
      });
      return false;
    } finally {
      setOauthLoading(false);
    }
  };

  const handleInstallApp = async () => {
    try {
      const formattedStoreUrl = formatStoreUrl(formData.storeUrl);

      if (!formattedStoreUrl || !oauthConfig.clientId || (!oauthConfig.clientSecret && !oauthConfig.hasClientSecret) || !oauthConfig.appUrl) {
        throw new Error('Add store URL, client ID, client secret, and app URL before installing.');
      }

      const saved = await handleSaveOAuthConfig();
      if (!saved) return;

      window.location.href = `/api/oauth/install?shop=${encodeURIComponent(formattedStoreUrl)}`;
    } catch (error) {
      setNotification({
        show: true,
        message: 'Unable to start app install: ' + error.message,
        status: 'critical'
      });
    }
  };

  const isValidUrl = (url) => {
    const formatted = formatStoreUrl(url);
    return formatted.includes('.myshopify.com');
  };

  const isValidAccessToken = (token) => {
    return token.startsWith('shpat_') || token.startsWith('shpua_');
  };

  const getUrlError = () => {
    if (!formData.storeUrl) return undefined;
    if (!isValidUrl(formData.storeUrl)) {
      return 'Please enter a valid Shopify store URL';
    }
    return undefined;
  };

  const getTokenError = () => {
    if (!formData.apiKey) return undefined;
    if (!isValidAccessToken(formData.apiKey)) {
      return 'Access token should start with "shpat_" or "shpua_"';
    }
    return undefined;
  };

  return (
    <Layout>
      <Layout.Section>
        <BlockStack gap="400">
          {notification.show && (
            <Banner
              title={notification.status === 'success' ? 'Success' : 'Error'}
              status={notification.status}
              onDismiss={() => setNotification(prev => ({ ...prev, show: false }))}
            >
              <p>{notification.message}</p>
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Settings</Text>
              <FormLayout>
                <TextField
                  label="Store URL"
                  name="storeUrl"
                  value={formData.storeUrl}
                  onChange={(value) => handleChange(value, 'storeUrl')}
                  autoComplete="off"
                  error={getUrlError()}
                  helpText="Enter your Shopify store URL (e.g., my-store.myshopify.com)"
                />
                <TextField
                  label="Access Token"
                  name="apiKey"
                  value={formData.apiKey}
                  onChange={(value) => handleChange(value, 'apiKey')}
                  type="password"
                  autoComplete="off"
                  error={getTokenError()}
                  helpText="Enter your Shopify Admin API access token (starts with shpat_ or shpua_)"
                />
                <Button
                  primary
                  onClick={handleSubmit}
                  disabled={!formData.storeUrl || !formData.apiKey || !!getUrlError() || !!getTokenError()}
                >
                  Save Settings
                </Button>
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Shopify App Install</Text>
              <Text variant="bodyMd" as="p">
                Use this when you have a custom app/dev app in Shopify and want this tool to install it, complete OAuth, and save the Admin API token automatically.
              </Text>
              <FormLayout>
                <TextField
                  label="App client ID"
                  value={oauthConfig.clientId}
                  onChange={(value) => handleOAuthChange(value, 'clientId')}
                  autoComplete="off"
                  helpText="From the app's Client credentials page in Shopify."
                />
                <TextField
                  label="App client secret"
                  value={oauthConfig.clientSecret}
                  onChange={(value) => handleOAuthChange(value, 'clientSecret')}
                  type="password"
                  autoComplete="off"
                  helpText={oauthConfig.hasClientSecret ? 'A client secret is already saved. Enter a new one only if you want to replace it.' : 'Required for exchanging the OAuth code for an access token.'}
                />
                <TextField
                  label="Public app URL"
                  value={oauthConfig.appUrl}
                  onChange={(value) => handleOAuthChange(value, 'appUrl')}
                  autoComplete="off"
                  helpText="Public URL that reaches this backend server. Use the same host for the callback URL in Shopify."
                />
                <TextField
                  label="Frontend URL after install"
                  value={oauthConfig.frontendUrl}
                  onChange={(value) => handleOAuthChange(value, 'frontendUrl')}
                  autoComplete="off"
                  helpText="Where Shopify should send you after OAuth completes. Local dev is usually http://localhost:3000."
                />
                <TextField
                  label="Access scopes"
                  value={oauthConfig.scopes}
                  onChange={(value) => handleOAuthChange(value, 'scopes')}
                  autoComplete="off"
                  helpText="Comma-separated Admin API scopes requested during install."
                />
                <TextField
                  label="Callback URL to add in Shopify"
                  value={oauthConfig.appUrl ? `${oauthConfig.appUrl.replace(/\/$/, '')}/api/oauth/callback` : ''}
                  readOnly
                  autoComplete="off"
                />
                <InlineStack gap="300">
                  <Button onClick={handleSaveOAuthConfig} loading={oauthLoading}>
                    Save App Config
                  </Button>
                  <Button
                    primary
                    onClick={handleInstallApp}
                    loading={oauthLoading}
                    disabled={!formData.storeUrl || !oauthConfig.clientId || (!oauthConfig.clientSecret && !oauthConfig.hasClientSecret) || !oauthConfig.appUrl}
                  >
                    Install App on Store
                  </Button>
                </InlineStack>
              </FormLayout>
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
    </Layout>
  );
};

export default Settings;
