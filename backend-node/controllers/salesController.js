/**
 * controllers/salesController.js
 * Creates one Sale doc per line item and mutates inventory atomically per operation.
 */
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const InventoryItem = require('../models/InventoryItem');
const Category = require('../models/Category');
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

  const sales = await Sale.find({ warehouse_id: wh }).sort({ date: -1, created: -1 }).lean();
  const itemIds = [...new Set(sales.map((s) => s.itemId))];
  const items = await InventoryItem.find({ _id: { $in: itemIds } }).lean();
  const itemMap = Object.fromEntries(items.map((i) => [i._id, i]));
  const catIds = [...new Set(items.map((i) => i.category).filter(Boolean))];
  const cats = await Category.find({ _id: { $in: catIds } }).lean();
  const catMap = Object.fromEntries(cats.map((c) => [c._id, c.name]));

  const rows = sales.map((s) => {
    const it = itemMap[s.itemId];
    return {
      id: s._id,
      bill_number: s.bill_number,
      date: s.date,
      customer_name: s.customer_name,
      itemId: s.itemId,
      sheets_sale: s.sheets_sale,
      u_molding_sale: s.u_molding_sale,
      l_molding_sale: s.l_molding_sale,
      price_per_sheet: s.price_per_sheet,
      price_per_u_molding: s.price_per_u_molding,
      price_per_l_molding: s.price_per_l_molding,
      total_price: s.total_price,
      warehouse_id: s.warehouse_id,
      userId: s.userId,
      created: s.created,
      item_name: it ? it.name : 'Deleted',
      category_name: it && it.category ? (catMap[it.category] || 'Uncategorized') : 'Uncategorized',
    };
  });
  res.json(rows);
}

async function applySaleBill(bill, user) {
  for (const raw of bill.items) {
    const it = normalizeItem(raw);
    const inv = await InventoryItem.findOne({ _id: it.itemId });
    if (!inv) throw ApiError.badRequest(`Item ${it.itemId} not found`);
    if (it.sheets > inv.sheets || it.uMolding > inv.uMolding || it.lMolding > inv.lMolding) {
      throw ApiError.badRequest(`Insufficient stock for ${inv.name}`);
    }
    inv.sheets -= it.sheets;
    inv.uMolding -= it.uMolding;
    inv.lMolding -= it.lMolding;
    await inv.save();

    await Sale.create({
      bill_number: bill.bill_number,
      date: bill.date,
      customer_name: bill.customer_name || '',
      itemId: it.itemId,
      sheets_sale: it.sheets,
      u_molding_sale: it.uMolding,
      l_molding_sale: it.lMolding,
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
  const olds = await Sale.find({ bill_number: billNumber, warehouse_id: warehouseId });
  for (const s of olds) {
    await InventoryItem.updateOne(
      { _id: s.itemId },
      { $inc: { sheets: s.sheets_sale, uMolding: s.u_molding_sale, lMolding: s.l_molding_sale } }
    );
  }
  await Sale.deleteMany({ bill_number: billNumber, warehouse_id: warehouseId });
}

async function create(req, res) {
  const bill = req.body || {};
  if (!bill.warehouse_id || !bill.bill_number || !bill.date) {
    throw ApiError.badRequest('bill_number, date and warehouse_id required');
  }
  if (!userHasWarehouse(req.user, bill.warehouse_id)) throw ApiError.forbidden('No access');
  if (!Array.isArray(bill.items) || bill.items.length === 0) throw ApiError.badRequest('No items in bill');

  await applySaleBill(bill, req.user);
  res.status(201).json({ ok: true });
}

async function updateBill(req, res) {
  const bill = req.body || {};
  const billNumber = decodeURIComponent(req.params.bill_number);
  if (!bill.warehouse_id) throw ApiError.badRequest('warehouse_id required');
  if (!userHasWarehouse(req.user, bill.warehouse_id)) throw ApiError.forbidden('No access');
  if (!Array.isArray(bill.items) || bill.items.length === 0) throw ApiError.badRequest('No items in bill');

  await reverseAndDelete(billNumber, bill.warehouse_id);
  await applySaleBill({ ...bill, bill_number: bill.bill_number || billNumber }, req.user);
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
// silence unused-var
void mongoose;
