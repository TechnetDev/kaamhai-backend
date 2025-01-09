import mongoose from 'mongoose';
import ExecutiveTeam from './executiveTeam.model.js';
import bcrypt from 'bcrypt';

const { Schema, model } = mongoose;

const adminSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: ''
    },
    role: {
        type: [String],
        enum: ['employee management', 'employer management', 'customer support'],
        default: []
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'ExecutiveTeam',
        required: true
    }
});

adminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
}

adminSchema.pre('save', async function(next) {
    if(!this.isModified('password')){
        return next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

const Admin = model('Admin', adminSchema);
export default Admin;