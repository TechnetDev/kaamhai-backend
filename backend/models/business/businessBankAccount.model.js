import mongoose from 'mongoose';

const businessBankAccountSchema = new mongoose.Schema({
  accountNumber: {
    type: String,
    unique: true,

  },
  accountHolderName: {
    type: String,

  },
  ifscCode: {
    type: String,

  },
  upiId: {
    type: String,
    default: '',
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BusinessAccount', 
  },
}, { timestamps: true });

const BusinessBankAccountDetails = mongoose.model('BusinessBankAccountDetails', businessBankAccountSchema);

export default BusinessBankAccountDetails;