const mongoose = require('mongoose');

const DeliveryPersonSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  vehicleType: {
    type: String,
    enum: ['motorcycle', 'car', 'truck'],
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  availability: {
    type: Boolean,
    default: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      default: [0, 0] // Default to [0,0] if not provided
    }
  },
  rating: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
});

DeliveryPersonSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DeliveryPerson', DeliveryPersonSchema);