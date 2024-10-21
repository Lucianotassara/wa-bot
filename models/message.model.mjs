import mongoose from 'mongoose';

let Schema = mongoose.Schema;

let RemoteSchema = new Schema({
    server: { type: String },
    user: { type: String },
    _serialized: { type: String }
});

let IdSchema = new Schema({
    fromMe: { type: Boolean },
    remote: {
        type: RemoteSchema,
        required: true
    },
    id: { type: String },
    _serialized: { type: String }
});

let MessageSchema = new Schema({
    mediaKey: { type: String },
    id: {
        type: IdSchema,
        required: true
    },
    ack: { type: Number },
    hasMedia: { type: Boolean },
    body: { type: String },
    type: { type: String },
    timestamp: { type: Number },
    from: { type: String },
    to: { type: String },
    author: { type: String },
    isForwarded: { type: Boolean },
    isStatus: { type: Boolean },
    isStarred: { type: Boolean },
    broadcast: { type: String },
    fromMe: { type: Boolean },
    hasQuotedMsg: { type: Boolean },
    location: { type: String },
    vCards: [],
    mentionedIds: [],
    links: { type: String },
    created: {
        type: Date,
        default: Date.now
    }
});

const Message = mongoose.model("Message", MessageSchema);
export default Message;
