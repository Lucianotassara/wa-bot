import mongoose from 'mongoose';

const RecipientSchema = new mongoose.Schema({
    to:           { type: String, required: true },
    placeholders: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const ScheduledMessageSchema = new mongoose.Schema({
    jobId:       { type: String, required: true, unique: true, index: true },
    scheduledAt: { type: Date,   required: true, index: true },
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'cancelled'],
        default: 'pending',
        index: true,
    },
    type:       { type: String, enum: ['single', 'bulk'], required: true },
    recipients: [RecipientSchema],
    message:    { type: String, required: true },
    media:      { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt:  { type: Date, default: Date.now },
});

const ScheduledMessage = mongoose.model('ScheduledMessage', ScheduledMessageSchema);
export default ScheduledMessage;
