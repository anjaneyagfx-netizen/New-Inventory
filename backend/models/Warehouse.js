/**
 * models/Warehouse.js
 */
const mongoose = require('mongoose');
const generateId = require('../utils/generateId');

const warehouseSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateId },
    name: { type: String, required: true, trim: true },
    location: { type: String, default: '' },
    created: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false, _id: false, id: false }
);

warehouseSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Warehouse', warehouseSchema);
