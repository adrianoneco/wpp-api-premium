const fs = require('fs');
const path = require('path');
require('dotenv').config();

const session = process.env.SESSION_NAME || 'default';
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
const tokensDir = path.join(DATA_DIR, 'tokens');
const tokenFile = path.join(tokensDir, `${session}.data.json`);
const userDataDir = path.join(DATA_DIR, 'userDataDir', session);

try {
  if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir, { recursive: true });
  if (!fs.existsSync(tokenFile))
    fs.writeFileSync(tokenFile, JSON.stringify({}));

  if (!fs.existsSync(userDataDir))
    fs.mkdirSync(userDataDir, { recursive: true });

  console.log('Session initialized:');
  console.log('  session:', session);
  console.log('  token file:', tokenFile);
  console.log('  userDataDir:', userDataDir);
} catch (err) {
  console.error('Failed to initialize session:', err.message);
  process.exit(1);
}

// Try to notify running server to start sessions (best-effort)
try {
  const { exec } = require('child_process');
  const serverPort = process.env.PORT || '21465';
  const secret = process.env.SECRET_KEY || 'THISISMYSECURETOKEN';
  const url = `http://localhost:${serverPort}/api/${secret}/start-all`;
  exec(`curl -s -X POST "${url}" || true`, (err, stdout, stderr) => {
    if (err) return;
    if (stdout) console.log('Notified server to start sessions');
  });
} catch (e) {}
