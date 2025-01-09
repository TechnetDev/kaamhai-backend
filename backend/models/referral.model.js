import mongoose from 'mongoose';

const ReferralClickSchema = new mongoose.Schema({
  refCode: { type: String, required: true },
  deviceId: { type: String, required: true, unique: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const ReferralClick = mongoose.model('ReferralClick', ReferralClickSchema);