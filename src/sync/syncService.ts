export async function syncSession(client: any, req: any) {
  const session: string = client.session || process.env.SESSION_NAME || 'default';
  const log = (level: string, msg: string) => {
    try { req.logger?.[level]?.(msg); } catch { console.log(`[sync] ${level}: ${msg}`); }
  };

  // Verify client is connected
  try {
    const connected = await client.isConnected();
    if (!connected) {
      log('warn', `Sync [${session}]: client not connected, skipping sync`);
      return;
    }
  } catch (e: any) {
    log('warn', `Sync [${session}]: cannot verify connection, skipping sync: ${e?.message || e}`);
    return;
  }

  // Initialize MongoDB models
  let mongoModels: any;
  try {
    const mongo = await import('../util/db/mongo');
    mongoModels = await mongo.getModels(session);
    log('info', `Sync [${session}]: MongoDB connected (db: ${session})`);
  } catch (e: any) {
    log('error', `Sync [${session}]: MongoDB init failed, aborting: ${e?.message || e}`);
    return;
  }

  const { Contact, Message } = mongoModels;

  // ─── Step 1: Save contacts ───────────────────────────────────────────
  let contacts: any[] = [];
  try {
    contacts = (await client.getAllContacts()) || [];
    log('info', `Sync [${session}]: fetched ${contacts.length} contacts`);

    for (const c of contacts) {
      try {
        const rawId = c?.id?._serialized
          || (c?.id?.user ? `${c.id.user}@${c.id.server || 'c.us'}` : '')
          || (typeof c?.id === 'string' ? c.id : '');
        if (!rawId) continue;

        const phone = rawId.split('@')[0];
        const name = c.name || c.verifiedName || c.pushname || null;

        await Contact.updateOne(
          { wa_id: rawId },
          { $set: { wa_id: rawId, name, pushname: c.pushname || null, phone, raw: c } },
          { upsert: true }
        );
      } catch (e: any) {
        log('error', 'Error saving contact: ' + (e?.message || e));
      }
    }
    log('info', `Sync [${session}]: contacts saved`);
  } catch (e: any) {
    log('error', 'Failed to fetch/save contacts: ' + (e?.message || e));
  }

  // ─── Step 2: Save conversations ─────────────────────────────────────
  let chats: any[] = [];
  try {
    if (typeof client.listChats === 'function') {
      chats = (await client.listChats()) || [];
    } else if (typeof client.getAllChats === 'function') {
      chats = (await client.getAllChats()) || [];
    }
    log('info', `Sync [${session}]: fetched ${chats.length} chats`);
  } catch (e: any) {
    log('error', 'Failed to fetch chats: ' + (e?.message || e));
  }

  const mediaMessageIds: string[] = [];

  for (const chat of chats) {
    const chatId = chat?.id?._serialized || (typeof chat?.id === 'string' ? chat.id : '');
    if (!chatId) continue;

    let msgs: any[] = [];
    try {
      if (typeof client.getMessages === 'function') {
        msgs = (await client.getMessages(chatId, { count: -1 })) || [];
      } else if (typeof client.getAllMessagesInChat === 'function') {
        msgs = (await client.getAllMessagesInChat(chatId, true, false)) || [];
      }
    } catch (e: any) {
      log('error', `Failed to fetch messages for ${chatId}: ` + (e?.message || e));
      continue;
    }

    for (const msg of msgs) {
      try {
        const msgId = msg?.id?._serialized || msg?.id || `${chatId}-${msg?.t || Date.now()}`;
        const isMedia = !!(msg.mimetype || msg.isMedia || msg.isMMS);

        // Extract phone number
        const rawSrc = msg.to || msg.author || msg.from || chatId || '';
        let phone = '';
        if (typeof rawSrc === 'string') {
          phone = rawSrc.includes('@') ? rawSrc.split('@')[0] : rawSrc;
        } else {
          const s = (rawSrc?._serialized || rawSrc?.id || '').toString();
          phone = s.includes('@') ? s.split('@')[0] : s;
        }

        await Message.updateOne(
          { wa_id: msgId },
          {
            $setOnInsert: {
              wa_id: msgId,
              session,
              chat_id: chatId,
              author: msg.author || msg.from || null,
              phone: phone || null,
              body: msg.body || msg.caption || null,
              timestamp: msg.t || null,
              is_media: isMedia,
              media_path: null,
              raw: msg,
            },
          },
          { upsert: true }
        );

        if (isMedia) {
          mediaMessageIds.push(msgId);
        }
      } catch (e: any) {
        log('error', 'Failed to save message: ' + (e?.message || e));
      }
    }
  }
  log('info', `Sync [${session}]: messages saved (${mediaMessageIds.length} with media)`);

  // ─── Step 3: Schedule downloads via BullMQ ──────────────────────────
  try {
    const { downloadQueue } = await import('../queues/client');

    // 3a. Contact profile photos (only @c.us contacts)
    let picCount = 0;
    for (const c of contacts) {
      const contactId = c?.id?._serialized
        || (c?.id?.user ? `${c.id.user}@${c.id.server || 'c.us'}` : '');
      if (!contactId || !contactId.endsWith('@c.us')) continue;

      await downloadQueue.add(
        'profile-pic',
        { type: 'profile-pic', contactId, session },
        {
          attempts: 3,
          backoff: { type: 'fixed', delay: 60000 },
          removeOnComplete: true,
          removeOnFail: false,
          jobId: `pic-${session}-${contactId}`,
        }
      );
      picCount++;
    }
    log('info', `Sync [${session}]: enqueued ${picCount} profile-pic downloads`);

    // 3b. Media attachments
    for (const msgId of mediaMessageIds) {
      await downloadQueue.add(
        'media',
        { type: 'media', msgId, session },
        {
          attempts: 3,
          backoff: { type: 'fixed', delay: 60000 },
          removeOnComplete: true,
          removeOnFail: false,
          jobId: `media-${session}-${msgId}`,
        }
      );
    }
    log('info', `Sync [${session}]: enqueued ${mediaMessageIds.length} media downloads`);
  } catch (e: any) {
    log('error', 'Failed to enqueue download jobs: ' + (e?.message || e));
  }

  log('info', `Sync finished for session ${session}`);
}

export default { syncSession };
