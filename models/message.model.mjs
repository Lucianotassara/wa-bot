import mongoose from 'mongoose';

const { Schema } = mongoose;

const IdSchema = new Schema({
    fromMe:      { type: Boolean },
    remote:      { type: String },   // plain JID string in wwebjs >=1.30
    id:          { type: String },
    _serialized: { type: String },
}, { _id: false });

const MessageSchema = new Schema({
    mediaKey:     { type: String },
    id:           { type: IdSchema, required: true },
    ack:          { type: Number },
    hasMedia:     { type: Boolean },
    body:         { type: String },
    type:         { type: String },
    timestamp:    { type: Number },
    from:         { type: String },
    to:           { type: String },
    author:       { type: String },
    isForwarded:  { type: Boolean },
    isStatus:     { type: Boolean },
    isStarred:    { type: Boolean },
    broadcast:    { type: String },
    fromMe:       { type: Boolean },
    hasQuotedMsg: { type: Boolean },
    location:     { type: String },
    vCards:       [],
    mentionedIds: [],
    links:        { type: String },
    created:      { type: Date, default: Date.now },
}, { strict: false });  // tolerate extra fields from future wwebjs versions

const Message = mongoose.model('Message', MessageSchema);
export default Message;
