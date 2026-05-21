const axios = require('axios');
const logger = require('../utils/logger');

class ShopifyService {
  constructor(config) {
    this.graphqlUrl = config.graphqlUrl;
    this.headers = config.headers;
  }

  /**
   * Make a GraphQL request to Shopify
   */
  async graphql(query, variables = null) {
    try {
      const payload = { query };
      if (variables) {
        payload.variables = variables;
      }

      const response = await axios.post(this.graphqlUrl, payload, { headers: this.headers });

      // Log throttle status if available
      if (response.data.extensions?.cost?.throttleStatus) {
        const throttle = response.data.extensions.cost.throttleStatus;
        logger.throttle('GRAPHQL', throttle);
      }

      return response.data;
    } catch (error) {
      logger.error('GraphQL request failed', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Get current throttle status
   */
  async getThrottleStatus() {
    try {
      const response = await this.graphql('{ shop { id } }');
      return response.extensions?.cost?.throttleStatus || null;
    } catch (error) {
      logger.error('Failed to get throttle status', error);
      return null;
    }
  }

  /**
   * Get store locations
   */
  async getLocations() {
    const query = `{
      locations(first: 50) {
        edges {
          node {
            id
            name
          }
        }
      }
    }`;

    const response = await this.graphql(query);
    const locations = response.data?.locations?.edges?.map(edge => edge.node) || [];

    if (!locations.length) {
      throw new Error('No locations found');
    }

    logger.info(`Fetched ${locations.length} locations`);
    return locations;
  }

  /**
   * Get requested location ID, or default to the store's first location
   */
  async getLocationId(preferredLocationId = null) {
    const locations = await this.getLocations();

    if (preferredLocationId) {
      const location = locations.find(({ id }) => id === preferredLocationId);
      if (!location) {
        throw new Error(`Selected location was not found for this store: ${preferredLocationId}`);
      }

      logger.info(`Using selected location: ${location.name} (${location.id})`);
      return location.id;
    }

    const location = locations[0];
    logger.info(`Using default location: ${location.name} (${location.id})`);
    return location.id;
  }

  /**
   * Get first location ID
   */
  async getFirstLocationId() {
    return this.getLocationId();
  }

  /**
   * Fetch all products matching a query with pagination
   */
  async fetchAllProducts(searchQuery = "") {
    let products = [];
    let hasNextPage = true;
    let endCursor = null;

    logger.info(`Starting to fetch all products with query: "${searchQuery || 'NO FILTER - ALL PRODUCTS'}"`);

    while (hasNextPage) {
      const query = `{
        products(first: 100${searchQuery ? `, query: "${searchQuery}"` : ""}${endCursor ? `, after: "${endCursor}"` : ""}) {
          pageInfo { hasNextPage }
          edges {
            cursor
            node {
              id
              title
              handle
              variants(first: 100) {
                edges {
                  node {
                    id
                    inventoryItem { id }
                  }
                }
              }
            }
          }
        }
      }`;

      const response = await this.graphql(query);
      const data = response.data.products;

      products = products.concat(data.edges.map(e => e.node));
      hasNextPage = data.pageInfo.hasNextPage;

      if (hasNextPage) {
        endCursor = data.edges[data.edges.length - 1].cursor;
      }

      logger.info(`Fetched page with ${data.edges.length} products, total so far: ${products.length}`);
    }

    logger.info(`Finished fetching products. Total: ${products.length} products from Shopify`);
    return products;
  }

  /**
   * Get current bulk operation status
   */
  async getBulkOperationStatus() {
    const query = `{
      currentBulkOperation {
        id
        status
        type
        createdAt
        completedAt
        errorCode
        objectCount
        rootObjectCount
        fileSize
        url
        partialDataUrl
      }
    }`;

    const response = await this.graphql(query);
    return response.data.currentBulkOperation;
  }

  /**
   * Create staged upload for bulk operations
   */
  async createStagedUpload(filename, mimeType = "text/jsonl") {
    const mutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }
    `;

    const variables = {
      input: [{
        resource: "BULK_MUTATION_VARIABLES",
        filename,
        mimeType,
        httpMethod: "POST"
      }]
    };

    const response = await this.graphql(mutation, variables);

    if (response.data.stagedUploadsCreate.userErrors?.length > 0) {
      throw new Error(`Staged upload error: ${JSON.stringify(response.data.stagedUploadsCreate.userErrors)}`);
    }

    return response.data.stagedUploadsCreate.stagedTargets[0];
  }

  /**
   * Start a bulk operation
   */
  async startBulkOperation(mutation, stagedUploadPath) {
    const bulkMutation = `
      mutation {
        bulkOperationRunMutation(
          mutation: """${mutation}""",
          stagedUploadPath: "${stagedUploadPath}"
        ) {
          bulkOperation { id status }
          userErrors { field message }
        }
      }
    `;

    const response = await this.graphql(bulkMutation);

    if (response.data.bulkOperationRunMutation.userErrors?.length > 0) {
      throw new Error(`Bulk operation error: ${JSON.stringify(response.data.bulkOperationRunMutation.userErrors)}`);
    }

    return response.data.bulkOperationRunMutation.bulkOperation;
  }

  /**
   * Fetch basic shop information
   */
  async getShopInfo() {
    const query = `
      query {
        shop {
          name
          description
          email
          currencyCode
          primaryDomain {
            host
            url
          }
          plan {
            displayName
            partnerDevelopment
            shopifyPlus
          }
          myshopifyDomain
          id
          contactEmail
          currencyFormats {
            moneyFormat
            moneyWithCurrencyFormat
          }
          timezoneAbbreviation
          timezoneOffset
          billingAddress {
            country
            countryCode
            city
            province
            provinceCode
            zip
            address1
            address2
          }
        }
      }
    `;

    const response = await this.graphql(query);

    if (response.errors) {
      throw new Error(`Failed to fetch shop info: ${JSON.stringify(response.errors)}`);
    }

    return response.data.shop;
  }
}

module.exports = ShopifyService;
