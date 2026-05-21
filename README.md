# Shopify Bulk Data Tester

A full-stack testing tool for high-volume Shopify Admin API workflows: bulk product creation/deletion, inventory cache refreshes, location-aware inventory updates, and pricing updates. Built with **React + Shopify Polaris** frontend and **Node.js + Express** backend.

## 🏗️ Architecture

```
Shopify-Bulk-Data-Tester/
├── backend/                 # Professional Node.js Backend
│   ├── src/
│   │   ├── controllers/     # HTTP request handlers
│   │   ├── services/        # Business logic layer
│   │   ├── utils/           # Helper utilities
│   │   ├── routes/          # Express route definitions
│   │   ├── middleware/      # Express middleware (includes auth)
│   │   ├── config/          # Configuration management
│   │   └── app.js          # Express application setup
│   ├── server.js           # Application entry point
│   └── README.md           # Backend documentation
├── src/                    # React Frontend
│   ├── components/         # React components (Settings)
│   ├── context/           # React Context (SettingsContext)
│   ├── App.js             # Main React component with tabs
│   └── index.js           # React app entry point
├── public/                # Static frontend assets
└── package.json           # Full-stack dependencies
```

## 🚀 Quick Start

### Prerequisites
- Node.js >= 14.0.0
- npm or yarn
- Shopify store with Admin API access

### 1. Installation
```bash
git clone https://github.com/shandut/Shopify-Bulk-Data-Tester.git
cd Shopify-Bulk-Data-Tester
npm install
```

### 2. Environment Setup

#### Option A: Use the Settings Interface (Recommended)
1. Start the application (`npm run dev`)
2. Navigate to the **Settings** tab in the UI
3. Enter your Shopify credentials:
   - Store URL (e.g., `your-shop` or `your-shop.myshopify.com`)
   - API Access Token (e.g., `shpat_xxxxx`)
4. Click **Save Settings** - changes apply immediately without restart!

#### Option B: Manual Configuration
Create `.env` file in the project root:
```env
SHOP=your-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your_access_token
SHOPIFY_API_VERSION=2025-07
PORT=4000
NODE_ENV=development
```

### 3. Run the Application

#### Option A: Development Mode (Both Frontend & Backend)
```bash
npm run dev
```
This starts:
- 🔧 **Backend**: http://localhost:4000 (API server)
- 🎨 **Frontend**: http://localhost:3000 (React app)

#### Option B: Individual Components
```bash
# Backend only
npm run dev:backend

# Frontend only  
npm run dev:frontend
```

#### Option C: Production Mode
```bash
# Build frontend for production
npm run build

# Start backend in production
npm start
```

## 📚 API Endpoints

### 🏥 Health Check
- `GET /health` - Backend health status

### 📦 Product Management
- `POST /products/create` - Create 30,000 products
- `POST /products/create-more` - Create additional products
- `DELETE /products/delete-dummy` - Delete all products with "dummy" in title/handle
- `GET /products/shop-info` - Get connected shop information
- `GET /products/bulk-operation-status` - Check bulk operation status

### 📊 Inventory Management
- `POST /inventory/refresh-cache` - Refresh product cache
- `GET /inventory/cache-status` - Check product cache for the connected store
- `DELETE /inventory/cache` - Clear product cache for the connected store
- `GET /inventory/locations` - Get inventory locations for the connected store
- `POST /inventory/enable-tracking` - Enable inventory tracking
- `POST /inventory/update-quantities` - Update on-hand quantities
- `POST /inventory/set-available-quantities` - Set available quantities
- `POST /inventory/update-from-csv` - Import from CSV
- `POST /inventory/update` - Full inventory update

### 💰 Price Management
- `POST /prices/update` - Update prices (parallel)
- `POST /prices/update-bulk` - Update prices (bulk operations)

### ⚙️ Settings Management
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update API credentials
- `GET /api/oauth/config` - Get Shopify app install configuration
- `POST /api/oauth/config` - Save Shopify app client credentials/scopes
- `GET /api/oauth/install?shop=your-shop.myshopify.com` - Start Shopify OAuth install
- `GET /api/oauth/callback` - Shopify OAuth callback; verifies HMAC/state and saves the access token

## 🎮 Frontend Features

### 🔧 System Status
- Backend health monitoring
- Real-time connection status
- **Shop information display** (name, currency, plan, timezone)
- **Connected store verification**

### ⚙️ Settings Management (New!)
- **Dynamic API credential configuration**
- **Shopify app install flow for dev stores**
- **No restart required for changes**
- **Automatic URL formatting and validation**
- **Secure token validation (shpat_/shpua_ prefix check)**
- **Persistent storage in .env file**

### 📦 Product Management
- Create 30,000 dummy products with one click
- Add more products incrementally
- **Delete all dummy products (Ultra-Fast)** - Dynamic parallelism
- Monitor bulk operation progress

### 📊 Inventory Management
- Store-specific cache management
- Dynamic location discovery and selection
- Full inventory updates
- Step-by-step inventory processing
- CSV import functionality
- Available quantity management

### 💰 Price Management
- Individual price updates with throttle management
- Ultra-fast bulk price updates
- Real-time progress monitoring

