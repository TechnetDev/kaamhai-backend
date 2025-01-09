import mongoose from 'mongoose';

const EmployeePaymentSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeInfo' },
    formattedId: { type: String },
    employerId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessAccount' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    joiningDate: { type: Date },
    jobTitle: { type: String },
    grossSalary: { type: Number },
    advancePayment: { type: Number, default: 0 },
    deductions: {
      totalLiabilities: { type: Number, default: 0 },
      unpaidLeaveDeductions: { type: Number, default: 0 },
      final: { type: Number, default: 0 },
      breakdown: {
        liabilities: { type: Number, default: 0 },
        unpaidLeaves: { type: Number, default: 0 },
      },
    },
    balance: { type: Number },
    deductionCredit: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    modeOfPayment: { type: String },
    totalAmount: { type: Number },
  },
  { timestamps: true }
);

const EmployeePayment = mongoose.model('EmployeePayment', EmployeePaymentSchema);
export default EmployeePayment;