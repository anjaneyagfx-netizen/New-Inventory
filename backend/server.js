/**
 * server.js
 * Entry point: connects to MongoDB, seeds defaults if empty, then starts the Express app.
 */
require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const seedDefaults = require('./seed/seed');

const PORT = process.env.PORT || 8001;

(async () => {
  try {
    await connectDB();
    await seedDefaults();

    const server = app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`[stockflow] API listening on 0.0.0.0:${PORT}`);
    });

    const shutdown = (signal) => {
      // eslint-disable-next-line no-console
      console.log(`\n[stockflow] Received ${signal}. Shutting down gracefully...`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
      // eslint-disable-next-line no-console
      console.error('[stockflow] Unhandled Rejection:', reason);
    });
    process.on('uncaughtException', (err) => {
      // eslint-disable-next-line no-console
      console.error('[stockflow] Uncaught Exception:', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[stockflow] Failed to start:', err);
    process.exit(1);
  }
})();
