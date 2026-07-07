/**
 * controllers/purchaseController.js
 */
const Purchase = require('../models/Purchase');
const InventoryItem = require('../models/InventoryItem');
const ApiError = require('../utils/ApiError');
const { userHasWarehouse } = require('../middleware/auth');

function lineTotal(it) {
  return (it.sheets * it.pricePerSheet) + (it.uMolding * it.pricePerU) + (it.lMolding * it.pricePerL);
}

function normalizeItem(raw) {
  return {
    itemId: String(raw.itemId || ''),
    sheets: Number(raw.sheets) || 0,
    uMolding: Number(raw.uMolding) || 0,
    lMolding: Number(raw.lMolding) || 0,
    pricePerSheet: Number(raw.pricePerSheet) || 0,
    pricePerU: Number(raw.pricePerU) || 0,
    pricePerL: Number(raw.pricePerL) || 0,
  };
}

async function list(req, res) {
  const wh = String(req.query.warehouse_id || '');
  if (!wh) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, wh)) throw ApiError.forbidden('No access');

  const docs = await Purchase.find({ warehouse_id: wh }).sort({ date: -1, created: -1 }).lean();
  const itemIds = [...new Set(docs.map((s) => s.itemId))];
  const items = await InventoryItem.find({ _id: { $in: itemIds } }).lean();
  const itemMap = Object.fromEntries(items.map((i) => [i._id, i.name]));

  const rows = docs.map((s) => ({
    id: s._id,
    bill_number: s.bill_number,
    date: s.date,
    supplier_name: s.supplier_name,
    itemId: s.itemId,
    sheets_purchase: s.sheets_purchase,
    u_molding_purchase: s.u_molding_purchase,
    l_molding_purchase: s.l_molding_purchase,
    price_per_sheet: s.price_per_sheet,
    price_per_u_molding: s.price_per_u_molding,
    price_per_l_molding: s.price_per_l_molding,
    total_price: s.total_price,
    warehouse_id: s.warehouse_id,
    userId: s.userId,
    created: s.created,
    item_name: itemMap[s.itemId] || 'Deleted',
  }));
  res.json(rows);
}

async function applyPurchaseBill(bill, user) {
  const supplier = bill.supplier_name || bill.customer_name || '';
  for (const raw of bill.items) {
    const it = normalizeItem(raw);
    const inv = await InventoryItem.findOne({ _id: it.itemId });
    if (!inv) throw ApiError.badRequest(`Item ${it.itemId} not found`);

    inv.sheets += it.sheets;
    inv.uMolding += it.uMolding;
    inv.lMolding += it.lMolding;
    await inv.save();

    await Purchase.create({
      bill_number: bill.bill_number,
      date: bill.date,
      supplier_name: supplier,
      itemId: it.itemId,
      sheets_purchase: it.sheets,
      u_molding_purchase: it.uMolding,
      l_molding_purchase: it.lMolding,
      price_per_sheet: it.pricePerSheet,
      price_per_u_molding: it.pricePerU,
      price_per_l_molding: it.pricePerL,
      total_price: lineTotal(it),
      warehouse_id: bill.warehouse_id,
      userId: user.id,
    });
  }
}

async function reverseAndDelete(billNumber, warehouseId) {
  const olds = await Purchase.find({ bill_number: billNumber, warehouse_id: warehouseId });
  for (const p of olds) {
    await InventoryItem.updateOne(
      { _id: p.itemId },
      { $inc: { sheets: -p.sheets_purchase, uMolding: -p.u_molding_purchase, lMolding: -p.l_molding_purchase } }
    );
  }
  await Purchase.deleteMany({ bill_number: billNumber, warehouse_id: warehouseId });
}

async function create(req, res) {
  const bill = req.body || {};
  if (!bill.warehouse_id || !bill.bill_number || !bill.date) {
    throw ApiError.badRequest('bill_number, date and warehouse_id required');
  }
  if (!userHasWarehouse(req.user, bill.warehouse_id)) throw ApiError.forbidden('No access');
  if (!Array.isArray(bill.items) || bill.items.length === 0) throw ApiError.badRequest('No items in bill');

  await applyPurchaseBill(bill, req.user);
  res.status(201).json({ ok: true });
}

async function updateBill(req, res) {
  const bill = req.body || {};
  const billNumber = decodeURIComponent(req.params.bill_number);
  if (!bill.warehouse_id) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, bill.warehouse_id)) throw ApiError.forbidden('No access');
  if (!Array.isArray(bill.items) || bill.items.length === 0) throw ApiError.badRequest('No items in bill');

  await reverseAndDelete(billNumber, bill.warehouse_id);
  await applyPurchaseBill({ ...bill, bill_number: bill.bill_number || billNumber }, req.user);
  res.json({ ok: true });
}

async function deleteBill(req, res) {
  const billNumber = decodeURIComponent(req.params.bill_number);
  const wh = String(req.query.warehouse_id || '');
  if (!wh) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, wh)) throw ApiError.forbidden('No access');
  await reverseAndDelete(billNumber, wh);
  res.json({ deleted: true });
}

module.exports = { list, create, updateBill, deleteBill };
