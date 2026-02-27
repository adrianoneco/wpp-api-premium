import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
let ffprobePath: string | undefined;
try {
  // prefer optional ffprobe-static if available; otherwise ffmpeg will look for system ffprobe
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // @ts-ignore
  const _ffprobe = require('ffprobe-static');
  ffprobePath = _ffprobe && _ffprobe.path;
} catch (e) {
  ffprobePath = undefined;
}
import { parseFile } from 'music-metadata';
import { formatEventLog } from '../util/logFormat';
import crypto from 'crypto';
// Mongo will be used for file metadata
let mongoGetModels: any = null;
try {
  // lazy require to avoid startup failures when MONGO not configured
  const mg = require('../util/db/mongo');
  mongoGetModels = mg.getModels;
} catch (e) {
  mongoGetModels = null;
}

if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

const router = express.Router();

const STORAGE_SECRET = process.env.STORAGE_SECRET_KEY || '';
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(process.cwd(), 'data', 'uploads');

function checkKey(req: express.Request) {
  const header = (req.headers['x-storage-key'] as string) || '';
  const queryKey = (req.query?.key as string) || '';
  return !!STORAGE_SECRET && (header === STORAGE_SECRET || queryKey === STORAGE_SECRET);
}

function safeJoin(root: string, target: string) {
  const resolved = path.resolve(root, target);
  if (!resolved.startsWith(path.resolve(root))) throw new Error('Invalid path');
  return resolved;
}

const upload = multer({ dest: path.join(process.cwd(), 'tmp', 'storage') });

// List files in a session
// #swagger.tags = ["Storage"]
router.get('/list/:session', (req, res) => {
  /* #swagger.parameters['session'] = { description: 'session name' } */
  if (!checkKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { session } = req.params;
  const dir = path.join(STORAGE_PATH, session);
  if (!fs.existsSync(dir)) return res.json({ files: [] });
  const entries = fs.readdirSync(dir).map((name) => {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    return { name, size: stat.size, mtime: stat.mtime, isDirectory: stat.isDirectory() };
  });
  return res.json({ files: entries });
});

// Upload single file (used by worker)
// Expects form-data: file, session, destPath
// #swagger.tags = ["Storage"]
router.post('/upload', (upload.single('file') as any), async (req, res) => {
  if (!checkKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const file = req.file as Express.Multer.File | undefined;
  const session = (req.body.session as string) || '';
  const destPath = (req.body.destPath as string) || '';
  if (!file) return res.status(400).json({ error: 'no file' });
  try {
    let root = path.resolve(STORAGE_PATH);
    // try creating configured storage root; fall back to project-local data/storage on permission errors
    try {
      fs.mkdirSync(root, { recursive: true });
    } catch (mkErr: any) {
      console.warn('Cannot access STORAGE_PATH, falling back to ./data/storage:', mkErr?.message || mkErr);
      root = path.resolve(process.cwd(), 'data', 'storage');
      fs.mkdirSync(root, { recursive: true });
    }

    // Generate UUID name for stored file
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname) || '';
    const filename = id + ext;

    const destRel = destPath ? path.join(destPath, filename) : path.join(session, filename);
    const target = safeJoin(root, destRel);
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(file.path, target);

    // insert metadata into MongoDB per-instance files collection (best-effort)
    try {
      const relPath = path.relative(root, target);
      if (mongoGetModels) {
        const { File } = await mongoGetModels(session || (process.env.SESSION_NAME || 'default'));
        await File.updateOne({ wa_id: id }, { $set: { wa_id: id, original_name: file.originalname, stored_path: relPath, session: session || null, mime: file.mimetype || null, size: file.size || 0 } }, { upsert: true });
      }
    } catch (dbErr: any) {
      console.warn('Failed to insert file metadata into MongoDB:', dbErr?.message || dbErr);
    }

    return res.json({ ok: true, id, path: target });
  } catch (err: any) {
    // cleanup temp
    try {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch {}
    // ensure error is visible in logs for easier debugging
    console.error('Storage upload error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Upload multiple files
// #swagger.tags = ["Storage"]
router.post('/upload/multiple', (upload.array('files') as any), (req, res) => {
  if (!checkKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const files = req.files as Express.Multer.File[] | undefined;
  const session = (req.body.session as string) || '';
  const destDir = (req.body.destDir as string) || session;
  if (!files || files.length === 0) return res.status(400).json({ error: 'no files' });
  const saved: string[] = [];
  try {
    let root = path.resolve(STORAGE_PATH);
    try {
      fs.mkdirSync(root, { recursive: true });
    } catch (mkErr: any) {
      console.warn('Cannot access STORAGE_PATH, falling back to ./data/storage:', mkErr?.message || mkErr);
      root = path.resolve(process.cwd(), 'data', 'storage');
      fs.mkdirSync(root, { recursive: true });
    }
    const targetDir = safeJoin(root, destDir || session);
    for (const f of files) {
      const target = safeJoin(root, path.join(destDir || session, f.originalname));
      fs.renameSync(f.path, target);
      saved.push(target);
    }
    return res.json({ ok: true, files: saved });
  } catch (err: any) {
    // cleanup
    for (const f of files || []) {
      try {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      } catch {}
    }
    console.error('Storage multiple upload error:', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get single file
router.get('/files/:session/:filename', (req, res) => {
  if (!checkKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { session, filename } = req.params;
  try {
    const filePath = safeJoin(STORAGE_PATH, path.join(session, filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    return res.sendFile(filePath);
  } catch (err: any) {
    return res.status(400).json({ error: err.message || err });
  }
});

// Delete file
// #swagger.tags = ["Storage"]
router.delete('/files/:session/:filename', (req, res) => {
  if (!checkKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { session, filename } = req.params;
  try {
    const filePath = safeJoin(STORAGE_PATH, path.join(session, filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
    fs.unlinkSync(filePath);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || err });
  }
});

// Get metadata (images, video, audio)
// #swagger.tags = ["Storage"]
router.get('/metadata/:session/:filename', async (req, res) => {
  if (!checkKey(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { session, filename } = req.params;
  try {
    const filePath = safeJoin(STORAGE_PATH, path.join(session, filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

    const ext = path.extname(filename).toLowerCase();
    const result: any = { path: filePath };

    if (['.jpg', '.jpeg', '.png', '.webp', '.tiff'].includes(ext)) {
      const img = sharp(filePath);
      const meta = await img.metadata();
      // create thumbnail
      const thumbPath = filePath + '.thumb.jpg';
      await img.resize(320).jpeg().toFile(thumbPath);
      result.type = 'image';
      result.metadata = meta;
      result.thumbnail = thumbPath;
    } else if (['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext)) {
      // ffprobe
      const probe = await new Promise<any>((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      // generate thumbnail
      const thumbPath = filePath + '.thumb.jpg';
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .screenshots({ timestamps: ['50%'], filename: path.basename(thumbPath), folder: path.dirname(thumbPath), size: '320x?' })
          .on('end', resolve)
          .on('error', reject);
      });
      result.type = 'video';
      result.metadata = probe;
      result.thumbnail = thumbPath;
    } else if (['.mp3', '.wav', '.aac', '.m4a', '.flac'].includes(ext)) {
      const mm = await parseFile(filePath);
      // codecs via ffprobe
      const probe = await new Promise<any>((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
      result.type = 'audio';
      result.metadata = { format: mm.format, common: mm.common, probe };
    } else {
      // fallback: return basic stat
      const stat = fs.statSync(filePath);
      result.type = 'file';
      result.metadata = { size: stat.size, mtime: stat.mtime };
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || err });
  }
});

export default router;
