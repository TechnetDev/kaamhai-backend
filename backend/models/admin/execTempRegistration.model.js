import mongoose from 'mongoose';

const tempExecutiveTeamSchema = new mongoose.Schema({
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
        default: ''
    },
    role: {
        type: String,
        default: 'executive'
    },
    verificationSid: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '180s',
    },
});

const TempExecutiveTeam = mongoose.model('TempExecutiveTeam', tempExecutiveTeamSchema);
export default TempExecutiveTeam;