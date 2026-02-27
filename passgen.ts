import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const SESSION_NAME = process.env.SESSION_NAME || '';
const SECRET_KEY = process.env.SECRET_KEY || '';
// support PHONE_NUMBER or PHONE_TEST_NUMBER
const PHONE_NUMBER = process.env.PHONE_NUMBER || process.env.PHONE_TEST_NUMBER || '';

if (!SESSION_NAME || !SECRET_KEY || !PHONE_NUMBER) {
    console.error('Missing required environment variables. Please set SESSION_NAME, SECRET_KEY and PHONE_NUMBER (or PHONE_TEST_NUMBER).');
    process.exit(1);
}

// ensure token/session storage exists and create an empty session file if missing
import * as fs from 'fs';
import * as path from 'path';

const TOKENS_DIR = path.join(process.cwd(), 'data', 'tokens');
if (!fs.existsSync(TOKENS_DIR)) {
    fs.mkdirSync(TOKENS_DIR, { recursive: true });
}

const sessionFile = path.join(TOKENS_DIR, `${SESSION_NAME}.data.json`);
if (!fs.existsSync(sessionFile)) {
    try {
        fs.writeFileSync(sessionFile, JSON.stringify({ createdAt: new Date().toISOString() }, null, 2));
        console.log(`Created session token file: ${sessionFile}`);
    } catch (e) {
        console.warn('Could not create session file', e);
    }
}

function base64url(input: Buffer | string) {
    const b = typeof input === 'string' ? Buffer.from(input) : input;
    return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}


export function generateBearerToken() {
    const uuid = crypto.randomUUID();
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60; // token valid for 1 hour

    const payload = {
        session: SESSION_NAME,
        phone: PHONE_NUMBER,
        uuid,
        iat,
        exp,
    };

    const payloadJson = JSON.stringify(payload);
    const payloadB64 = base64url(payloadJson);

    const sig = crypto.createHmac('sha256', SECRET_KEY).update(payloadB64).digest();
    const signature = base64url(sig);

    // return URL-safe token in format: payload.signature
    return `${payloadB64}.${signature}`;
}

// When run directly, print the token and Authorization header example
if (require.main === module) {
    const token = generateBearerToken();
    console.log('Authorization: Bearer ' + token);
}

// When run directly, also try to notify running server to start the session (best-effort)
if (require.main === module) {
    try {
        // best-effort: call /api/:secretkey/start-all to trigger server to start sessions
        const { exec } = require('child_process');
        const serverPort = process.env.PORT || '21465';
        const secret = process.env.SECRET_KEY || 'THISISMYSECURETOKEN';
        const url = `http://localhost:${serverPort}/api/${secret}/start-all`;
        exec(`curl -s -X POST "${url}" || true`, (err: any, stdout: any, stderr: any) => {
            if (!err) console.log('Notified server to start sessions');
        });
    } catch (e) {}
}