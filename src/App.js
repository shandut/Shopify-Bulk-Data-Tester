import React, { useState, useEffect, useMemo } from "react";
import {
  Page,
  Card,
  Button,
  TextContainer,
  Banner,
  Layout,
  Text,
  Spinner,
  InlineStack,
  BlockStack,
  Tabs
} from '@shopify/polaris';
import Settings from './components/Settings';
import { SettingsProvider, useSettings } from './context/SettingsContext';

// API Service Creator
const createApiService = (settings) => {
  const baseUrl = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000";
  
  // Only proceed with API calls if we have both settings
  if (!settings.apiKey || !settings.storeUrl) {
    console.warn('Missing API key or store URL. Please configure settings first.');
  }

  return {
    // Product endpoints
    products: {
      create: () => fetch(`${baseUrl}/products/create`, { 
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      createMore: () => fetch(`${baseUrl}/products/create-more`, { 
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      createFive: () => fetch(`${baseUrl}/products/create-five`, { 
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      createMultiple: (count) => fetch(`${baseUrl}/products/create-multiple?count=${count}`, { 
        method: "POST", 
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      deleteDummy: () => fetch(`${baseUrl}/products/delete-dummy`, { 
        method: "DELETE", 
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      getBulkStatus: () => fetch(`${baseUrl}/products/bulk-operation-status`, { 
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      getShopInfo: () => fetch(`${baseUrl}/products/shop-info`, { 
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
    },
    
    // Inventory endpoints
    inventory: {
      refreshCache: () => fetch(`${baseUrl}/inventory/refresh-cache`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      enableTracking: () => fetch(`${baseUrl}/inventory/enable-tracking`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      updateQuantities: () => fetch(`${baseUrl}/inventory/update-quantities`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      setAvailableQuantities: () => fetch(`${baseUrl}/inventory/set-available-quantities`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      updateFromCSV: () => fetch(`${baseUrl}/inventory/update-from-csv`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      fullUpdate: () => fetch(`${baseUrl}/inventory/update`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
    },
    
    // Price endpoints
    prices: {
      update: () => fetch(`${baseUrl}/prices/update`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
      updateBulk: () => fetch(`${baseUrl}/prices/update-bulk`, { 
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": settings.apiKey,
          "X-Shopify-Store-URL": settings.storeUrl
        }
      }),
    },
    
    // Health check
    health: () => fetch(`${baseUrl}/health`, { 
      headers: {
        "X-Shopify-Access-Token": settings.apiKey,
        "X-Shopify-Store-URL": settings.storeUrl
      }
    }),
  };
};

const AppContent = () => {
  const { settings } = useSettings();
  const [selectedTab, setSelectedTab] = useState(0);
  const apiService = useMemo(() => createApiService(settings), [settings]);

  const tabs = [
    {
      id: 'main',
      content: 'Main',
      accessibilityLabel: 'Main',
      panelID: 'main-panel',
    },
    {
      id: 'settings',
      content: 'Settings',
      accessibilityLabel: 'Settings',
      panelID: 'settings-panel',
    },
  ];

  // Product state
  const [productStatus, setProductStatus] = useState("");
  const [productResult, setProductResult] = useState(null);
  const [moreProductsStatus, setMoreProductsStatus] = useState("");
  const [moreProductsResult, setMoreProductsResult] = useState(null);
  const [fiveProductsStatus, setFiveProductsStatus] = useState("");
  const [fiveProductsResult, setFiveProductsResult] = useState(null);
  const [multipleProductsStatus, setMultipleProductsStatus] = useState("");
  const [multipleProductsResult, setMultipleProductsResult] = useState(null);
  const [deleteDummyStatus, setDeleteDummyStatus] = useState("");
  const [deleteDummyResult, setDeleteDummyResult] = useState(null);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);

  // Inventory state
  const [cacheStatus, setCacheStatus] = useState("");
  const [enableTrackingStatus, setEnableTrackingStatus] = useState("");
  const [inventoryQtyStatus, setInventoryQtyStatus] = useState("");
  const [updatedQtyCount, setUpdatedQtyCount] = useState(null);
  const [availableQtyStatus, setAvailableQtyStatus] = useState("");
  const [availableQtyCount, setAvailableQtyCount] = useState(null);
  const [availableQtyElapsed, setAvailableQtyElapsed] = useState(null);
  const [csvStatus, setCsvStatus] = useState("");
  const [csvResult, setCsvResult] = useState(null);
  const [fullUpdateStatus, setFullUpdateStatus] = useState("");
  const [fullUpdateElapsed, setFullUpdateElapsed] = useState(null);

  // Price state
  const [priceStatus, setPriceStatus] = useState("");
  const [priceResult, setPriceResult] = useState(null);
  const [bulkPriceStatus, setBulkPriceStatus] = useState("");
  const [bulkPriceResult, setBulkPriceResult] = useState(null);

  // Health state
  const [healthStatus, setHealthStatus] = useState("");
  const [shopInfo, setShopInfo] = useState(null);
  const [shopInfoLoading, setShopInfoLoading] = useState(false);

  // Generic error handler
  const handleApiCall = async (apiCall, setStatus, setResult = null, successMessage = null) => {
    try {
      setStatus("Loading...");
      const response = await apiCall();
      const data = await response.json();
      
      if (data.success !== false) {
        setStatus(successMessage || data.message || "Success!");
        if (setResult) setResult(data);
        return data;
      } else {
        setStatus(`Error: ${data.error || 'Unknown error'}`);
        if (setResult) setResult(data);
        return null;
      }
    } catch (error) {
      console.error('API call failed:', error);
      setStatus(`Error: ${error.message}`);
      if (setResult) setResult({ error: error.message });
      return null;
    }
  };

  // Product handlers
  const handleCreateProducts = async () => {
    console.log("Creating 30,000 products...");
    const data = await handleApiCall(
      apiService.products.create,
      setProductStatus,
      setProductResult,
      "Bulk product creation started!"
    );
  };

  const handleCreateMoreProducts = async () => {
    console.log("Creating more products...");
    const data = await handleApiCall(
      apiService.products.createMore,
      setMoreProductsStatus,
      setMoreProductsResult
    );
    if (data?.range) {
      setMoreProductsStatus(`Bulk operation started for Dummy Product ${data.range.startNum} to ${data.range.endNum}!`);
    }
  };

  const handleCreateFiveProducts = async () => {
    console.log("Creating 5 dummy products...");
    const data = await handleApiCall(
      apiService.products.createFive,
      setFiveProductsStatus,
      setFiveProductsResult
    );
    if (data?.range) {
      setFiveProductsStatus(`Created ${data.summary?.successful || 0} out of 5 dummy products (${data.range.startNum} to ${data.range.endNum})!`);
    }
  };

  const handleCreateMultipleProducts = async () => {
    console.log("Creating 5000 products concurrently...");
    const data = await handleApiCall(
      () => apiService.products.createMultiple(5000),
      setMultipleProductsStatus,
      setMultipleProductsResult
    );
    if (data?.summary) {
      setMultipleProductsStatus(
        `Created ${data.summary.successful} out of ${data.summary.total} products in ${data.summary.totalTimeSeconds.toFixed(2)}s ` +
        `(${data.summary.averageTimePerProductSeconds.toFixed(3)}s per product)`
      );
    }
  };

  const handleCheckBulkStatus = async () => {
    console.log("Checking bulk operation status...");
    setBulkStatusLoading(true);
    try {
      const response = await apiService.products.getBulkStatus();
      const data = await response.json();
      setBulkStatus(data);
    } catch (error) {
      setBulkStatus({ error: error.message });
    }
    setBulkStatusLoading(false);
  };

  const handleDeleteDummyProducts = async () => {
    console.log("Deleting all dummy products...");
    setDeleteDummyStatus("Deleting dummy products...");
    const data = await handleApiCall(
      apiService.products.deleteDummy,
      setDeleteDummyStatus,
      setDeleteDummyResult
    );
    if (data?.deletedCount !== undefined) {
      setDeleteDummyStatus(
        `✅ Deleted ${data.deletedCount} dummy products in ${data.elapsedSeconds}s` +
        (data.failedCount > 0 ? ` (${data.failedCount} failed)` : '')
      );
    }
  };

  // Inventory handlers
  const handleRefreshCache = async () => {
    console.log("Refreshing inventory cache...");
    const data = await handleApiCall(
      apiService.inventory.refreshCache,
      setCacheStatus,
      null
    );
    if (data?.count) {
      setCacheStatus(`Cache refreshed: ${data.count} products`);
    }
  };

  const handleEnableTracking = async () => {
    console.log("Enabling inventory tracking...");
    const data = await handleApiCall(
      apiService.inventory.enableTracking,
      setEnableTrackingStatus
    );
    if (data?.elapsedSeconds) {
      setEnableTrackingStatus(`Done in ${data.elapsedSeconds}s`);
    }
  };

  const handleUpdateInventoryQty = async () => {
    console.log("Updating inventory quantities...");
    const data = await handleApiCall(
      apiService.inventory.updateQuantities,
      setInventoryQtyStatus
    );
    if (data) {
      if (data.elapsedSeconds) setInventoryQtyStatus(`Done in ${data.elapsedSeconds}s`);
      if (data.updatedCount !== undefined) setUpdatedQtyCount(data.updatedCount);
    }
  };

  const handleSetAvailableQuantities = async () => {
    console.log("Setting available quantities...");
    const data = await handleApiCall(
      apiService.inventory.setAvailableQuantities,
      setAvailableQtyStatus
    );
    if (data) {
      if (data.elapsedSeconds) {
        setAvailableQtyStatus(`Done in ${data.elapsedSeconds}s`);
        setAvailableQtyElapsed(data.elapsedSeconds);
      }
      if (data.updatedCount !== undefined) setAvailableQtyCount(data.updatedCount);
    }
  };

  const handleUpdateFromCSV = async () => {
    console.log("Updating from CSV...");
    const data = await handleApiCall(
      apiService.inventory.updateFromCSV,
      setCsvStatus,
      setCsvResult
    );
  };

  const handleFullInventoryUpdate = async () => {
    console.log("Running full inventory update...");
    const data = await handleApiCall(
      apiService.inventory.fullUpdate,
      setFullUpdateStatus
    );
    if (data) {
      const totalElapsed = (parseFloat(data.enableTracking?.elapsedSeconds || 0) + 
                           parseFloat(data.updateQuantities?.elapsedSeconds || 0)).toFixed(2);
      setFullUpdateElapsed(totalElapsed);
      setFullUpdateStatus(`Full update completed in ${totalElapsed}s`);
    }
  };

  // Price handlers
  const handleUpdatePrices = async () => {
    console.log("Updating prices...");
    const data = await handleApiCall(
      apiService.prices.update,
      setPriceStatus,
      setPriceResult
    );
    if (data?.updatedVariants && data?.elapsedSeconds) {
      setPriceStatus(`Updated ${data.updatedVariants} variants in ${data.elapsedSeconds}s`);
    }
  };

  const handleUpdatePricesBulk = async () => {
    console.log("Starting bulk price update...");
    const data = await handleApiCall(
      apiService.prices.updateBulk,
      setBulkPriceStatus,
      setBulkPriceResult
    );
    if (data?.bulkOperationId && data?.variantCount) {
      setBulkPriceStatus(`Bulk operation started! ID: ${data.bulkOperationId}, updating ${data.variantCount} variants.`);
    }
  };

  // Health check
  const handleHealthCheck = async () => {
    try {
      const response = await apiService.health();
      const data = await response.json();
      setHealthStatus(`✅ Backend healthy - Uptime: ${Math.floor(data.uptime)}s`);
    } catch (error) {
      setHealthStatus(`❌ Backend offline: ${error.message}`);
    }
  };

  // Shop info
  const handleFetchShopInfo = async () => {
    setShopInfoLoading(true);
    try {
      const response = await apiService.products.getShopInfo();
      const data = await response.json();
      if (data.success && data.shop) {
        setShopInfo(data.shop);
      } else {
        setShopInfo({ error: data.error || 'Failed to fetch shop info' });
      }
    } catch (error) {
      setShopInfo({ error: error.message });
    }
    setShopInfoLoading(false);
  };

  // Check health and shop info on mount and when settings change
  useEffect(() => {
    handleHealthCheck();
    if (settings.apiKey && settings.storeUrl) {
      handleFetchShopInfo();
    }
  }, [settings]);

  // Calculate theoretical performance tables
  const theoreticalTable = useMemo(() => {
    if (!updatedQtyCount || !inventoryQtyStatus || !inventoryQtyStatus.includes('Done in')) return null;
    const match = inventoryQtyStatus.match(/Done in ([\d.]+)s/);
    if (!match) return null;
    const seconds = parseFloat(match[1]);
    const items = updatedQtyCount;
    if (!items || !seconds) return null;
    const perItem = seconds / items;
    const calc = (n) => (perItem * n);
    const formatMinSec = (s) => {
      const min = Math.floor(s / 60);
      const sec = Math.round(s % 60);
      return `${min}m ${sec.toString().padStart(2, '0')}s`;
    };
    return [
      { label: '1,000,000', time: calc(1_000_000).toFixed(2), minsec: formatMinSec(calc(1_000_000)) },
      { label: '2,000,000', time: calc(2_000_000).toFixed(2), minsec: formatMinSec(calc(2_000_000)) },
      { label: '3,000,000', time: calc(3_000_000).toFixed(2), minsec: formatMinSec(calc(3_000_000)) },
    ];
  }, [updatedQtyCount, inventoryQtyStatus]);

  const availableQtyTheoreticalTable = useMemo(() => {
    if (!availableQtyCount || !availableQtyStatus || !availableQtyStatus.includes('Done in')) return null;
    const match = availableQtyStatus.match(/Done in ([\d.]+)s/);
    if (!match) return null;
    const seconds = parseFloat(match[1]);
    const items = availableQtyCount;
    if (!items || !seconds) return null;
    const perItem = seconds / items;
    const calc = (n) => (perItem * n);
    const formatMinSec = (s) => {
      const min = Math.floor(s / 60);
      const sec = Math.round(s % 60);
      return `${min}m ${sec.toString().padStart(2, '0')}s`;
    };
    return [
      { label: '1,000,000', time: calc(1_000_000).toFixed(2), minsec: formatMinSec(calc(1_000_000)) },
      { label: '2,000,000', time: calc(2_000_000).toFixed(2), minsec: formatMinSec(calc(2_000_000)) },
      { label: '3,000,000', time: calc(3_000_000).toFixed(2), minsec: formatMinSec(calc(3_000_000)) },
    ];
  }, [availableQtyCount, availableQtyStatus]);

  const handleTabChange = (selectedTabIndex) => {
    setSelectedTab(selectedTabIndex);
  };

  return (
    <Page>
      <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />
      {selectedTab === 0 ? (
        <Layout>
          <Layout.Section>
            <BlockStack gap="4">
              {/* System Status */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">🔧 System Status</Text>
                  <InlineStack gap="400">
                    <Button onClick={handleHealthCheck} tone="success" size="slim">Check Backend Health</Button>
                    <Button onClick={handleFetchShopInfo} size="slim" loading={shopInfoLoading}>Refresh Shop Info</Button>
                  </InlineStack>
                  {healthStatus && <Text variant="bodyMd" as="span">{healthStatus}</Text>}
                  
                  {shopInfo && !shopInfo.error && (
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">🏪 Connected Store</Text>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p"><strong>Shop:</strong> {shopInfo.name}</Text>
                        <Text variant="bodyMd" as="p"><strong>Domain:</strong> {shopInfo.myshopifyDomain}</Text>
                        <Text variant="bodyMd" as="p"><strong>Currency:</strong> {shopInfo.currencyCode}</Text>
                        {shopInfo.description && (
                          <Text variant="bodyMd" as="p"><strong>Description:</strong> {shopInfo.description}</Text>
                        )}
                        {shopInfo.plan && (
                          <Text variant="bodyMd" as="p"><strong>Plan:</strong> {shopInfo.plan.displayName}</Text>
                        )}
                        <Text variant="bodyMd" as="p"><strong>Email:</strong> {shopInfo.email || shopInfo.contactEmail}</Text>
                        {shopInfo.billingAddress && (
                          <Text variant="bodyMd" as="p"><strong>Country:</strong> {shopInfo.billingAddress.country} ({shopInfo.billingAddress.countryCode})</Text>
                        )}
                        <Text variant="bodyMd" as="p"><strong>Timezone:</strong> {shopInfo.timezoneAbbreviation} ({shopInfo.timezoneOffset})</Text>
                      </BlockStack>
                    </BlockStack>
                  )}
                  
                  {shopInfo && shopInfo.error && (
                    <Banner status="critical">
                      <p>Failed to fetch shop info: {shopInfo.error}</p>
                    </Banner>
                  )}
                </BlockStack>
              </Card>

              {/* Product Management */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">📦 Product Management</Text>
                  <InlineStack gap="400" wrap>
                    <Button primary onClick={handleCreateProducts}>Create 30,000 Dummy Products</Button>
                    <Button onClick={handleCreateMoreProducts}>Add 30,000 More Products</Button>
                    <Button onClick={handleCreateFiveProducts}>Create 5 Dummy Products</Button>
                    <Button onClick={handleCreateMultipleProducts} tone="success">Create 5000 Products (Fast)</Button>
                    <Button onClick={handleDeleteDummyProducts} tone="critical">Delete All Dummy Products</Button>
                    <Button onClick={handleCheckBulkStatus}>Check Bulk Operation Status</Button>
                  </InlineStack>
                  
                  <BlockStack gap="200">
                    {productStatus && <Text variant="bodyMd" as="span">{productStatus}</Text>}
                    {moreProductsStatus && <Text variant="bodyMd" as="span">{moreProductsStatus}</Text>}
                    {fiveProductsStatus && <Text variant="bodyMd" as="span">{fiveProductsStatus}</Text>}
                    {multipleProductsStatus && <Text variant="bodyMd" as="span">⚡ {multipleProductsStatus}</Text>}
                    {deleteDummyStatus && <Text variant="bodyMd" as="span">🗑️ {deleteDummyStatus}</Text>}
                    
                    {productResult && (
                      <Banner status="info" title="Product Creation Result">
                        <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(productResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                    
                    {moreProductsResult && (
                      <Banner status="info" title="Additional Products Result">
                        <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(moreProductsResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                    
                    {fiveProductsResult && (
                      <Banner status="info" title="Five Dummy Products Result">
                        <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(fiveProductsResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                    
                    {multipleProductsResult && (
                      <Banner status="info" title="Multiple Products Creation Result">
                        <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(multipleProductsResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                    
                    {deleteDummyResult && (
                      <Banner status="success" title="Delete Dummy Products Result">
                        <pre style={{ background: "#efe", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(deleteDummyResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Inventory Management */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">📊 Inventory Management</Text>
                  <InlineStack gap="400" wrap>
                    <Button onClick={handleRefreshCache}>Refresh Cache</Button>
                    <Button onClick={handleFullInventoryUpdate} tone="critical">Full Inventory Update</Button>
                    <Button onClick={handleEnableTracking}>Enable Tracking (Step 1)</Button>
                    <Button onClick={handleUpdateInventoryQty}>Update Quantities (Step 2)</Button>
                    <Button onClick={handleSetAvailableQuantities}>Set Available Quantities</Button>
                    <Button onClick={handleUpdateFromCSV}>Update from CSV</Button>
                  </InlineStack>
                  
                  <BlockStack gap="200">
                    {cacheStatus && <Text variant="bodyMd" as="span">🗂️ {cacheStatus}</Text>}
                    {fullUpdateStatus && (
                      <Text variant="bodyMd" as="span" tone="success">
                        🚀 {fullUpdateStatus}
                        {fullUpdateElapsed && <span style={{ marginLeft: 16 }}><strong>Total Time:</strong> {fullUpdateElapsed}s</span>}
                      </Text>
                    )}
                    {enableTrackingStatus && <Text variant="bodyMd" as="span">🔄 {enableTrackingStatus}</Text>}
                    {inventoryQtyStatus && (
                      <Text variant="bodyMd" as="span">
                        📈 {inventoryQtyStatus}
                        {updatedQtyCount !== null && (
                          <span style={{ marginLeft: 16 }}><strong>Items Updated:</strong> {updatedQtyCount.toLocaleString()}</span>
                        )}
                      </Text>
                    )}
                    {availableQtyStatus && (
                      <Text variant="bodyMd" as="span">
                        ✅ {availableQtyStatus}
                        {availableQtyCount !== null && (
                          <span style={{ marginLeft: 16 }}><strong>Items Updated:</strong> {availableQtyCount.toLocaleString()}</span>
                        )}
                        {availableQtyElapsed && (
                          <span style={{ marginLeft: 16 }}><strong>Time:</strong> {availableQtyElapsed}s</span>
                        )}
                      </Text>
                    )}
                    {csvStatus && <Text variant="bodyMd" as="span">📄 {csvStatus}</Text>}
                    
                    {csvResult && (
                      <Banner status="info" title="CSV Update Result">
                        <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(csvResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Price Management */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">💰 Price Management</Text>
                  <InlineStack gap="400" wrap>
                    <Button onClick={handleUpdatePrices}>Update Prices (Individual)</Button>
                    <Button onClick={handleUpdatePricesBulk} primary>Update Prices (Bulk - Faster)</Button>
                  </InlineStack>
                  
                  <BlockStack gap="200">
                    {priceStatus && <Text variant="bodyMd" as="span">💵 {priceStatus}</Text>}
                    {bulkPriceStatus && <Text variant="bodyMd" as="span">⚡ {bulkPriceStatus}</Text>}
                    
                    {priceResult && (
                      <Banner status="info" title="Price Update Result">
                        <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(priceResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                    
                    {bulkPriceResult && (
                      <Banner status="info" title="Bulk Price Update Result">
                        <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 200, overflow: 'auto' }}>
                          {JSON.stringify(bulkPriceResult, null, 2)}
                        </pre>
                      </Banner>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>

              {/* Bulk Operation Status */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">📋 Operation Status</Text>
                  {bulkStatusLoading && <Spinner accessibilityLabel="Loading bulk operation status" size="small" />}
                  {bulkStatus && (
                    <Banner status="info" title="Current Bulk Operation Status">
                      <pre style={{ background: "#eef", padding: 10, marginTop: 10, maxHeight: 300, overflow: 'auto' }}>
                        {JSON.stringify(bulkStatus, null, 2)}
                      </pre>
                    </Banner>
                  )}
                </BlockStack>
              </Card>

              {/* Performance Analytics */}
              {(theoreticalTable || availableQtyTheoreticalTable) && (
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">📊 Performance Analytics</Text>
                    
                    {theoreticalTable && (
                      <div>
                        <Text variant="headingSm" as="h3">Theoretical Time to Update Inventory Quantities</Text>
                        <div style={{ background: '#f9f9f9', padding: 16, marginTop: 12, borderRadius: 8 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd', fontWeight: 600 }}>Items</th>
                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd', fontWeight: 600 }}>Estimated Time (seconds)</th>
                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd', fontWeight: 600 }}>Estimated Time (min:sec)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {theoreticalTable.map(row => (
                                <tr key={row.label}>
                                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.label}</td>
                                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.time}</td>
                                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.minsec}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {availableQtyTheoreticalTable && (
                      <div>
                        <Text variant="headingSm" as="h3">Theoretical Time to Set Available Quantities</Text>
                        <div style={{ background: '#f9f9f9', padding: 16, marginTop: 12, borderRadius: 8 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd', fontWeight: 600 }}>Items</th>
                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd', fontWeight: 600 }}>Estimated Time (seconds)</th>
                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '2px solid #ddd', fontWeight: 600 }}>Estimated Time (min:sec)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availableQtyTheoreticalTable.map(row => (
                                <tr key={row.label}>
                                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.label}</td>
                                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.time}</td>
                                  <td style={{ padding: 8, borderBottom: '1px solid #eee' }}>{row.minsec}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      ) : (
        <Settings />
      )}
    </Page>
  );
};

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App; 