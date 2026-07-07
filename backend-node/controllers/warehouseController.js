/**
 * controllers/warehouseController.js
 */
const Warehouse = require('../models/Warehouse');
const Category = require('../models/Category');
const InventoryItem = require('../models/InventoryItem');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const ApiError = require('../utils/ApiError');

async function list(req, res) {
  const all = await Warehouse.find().sort({ name: 1 });
  const rows = all.map((w) => w.toJSON());
  if (req.user.role === 'owner') return res.json(rows);
  const ids = new Set(req.user.warehouse_ids || []);
  res.json(rows.filter((w) => ids.has(w.id)));
}

async function create(req, res) {
  const { name, location } = req.body || {};
  if (!name || !String(name).trim()) throw ApiError.badRequest('name required');
  const doc = await Warehouse.create({ name: String(name).trim(), location: location || '' });
  res.status(201).json(doc.toJSON());
}

async function update(req, res) {
  const { id } = req.params;
  const { name, location } = req.body || {};
  if (!name || !String(name).trim()) throw ApiError.badRequest('name required');
  const doc = await Warehouse.findOneAndUpdate(
    { _id: id },
    { name: String(name).trim(), location: location || '' },
    { new: true }
  );
  if (!doc) throw ApiError.notFound('Warehouse not found');
  res.json(doc.toJSON());
}

async function remove(req, res) {
  const { id } = req.params;
  const w = await Warehouse.findOne({ _id: id });
  if (!w) throw ApiError.notFound('Warehouse not found');

  await Promise.all([
    Sale.deleteMany({ warehouse_id: id }),
    Purchase.deleteMany({ warehouse_id: id }),
    InventoryItem.deleteMany({ warehouse_id: id }),
    Category.deleteMany({ warehouse_id: id }),
  ]);
  await Warehouse.deleteOne({ _id: id });

  res.json({ deleted: true });
}

module.exports = { list, create, update, remove };
