import mongoose from 'mongoose';

const jobPostApplicationSchema = new mongoose.Schema({
    adId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPost', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeInfo', required: true },
    status: {
        type: String,
        enum: ['shortlisted', 'rejected', 'under review'],
        default: 'under review'
    }
}, { timestamps: true });

export default mongoose.model('JobPostApplication', jobPostApplicationSchema);                                                                          