### 📊 Performance Analytics
- Theoretical performance calculations
- Real-time timing metrics
- Scalability projections

## 🔧 Backend Features

### 🏗️ Enterprise Architecture
- **MVC Pattern**: Clean separation of concerns
- **Service Layer**: Business logic abstraction  
- **Professional Logging**: Structured timestamps and data
- **Error Handling**: Comprehensive middleware
- **Configuration Management**: Environment variables
- **Request-Scoped Authentication**: Per-request Shopify service instances
- **Context-Based State Management**: React Context API for settings

### ⚡ Performance Optimizations
- **Dynamic Throttling**: Adapts to Shopify API limits
- **Ultra-Fast Delete Operations**: Dynamic parallelism up to 200 concurrent deletions
- **Aggressive Parallel Processing**: Maximum throughput for all operations
- **Intelligent Batching**: 250 items per mutation
- **Memory Efficiency**: Streaming for large datasets
- **Smart Batch Sizing**: Automatically adjusts based on available API points

## Recommended Test Flow

When switching stores, use this sequence so inventory and price operations run against the connected store's own products and location:

1. Configure the store URL and Admin API token in **Settings**.
2. On **Main**, click **Refresh Shop Info** and **Get Locations**.
3. Select the inventory location to update.
4. Click **Check Cache**. If there is no cache, or if you just created/deleted products, click **Refresh Cache**.
5. Run inventory actions:
   - **Enable Tracking (Step 1)**
   - **Update Quantities (Step 2)** or **Set Available Quantities**
   - Or use **Full Inventory Update** to refresh missing cache automatically, enable tracking, and update quantities.
6. Run price actions only after the cache is refreshed for the current store.

The backend now stores inventory caches per connected `myshopify.com` domain under `.cache/`, instead of reusing one shared `inventory_cache.json` across stores.

## Shopify App OAuth Setup

For a dev-store install flow instead of manually pasting an Admin API token:

1. Create or open a Shopify app in your Partner/admin tooling.
2. Expose the backend server publicly, for example with a Cloudflare or ngrok tunnel to `http://localhost:4000`.
3. In Shopify, add this callback URL to the app:
   ```text
   https://your-public-backend-url/api/oauth/callback
   ```
4. In this app's **Settings** tab, fill in:
   - Store URL
   - App client ID
   - App client secret
   - Public app URL: the public backend URL from step 2
   - Frontend URL after install: usually `http://localhost:3000`
   - Access scopes
5. Click **Install App on Store**.

After Shopify redirects back, the backend verifies the callback and exchanges the code for an Admin API access token. It saves `SHOP`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_FRONTEND_URL`, and `SHOPIFY_SCOPES` in `.env`.

### 🛡️ Security & Reliability
- Environment variable configuration
- Input validation and sanitization
- Rate limiting protection
- Graceful error handling and retries

## 🚦 Performance Benchmarks

### 30,000 Products
- **Product Creation**: ~2-5 minutes (bulk operations)
- **Product Deletion (Dummy)**: ~15-30 seconds (dynamic parallel)
- **Inventory Updates**: ~3-4 seconds (aggressive parallel)
- **Price Updates**: ~30 seconds (bulk) vs ~2-3 minutes (parallel)

### Scalability
- **1M items**: Estimated 33-50 seconds
- **2M items**: Estimated 1-2 minutes  
- **3M items**: Estimated 2-3 minutes

## 🛠️ Development Commands

```bash
# Full development environment
npm run dev                 # Frontend (3000) + Backend (4000)

# Individual services
npm run dev:backend        # Backend only (4000)
npm run dev:frontend       # Frontend only (3000)

# Production
npm run build              # Build frontend for production
npm start                  # Start backend in production

# Testing
npm test                   # Run React tests
```

## 🌐 Ports & URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

## 🔍 Monitoring & Debugging

### Backend Logs
The backend provides structured logging:
- Request/response logging
- Performance timing  
- Throttle status monitoring
- Error tracking with stack traces

### Frontend Debug
- Browser DevTools for React debugging
- Network tab for API call monitoring
- Console logs for operation tracking

## 🚀 Deployment

### Frontend (React)
```bash
npm run build
# Deploy the build/ folder to your hosting service
```

### Backend (Node.js)
```bash
# Set environment variables
export SHOPIFY_SHOP=your-shop.myshopify.com
export SHOPIFY_ACCESS_TOKEN=your_token
export NODE_ENV=production

# Start the server
npm start
```

## 🆕 Latest Updates (v2.0)

### Major New Features
- **Settings Management**: Configure API credentials through the UI without restarts
- **Ultra-Fast Delete**: Delete thousands of dummy products in seconds with dynamic parallelism
- **Shop Info Display**: Real-time display of connected store information
- **Request-Scoped Auth**: Each API request uses its own authentication context
- **Aggressive Parallel Processing**: All inventory operations now use maximum parallelism

## 🔄 Migration from Legacy

The new architecture maintains **100% backward compatibility**. All original endpoints work unchanged while providing the new organized structure.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📄 License

ISC License - see LICENSE file for details.

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub or contact Shannon Dutton.

---

**Built with ❤️ using React, Node.js, and Shopify's powerful APIs**
