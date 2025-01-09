import mongoose from 'mongoose';

const employerTempRegistrationSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true },
    name: { type: String, required: true },
    referralCode: { type: String, sparse: true },
    verificationSid: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: '60s' }
});

const EmployerTempRegistration = mongoose.model('EmployerTempRegistration', employerTempRegistrationSchema);
export default EmployerTempRegistration;