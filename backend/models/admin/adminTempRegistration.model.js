import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Temp Admin Schema
const tempAdminSchema = new Schema({
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    phoneNumber: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        default: '',
    },
    role: {
       type: [String],
        enum: ['employee management', 'employer management', 'customer support'],
        default: []
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'ExecutiveTeam',
        required: true,
    },
        otp: {
        type: String,
        required: true, // Assuming OTP is required for verification
    },
    verificationSid: {
        type: String,
        required: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '180s',
    },
});

const TempAdmin = model('TempAdmin', tempAdminSchema);
export default TempAdmin;