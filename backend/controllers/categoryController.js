/**
 * controllers/categoryController.js
 */
const Category = require('../models/Category');
const InventoryItem = require('../models/InventoryItem');
const ApiError = require('../utils/ApiError');
const { userHasWarehouse } = require('../middleware/auth');

async function list(req, res) {
  const warehouseId = String(req.query.warehouse_id || '');
  if (!warehouseId) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, warehouseId)) throw ApiError.forbidden('No access');
  const rows = await Category.find({ warehouse_id: warehouseId }).sort({ name: 1 });
  res.json(rows.map((r) => r.toJSON()));
}

async function create(req, res) {
  const { name, warehouse_id } = req.body || {};
  if (!name || !warehouse_id) throw ApiError.badRequest('name and warehouse_id required');
  if (!userHasWarehouse(req.user, warehouse_id)) throw ApiError.forbidden('No access');

  const existing = await Category.findOne({ warehouse_id, name });
  if (existing) throw ApiError.badRequest('Category already exists');

  const doc = await Category.create({ name: String(name).trim(), warehouse_id });
  res.status(201).json(doc.toJSON());
}

async function update(req, res) {
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name) throw ApiError.badRequest('name required');
  const doc = await Category.findOneAndUpdate({ _id: id }, { name: String(name).trim() }, { new: true });
  if (!doc) throw ApiError.notFound('Category not found');
  res.json(doc.toJSON());
}

async function remove(req, res) {
  const { id } = req.params;
  await InventoryItem.updateMany({ category: id }, { $set: { category: null } });
  const r = await Category.deleteOne({ _id: id });
  if (r.deletedCount === 0) throw ApiError.notFound('Category not found');
  res.json({ deleted: true });
}

module.exports = { list, create, update, remove };
