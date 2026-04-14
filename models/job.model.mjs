import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
    jobId:  { type: String, required: true, unique: true, index: true },
    status: {
        type: String,
        enum: ['queued', 'running', 'done', 'failed'],
        default: 'queued',
        index: true,
    },
    type:   { type: String, enum: ['single', 'bulk'], required: true },
    total:  { type: Number, default: 0 },
    sent:   { type: Number, default: 0 },
    errors: [{ type: String }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const Job = mongoose.model('Job', JobSchema);
export default Job;
