import crypto from 'crypto';

function hashString(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex').toUpperCase();
}

function normalizeIdField(obj: any) {
  if (!obj || typeof obj !== 'object') return;

  // If object has id as string
  if (typeof obj.id === 'string') {
    obj.id = hashString(obj.id);
  }

  // If object has id as object with _serialized
  if (obj.id && typeof obj.id === 'object') {
    const sid = obj.id._serialized || obj.id.id || obj.id;
    if (typeof sid === 'string') {
      const h = hashString(sid);
      if (obj.id._serialized) obj.id._serialized = h;
      else if (obj.id.id) obj.id.id = h;
      else obj.id = h;
    }
  }

  // Also handle messageId fields
  if (typeof obj.messageId === 'string')
    obj.messageId = hashString(obj.messageId);

  // return for chaining
  return obj;
}

export function transformMessageIds(data: any) {
  try {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => transformMessageIds(item));
    }

    if (typeof data === 'object') {
      // shallow normalize current object
      normalizeIdField(data);

      // recursively traverse
      for (const k of Object.keys(data)) {
        const v = (data as any)[k];
        if (v && typeof v === 'object') {
          (data as any)[k] = transformMessageIds(v);
        }
      }
      return data;
    }

    return data;
  } catch (e) {
    return data;
  }
}

export default {
  transformMessageIds,
};
