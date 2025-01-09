import mongoose from 'mongoose';

const employerAuthSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        unique: true,
        trim: true,
        required: true
    },
    name: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['approved', 'rejected', 'under evaluation'],
        default: 'under evaluation',
      },

});

employerAuthSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

employerAuthSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const EmployerAuthModel = mongoose.model('EmployerAuthModel', employerAuthSchema);

export default EmployerAuthModel;