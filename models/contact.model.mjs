import mongoose from 'mongoose';

let Schema = mongoose.Schema;

let ContactIdSchema = new Schema({
    server: { type: String },
    user: { type: String },
    _serialized: { type: String }
});

let ContactSchema = new Schema({
    id: {
        type: ContactIdSchema,
        required: true
    },
    number: { type: String },
    isBusiness: { type: Boolean },
    isEnterprise: { type: Boolean },
    labels: [],
    name: { type: String },
    pushname: { type: String },
    sectionHeader: { type: String },
    shortName: { type: String },
    statusMute: { type: Boolean },
    type: { type: String },
    verifiedLevel: { type: String },
    verifiedName: { type: String },
    isMe: { type: Boolean },
    isUser: { type: Boolean },
    isGroup: { type: Boolean },
    isWAContact: { type: Boolean },
    isMyContact: { type: Boolean },
    isBlocked: { type: Boolean }
});

const Contact = mongoose.model("Contact", ContactSchema);
export default Contact;
