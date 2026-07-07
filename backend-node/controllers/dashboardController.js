/**
 * controllers/dashboardController.js
 */
const InventoryItem = require('../models/InventoryItem');
const Category = require('../models/Category');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const ApiError = require('../utils/ApiError');
const { userHasWarehouse } = require('../middleware/auth');

async function dashboard(req, res) {
  const wh = String(req.query.warehouse_id || '');
  if (!wh) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, wh)) throw ApiError.forbidden('No access');

  const [items, totalCategories] = await Promise.all([
    InventoryItem.find({ warehouse_id: wh }).lean(),
    Category.countDocuments({ warehouse_id: wh }),
  ]);

  let totalStock = 0;
  let lowStock = 0;
  for (const i of items) {
    totalStock += (i.sheets || 0) + (i.uMolding || 0) + (i.lMolding || 0);
    if ((i.sheets || 0) < 10 || (i.uMolding || 0) < 10 || (i.lMolding || 0) < 10) lowStock++;
  }

  const [recentSales, recentPurchases] = await Promise.all([
    Sale.find({ warehouse_id: wh }).sort({ date: -1, created: -1 }).limit(5).lean(),
    Purchase.find({ warehouse_id: wh }).sort({ date: -1, created: -1 }).limit(5).lean(),
  ]);

  const itemIds = [...new Set([...recentSales, ...recentPurchases].map((x) => x.itemId))];
  const lookups = await InventoryItem.find({ _id: { $in: itemIds } }).lean();
  const nameMap = Object.fromEntries(lookups.map((x) => [x._id, x.name]));

  const decorate = (r) => ({ ...r, id: r._id, item_name: nameMap[r.itemId] || 'Deleted' });

  res.json({
    total_items: items.length,
    total_stock: Math.round(totalStock),
    low_stock_count: lowStock,
    total_categories: totalCategories,
    recent_sales: recentSales.map(decorate),
    recent_purchases: recentPurchases.map(decorate),
  });
}

module.exports = { dashboard };
