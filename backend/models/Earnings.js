const mongoose = require('mongoose');

const EarningsSchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'providerModel'
  },
  providerModel: {
    type: String,
    required: true,
    enum: ['Mechanic', 'DeliveryPerson']
  },
  serviceRequest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceRequest',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Create indexes for efficient queries
EarningsSchema.index({ provider: 1, date: -1 });
EarningsSchema.index({ providerModel: 1, date: -1 });

module.exports = mongoose.model('Earnings', EarningsSchema);