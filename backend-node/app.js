/**
 * app.js
 * Express application: middlewares + route mounting + error handler.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth');
const warehouseRoutes = require('./routes/warehouses');
const categoryRoutes = require('./routes/categories');
const inventoryRoutes = require('./routes/inventory');
const salesRoutes = require('./routes/sales');
const purchaseRoutes = require('./routes/purchases');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers (do NOT enable CSP here — API only)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// CORS — permissive by default; restrict via CORS_ORIGIN env var if desired
const corsOrigin = (process.env.CORS_ORIGIN || '').trim();
const corsOptions = corsOrigin
  ? { origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }
  : { origin: true, credentials: true };
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsers (inventory item images can be base64 data URLs — allow generous payloads)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Access logs
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Simple health checks
app.get('/', (_req, res) => res.json({ status: 'ok', service: 'stockflow-backend' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// API surface (all routes prefixed with /api)
app.get('/api', (_req, res) => res.json({ message: 'StockFlow API' }));
app.get('/api/', (_req, res) => res.json({ message: 'StockFlow API' }));

app.use('/api/auth', authRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// 404 + centralized error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;
