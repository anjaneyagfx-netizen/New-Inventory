/**
 * models/InventoryItem.js
 */
const mongoose = require('mongoose');
const generateId = require('../utils/generateId');

const inventoryItemSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: null, index: true },
    warehouse_id: { type: String, required: true, index: true },
    sheets: { type: Number, default: 0 },
    uMolding: { type: Number, default: 0 },
    lMolding: { type: Number, default: 0 },
    image: { type: String, default: null },
    created: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, _id: false, id: false }
);

inventoryItemSchema.index({ warehouse_id: 1, name: 1 }, { unique: true });

inventoryItemSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
