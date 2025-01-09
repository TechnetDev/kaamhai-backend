import mongoose from 'mongoose';

const { Schema } = mongoose;

const LeaveRequestSchema = new Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeInfo',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
         leaveType: {
    type: String,
    enum: ['paid', 'unpaid'],
  },
  totalDays: {
    type: Number,
    required: true
  },
        totalLeavesAllowed: {
    type: Number,
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  admin: {
type: Boolean,
default: false
}
}, { timestamps: true });

// Export the LeaveRequest model
const LeaveRequest = mongoose.model('LeaveRequest', LeaveRequestSchema);

export default LeaveRequest;