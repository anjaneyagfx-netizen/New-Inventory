/**
 * models/Sale.js
 * One document per line item in a bill. All docs sharing a bill_number make up one invoice.
 */
const mongoose = require('mongoose');
const generateId = require('../utils/generateId');

const saleSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    bill_number: { type: String, required: true, index: true },
    date: { type: String, required: true },
    customer_name: { type: String, default: '' },
    itemId: { type: String, required: true, index: true },
    sheets_sale: { type: Number, default: 0 },
    u_molding_sale: { type: Number, default: 0 },
    l_molding_sale: { type: Number, default: 0 },
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

saleSchema.index({ warehouse_id: 1, bill_number: 1 });

saleSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Sale', saleSchema);
