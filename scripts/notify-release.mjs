// The release's push (.github/workflows/android-release.yml, after it is published): a data message {version} to the
// Firebase Cloud Messaging topic "releases" the app subscribes to (update/ReleasePushService.kt) — it says
// «Доступна версия 1.0.N» by its rules (newer, once per version, once a day). No server: the service account's key
// signs a token here, FCM's HTTP v1 API delivers.
// Usage: FIREBASE_SERVICE_ACCOUNT='<the key's JSON>' node scripts/notify-release.mjs 1.0.183
import { createSign } from 'node:crypto';

const TOPIC = 'releases';
const version = process.argv[2];
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!version) throw new Error('usage: notify-release.mjs <version>');
if (!raw) {
  console.log('FIREBASE_SERVICE_ACCOUNT is not set: no push');
  process.exit(0);
}
const key = JSON.parse(raw);

const b64 = (s) => Buffer.from(s).toString('base64url');

/** An OAuth access token for FCM: a JWT signed with the service account's key, exchanged at Google. */
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signature = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${signature}` }),
  });
  if (!res.ok) throw new Error(`token: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

const res = await fetch(`https://fcm.googleapis.com/v1/projects/${key.project_id}/messages:send`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
  // data only: the app decides whether to say it; high — delivered to a sleeping phone
  body: JSON.stringify({ message: { topic: TOPIC, data: { version }, android: { priority: 'high' } } }),
});
if (!res.ok) throw new Error(`send: HTTP ${res.status} ${await res.text()}`);
console.log(`pushed ${version} to "${TOPIC}"`);
