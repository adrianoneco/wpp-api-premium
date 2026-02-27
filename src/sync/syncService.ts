import fs from 'fs';
import path from 'path';
import pool from '../util/db/postgres';
import config from '../config';

export async function ensureSchema(logger?: any) {
  try {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT,
      pushname TEXT,
      phone TEXT,
      raw JSONB
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session TEXT,
      chat_id TEXT,
      author TEXT,
      phone TEXT,
      body TEXT,
      timestamp BIGINT,
      is_media BOOLEAN,
      media_path TEXT,
      raw JSONB
    );
  `);
    return true;
  } catch (e: any) {
    try {
      let msg = '';
      // Handle AggregateError (common when multiple connection attempts fail)
      if (typeof AggregateError !== 'undefined' && e instanceof AggregateError) {
        msg = (e as AggregateError).errors
          .map((er: any) => (er && er.message ? er.message : String(er)))
          .join('; ');
      } else {
        msg = e && e.message ? e.message : String(e);
      }
      const out = 'Postgres unavailable, skipping DB sync: ' + msg;
      if (logger && typeof logger.warn === 'function') {
        logger.warn(out);
      } else {
        console.warn(out);
      }
    } catch { }
    return false;
  }
}

async function saveFile(
  session: string,
  msgId: string,
  buffer: Buffer,
  ext = ''
): Promise<string> {
  // If STORAGE_PATH is configured, store attachments there; otherwise use project data/uploads
  const storagePath = process.env.STORAGE_PATH || null;
  if (storagePath) {
    // write to a temporary location and enqueue upload job
    const tmpDir = path.join(process.cwd(), 'tmp', 'uploads');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filename = `${msgId}${ext ? '.' + ext : ''}`;
    const tmpFile = path.join(tmpDir, filename);
    fs.writeFileSync(tmpFile, buffer);
    // enqueue upload job but let the storage service generate the UUID-based name
    // we provide an empty destPath so storage will use session + generated UUID filename
    // compute fallback destination (used only if enqueue fails)
    const fallbackDestDir = path.join(storagePath, session);
    const fallbackDest = path.join(fallbackDestDir, filename);
    try {
      const { uploadQueue } = await import('../queues/client');
      await uploadQueue.add(
        'upload',
        { tmpPath: tmpFile, destPath: '', session },
        { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true }
      );
    } catch (err) {
      // fallback: try to move synchronously to storage/session
      try {
        if (!fs.existsSync(fallbackDestDir)) fs.mkdirSync(fallbackDestDir, { recursive: true });
        fs.renameSync(tmpFile, fallbackDest);
        return fallbackDest;
      } catch (e) {
        return tmpFile;
      }
    }
    return tmpFile;
  }

  const dataDir = (config as any).dataDir || './data';
  const uploadsDir = path.join(process.cwd(), dataDir, 'uploads', session);
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `${msgId}${ext ? '.' + ext : ''}`;
  const full = path.join(uploadsDir, filename);
  fs.writeFileSync(full, buffer);
  return full;
}

export async function syncSession(client: any, req: any) {
  try {
    const dbAvailable = await ensureSchema(req?.logger);

    // Sync contacts with @c.us
    try {
      const contacts = (await client.getAllContacts()) || [];
      for (const c of contacts) {
        try {
          const rawId =
            c && (c.id || c.id?.user || c._serialized)
              ? c.id ||
              c._serialized ||
              (c.id && c.id.user ? c.id.user + '@c.us' : '')
              : '';
          if (String(rawId).endsWith('@c.us')) {
            const id = typeof rawId === 'string' ? rawId : String(rawId);
            const name = c.name || c.notify || c.pushname || null;
            const phone = id.split('@')[0];
            if (dbAvailable) {
              try {
                await pool.query(
                  `INSERT INTO contacts(id,name,pushname,phone,raw) VALUES($1,$2,$3,$4,$5)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, pushname = EXCLUDED.pushname, phone = EXCLUDED.phone, raw = EXCLUDED.raw;`,
                  [id, name, c.pushname || null, phone, JSON.stringify(c)]
                );
              } catch (dbErr: any) {
                req.logger.error(
                  'Failed to insert/update contact: ' +
                  (dbErr && dbErr.message ? dbErr.message : String(dbErr)) +
                  ' contact=' +
                  id
                );
              }
            }
          }
        } catch (inner: any) {
          req.logger.error(
            'Error processing contact during sync: ' +
            (inner && inner.message ? inner.message : String(inner))
          );
        }
      }
    } catch (eContacts: any) {
      req.logger.error(
        'Failed to fetch contacts for sync: ' +
        (eContacts && eContacts.message
          ? eContacts.message
          : String(eContacts))
      );
    }

    // Sync chats and messages
    // Prefer using the non-deprecated `listChats`. If unavailable, fall back
    // to older APIs (`getAllChatsWithMessages`, `getAllChats`).
    let chats: any[] = [];
    try {
      if (typeof client.listChats === 'function') {
        // request basic list of chats; messages will be fetched per-chat
        try {
          chats = (await client.listChats({})) || [];
        } catch (le: any) {
          req.logger.error(
            'listChats failed: ' + (le && le.message ? le.message : String(le))
          );
          chats = [];
        }
      } else if (typeof client.getAllChatsWithMessages === 'function') {
        // legacy method that returns chats with messages
        chats = (await client.getAllChatsWithMessages(true)) || [];
      } else if (typeof client.getAllChats === 'function') {
        chats = (await client.getAllChats()) || [];
      } else {
        chats = [];
      }
    } catch (e: any) {
      req.logger.error(
        'Failed to fetch chats for sync: ' + (e && e.message ? e.message : e)
      );
      chats = [];
    }

    for (const chat of chats) {
      const chatId =
        chat && chat.id ? chat.id._serialized || chat.id : chat.id || chat;

      // Normalize messages array: try multiple possible sources
      let msgs: any[] = [];
      if (Array.isArray(chat.msgs)) msgs = chat.msgs;
      else if (typeof client.getAllMessagesInChat === 'function' && chatId)
        msgs = (await client.getAllMessagesInChat(chatId)) || [];

      if (!Array.isArray(msgs) || msgs.length === 0) continue;

      for (const msg of msgs) {
        const msgId = msg.id
          ? msg.id._serialized || msg.id
          : `${chatId}-${msg.t}`;
        let mediaPath: string | null = null;
        let isMedia = !!(msg['mimetype'] || msg.isMedia || msg.isMMS);
        if (isMedia) {
          try {
            const buffer = await client.decryptFile(msg);
            const ext = msg.mimetype ? msg.mimetype.split('/').pop() : '';
            mediaPath = await saveFile(client.session, msgId, buffer, ext);
          } catch (e) {
            // fallback: try downloadMedia
            try {
              const buf2 = await client.downloadMedia(msg);
              const ext = msg.mimetype ? msg.mimetype.split('/').pop() : '';
              mediaPath = await saveFile(client.session, msgId, buf2, ext);
            } catch (e2) {
              mediaPath = null;
            }
          }
        }

        if (dbAvailable) {
          try {
            // derive a normalized phone number (strip @* suffixes)
            const rawPhoneSource = msg.author || msg.from || chatId || '';
            const phone = typeof rawPhoneSource === 'string' ? rawPhoneSource.split('@')[0] : '';
            await pool.query(
              `INSERT INTO messages(id,session,chat_id,author,phone,body,timestamp,is_media,media_path,raw)
                             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                             ON CONFLICT (id) DO NOTHING;`,
              [
                msgId,
                client.session,
                chatId,
                msg.author || msg.from || null,
                phone || null,
                msg.body || msg.caption || null,
                msg.t || Date.now(),
                isMedia,
                mediaPath,
                JSON.stringify(msg),
              ]
            );
          } catch (e: any) {
            req.logger.error(
              'Failed to insert message into DB: ' +
              (e && e.message ? e.message : e)
            );
          }
        }
      }
    }

    req.logger.info(`Sync finished for session ${client.session}`);
  } catch (e: any) {
    try {
      // log as much detail as possible
      if (e && e.stack) req.logger.error('Sync error: ' + e.stack);
      else
        req.logger.error(
          'Sync error: ' + (e && e.message ? e.message : JSON.stringify(e))
        );
    } catch (er) {
      // fallback: console
      try {
        console.error('Sync fatal error', e, er);
      } catch { }
    }
  }
}
