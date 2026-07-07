/**
 * seed/seed.js
 * Idempotent seed: only runs when there are zero users in the database.
 * Automatically executed by server.js on startup so a fresh Mongo instance is
 * ready to use with default admin/admin123 credentials.
 *
 * You can also run it standalone: `npm run seed`
 */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const User = require('../models/User');
const Warehouse = require('../models/Warehouse');
const Category = require('../models/Category');
const InventoryItem = require('../models/InventoryItem');

async function seedDefaults() {
  const count = await User.countDocuments();
  if (count > 0) return;

  // eslint-disable-next-line no-console
  console.log('[stockflow] Empty database detected — seeding defaults...');

  const [wh1, wh2] = await Warehouse.create([
    { name: 'Main Warehouse', location: 'Mumbai' },
    { name: 'Secondary Depot', location: 'Delhi' },
  ]);

  const password_hash = await bcrypt.hash('admin123', 10);
  await User.create({
    username: 'admin',
    email: 'admin@stockflow.local',
    password_hash,
    role: 'owner',
    warehouse_ids: [wh1._id, wh2._id],
  });

  const catsMain = await Category.create([
    { name: 'Aluminum', warehouse_id: wh1._id },
    { name: 'Steel', warehouse_id: wh1._id },
    { name: 'Plastic', warehouse_id: wh1._id },
    { name: 'Composite', warehouse_id: wh1._id },
  ]);
  const catsSecondary = await Category.create([
    { name: 'Rubber', warehouse_id: wh2._id },
    { name: 'Foam', warehouse_id: wh2._id },
  ]);

  const items = [
    { name: 'AL-1024', cat: catsMain[0]._id, wh: wh1._id, sheets: 50, uMolding: 30, lMolding: 25 },
    { name: 'AL-1025', cat: catsMain[0]._id, wh: wh1._id, sheets: 62, uMolding: 38, lMolding: 30 },
    { name: 'ST-2010', cat: catsMain[1]._id, wh: wh1._id, sheets: 74, uMolding: 46, lMolding: 35 },
    { name: 'ST-2011', cat: catsMain[1]._id, wh: wh1._id, sheets: 86, uMolding: 54, lMolding: 40 },
    { name: 'PL-3009', cat: catsMain[2]._id, wh: wh1._id, sheets: 98, uMolding: 62, lMolding: 45 },
    { name: 'CM-4001', cat: catsMain[3]._id, wh: wh1._id, sheets: 110, uMolding: 70, lMolding: 50 },
    // Low-stock example
    { name: 'AL-9999', cat: catsMain[0]._id, wh: wh1._id, sheets: 4, uMolding: 6, lMolding: 2 },
    // Secondary warehouse
    { name: 'RB-500', cat: catsSecondary[0]._id, wh: wh2._id, sheets: 120, uMolding: 80, lMolding: 60 },
  ];
  await InventoryItem.create(
    items.map((it) => ({
      name: it.name,
      category: it.cat,
      warehouse_id: it.wh,
      sheets: it.sheets,
      uMolding: it.uMolding,
      lMolding: it.lMolding,
    }))
  );

  // eslint-disable-next-line no-console
  console.log('[stockflow] Seed complete. Login: admin / admin123');
}

// If run directly: connect and seed then exit
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  (async () => {
    try {
      await connectDB();
      await seedDefaults();
      await mongoose.disconnect();
      process.exit(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    }
  })();
}

module.exports = seedDefaults;
