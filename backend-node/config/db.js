/**
 * config/db.js
 * MongoDB connection using Mongoose.
 */
const mongoose = require('mongoose');

async function connectDB() {
  const mongoUrl = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME || 'stockflow';
  if (!mongoUrl) {
    throw new Error('MONGO_URL is not defined. Copy .env.example to .env and set it.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(mongoUrl, {
    dbName,
    serverSelectionTimeoutMS: 10_000,
    autoIndex: true,
  });

  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.warn('[stockflow] MongoDB disconnected');
  });
  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[stockflow] MongoDB error:', err.message);
  });

  // eslint-disable-next-line no-console
  console.log(`[stockflow] MongoDB connected: db="${dbName}"`);
  return mongoose.connection;
}

module.exports = connectDB;
