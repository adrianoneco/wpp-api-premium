import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || (process.env.MONGO_HOST ? `mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT || '27017'}` : null);

const connections: Record<string, mongoose.Connection> = {};

async function getConnection(instanceName: string): Promise<mongoose.Connection> {
  if (!MONGO_URI) throw new Error('MONGO_URI not configured');
  if (!connections[instanceName]) {
    const conn = mongoose.createConnection(MONGO_URI, { dbName: instanceName });
    connections[instanceName] = conn;
    // Wait for the connection to be ready (or fail)
    await conn.asPromise();
  }
  return connections[instanceName];
}

const noLid = {
  validator: (v: string) => !v || !v.endsWith('@lid'),
  message: 'wa_id must not end with @lid',
};

const contactSchema = new mongoose.Schema({
  wa_id: { type: String, index: true, unique: true, sparse: true, validate: noLid },
  phone: String,
  name: String,
  pushname: String,
  profile_pic: String,
  raw: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  wa_id: { type: String, index: true, unique: true, sparse: true, validate: noLid },
  session: String,
  chat_id: String,
  author: String,
  phone: String,
  body: String,
  timestamp: Number,
  is_media: Boolean,
  media_path: String,
  raw: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const fileSchema = new mongoose.Schema({
  wa_id: { type: String, index: true, unique: true, sparse: true, validate: noLid },
  original_name: String,
  stored_path: String,
  session: String,
  mime: String,
  size: Number,
  created_at: { type: Date, default: Date.now }
}, { timestamps: true });

const scheduleSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  message: { type: String },
  type: { type: String, enum: ['text', 'file', 'image', 'location', 'link'], default: 'text' },
  payload: { type: mongoose.Schema.Types.Mixed },
  scheduledAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending', 'sent', 'failed', 'cancelled'], default: 'pending', index: true },
  result: { type: mongoose.Schema.Types.Mixed },
  error: { type: String },
  sentAt: { type: Date },
}, { timestamps: true });

// Each instance gets its own database; collections are simply "contacts", "messages", "files"
export async function getModels(instanceName: string) {
  const conn = await getConnection(instanceName);

  const Contact = conn.models['contacts'] || conn.model('contacts', contactSchema, 'contacts');
  const Message = conn.models['messages'] || conn.model('messages', messageSchema, 'messages');
  const File = conn.models['files'] || conn.model('files', fileSchema, 'files');
  const Schedule = conn.models['schedules'] || conn.model('schedules', scheduleSchema, 'schedules');

  return { Contact, Message, File, Schedule };
}

export default { getModels };
