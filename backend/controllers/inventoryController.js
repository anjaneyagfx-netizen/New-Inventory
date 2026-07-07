/**
 * controllers/inventoryController.js
 */
const InventoryItem = require('../models/InventoryItem');
const Category = require('../models/Category');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const ApiError = require('../utils/ApiError');
const { userHasWarehouse } = require('../middleware/auth');

async function list(req, res) {
  const wh = String(req.query.warehouse_id || '');
  if (!wh) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, wh)) throw ApiError.forbidden('No access');

  const items = await InventoryItem.find({ warehouse_id: wh }).sort({ created: -1 }).lean();
  const catIds = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const cats = await Category.find({ _id: { $in: catIds } }).lean();
  const catMap = Object.fromEntries(cats.map((c) => [c._id, c.name]));

  const rows = items.map((i) => ({
    id: i._id,
    name: i.name,
    category: i.category,
    warehouse_id: i.warehouse_id,
    sheets: i.sheets,
    uMolding: i.uMolding,
    lMolding: i.lMolding,
    image: i.image,
    created: i.created,
    category_name: catMap[i.category] || 'Uncategorized',
  }));
  res.json(rows);
}

async function create(req, res) {
  const { name, category, warehouse_id, sheets = 0, uMolding = 0, lMolding = 0, image = null } = req.body || {};
  if (!name || !warehouse_id) throw ApiError.badRequest('name and warehouse_id required');
  if (!userHasWarehouse(req.user, warehouse_id)) throw ApiError.forbidden('No access');

  const dupe = await InventoryItem.findOne({ warehouse_id, name });
  if (dupe) throw ApiError.badRequest('Item with this name already exists');

  const doc = await InventoryItem.create({
    name: String(name).trim(),
    category: category || null,
    warehouse_id,
    sheets: Number(sheets) || 0,
    uMolding: Number(uMolding) || 0,
    lMolding: Number(lMolding) || 0,
    image,
  });
  res.status(201).json(doc.toJSON());
}

async function update(req, res) {
  const { id } = req.params;
  const update = {};
  const b = req.body || {};
  ['name', 'category', 'image'].forEach((f) => { if (b[f] !== undefined) update[f] = b[f]; });
  ['sheets', 'uMolding', 'lMolding'].forEach((f) => { if (b[f] !== undefined) update[f] = Number(b[f]) || 0; });
  if (Object.keys(update).length === 0) throw ApiError.badRequest('No fields to update');

  const doc = await InventoryItem.findOneAndUpdate({ _id: id }, update, { new: true });
  if (!doc) throw ApiError.notFound('Item not found');
  res.json(doc.toJSON());
}

async function remove(req, res) {
  const { id } = req.params;
  await Promise.all([
    Sale.deleteMany({ itemId: id }),
    Purchase.deleteMany({ itemId: id }),
  ]);
  const r = await InventoryItem.deleteOne({ _id: id });
  if (r.deletedCount === 0) throw ApiError.notFound('Item not found');
  res.json({ deleted: true });
}

async function bulkUpsert(req, res) {
  const { warehouse_id, items = [], auto_categories = [] } = req.body || {};
  if (!warehouse_id) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, warehouse_id)) throw ApiError.forbidden('No access');

  // Existing categories in this warehouse
  const existingCats = await Category.find({ warehouse_id }).lean();
  const catMap = new Map(existingCats.map((c) => [c.name.toLowerCase(), c._id]));

  let auto_created_categories = 0;
  for (const cname of auto_categories) {
    const key = String(cname).toLowerCase();
    if (catMap.has(key)) continue;
    const doc = await Category.create({ name: String(cname).trim(), warehouse_id });
    catMap.set(key, doc._id);
    auto_created_categories++;
  }

  let created = 0, updated = 0, failed = 0;
  for (const row of items) {
    try {
      if (!row || !row.name) { failed++; continue; }
      let categoryId = row.category_id || null;
      if (!categoryId && row.category_name) {
        categoryId = catMap.get(String(row.category_name).toLowerCase()) || null;
      }
      const existing = await InventoryItem.findOne({ warehouse_id, name: row.name });
      if (existing) {
        existing.sheets = Number(row.sheets ?? existing.sheets) || 0;
        existing.uMolding = Number(row.uMolding ?? existing.uMolding) || 0;
        existing.lMolding = Number(row.lMolding ?? existing.lMolding) || 0;
        if (categoryId) existing.category = categoryId;
        await existing.save();
        updated++;
      } else {
        await InventoryItem.create({
          name: String(row.name).trim(),
          category: categoryId,
          warehouse_id,
          sheets: Number(row.sheets) || 0,
          uMolding: Number(row.uMolding) || 0,
          lMolding: Number(row.lMolding) || 0,
        });
        created++;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[bulkUpsert] row failed:', e.message);
      failed++;
    }
  }
  res.json({ created, updated, failed, auto_created_categories });
}

module.exports = { list, create, update, remove, bulkUpsert };
