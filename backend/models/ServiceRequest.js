const mongoose = require('mongoose');

const ServiceRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  serviceType: {
    type: String,
    enum: ['mechanical', 'fuel'],
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'on-way', 'in-progress', 'completed', 'assigned'],
    default: 'pending'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'assignedToModel'
  },
  assignedToModel: {
    type: String,
    enum: ['Mechanic', 'DeliveryPerson']
  },
  fuelDetails: {
    fuelType: { type: String },
    quantity: { type: Number }
  },
  images: [{ type: String }],
  payment: {
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    provider: { type: String },
    amount: { type: Number, default: 0 } // total fare in currency units
  },
  distanceMeters: { type: Number, default: 0 }, // distance provider travelled for this service (meters)
  acceptanceLog: [{
    providerId: { type: mongoose.Schema.Types.ObjectId },
    providerModel: { type: String },
    acceptedAt: { type: Date, default: Date.now }
  }],
  date: {
    type: Date,
    default: Date.now
  },
  otp: { type: String }
  ,
  // Track provider GPS points while request is active so server can validate distance/fare
  locationHistory: [
    {
      lat: { type: Number },
      lng: { type: Number },
      timestamp: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model('ServiceRequest', ServiceRequestSchema);