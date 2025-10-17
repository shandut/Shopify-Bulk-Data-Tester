import React, { useState } from 'react';
import {
  Card,
  FormLayout,
  TextField,
  Button,
  Text,
  Banner,
  Layout,
  BlockStack
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
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    status: 'success'
  });

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
        </BlockStack>
      </Layout.Section>
    </Layout>
  );
};

export default Settings; 