/**
 * models/Purchase.js
 */
const mongoose = require('mongoose');
const generateId = require('../utils/generateId');

const purchaseSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    bill_number: { type: String, required: true, index: true },
    date: { type: String, required: true },
    supplier_name: { type: String, default: '' },
    itemId: { type: String, required: true, index: true },
    sheets_purchase: { type: Number, default: 0 },
    u_molding_purchase: { type: Number, default: 0 },
    l_molding_purchase: { type: Number, default: 0 },
    price_per_sheet: { type: Number, default: 0 },
    price_per_u_molding: { type: Number, default: 0 },
    price_per_l_molding: { type: Number, default: 0 },
    total_price: { type: Number, default: 0 },
    warehouse_id: { type: String, required: true, index: true },
    userId: { type: String, default: null },
    created: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, _id: false, id: false }
);

purchaseSchema.index({ warehouse_id: 1, bill_number: 1 });

purchaseSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Purchase', purchaseSchema);
