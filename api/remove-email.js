import https from 'https';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const cookie = req.body.cookie;
  if (!cookie) return res.status(400).json({ error: 'Missing .ROBLOSECURITY' });

  try {
    // Step 1: Get CSRF token
    const csrfToken = await getCSRF(cookie);

    // Step 2: Attempt to remove email
    const success = await removeEmail(cookie, csrfToken);

    if (success) {
      return res.status(200).json({ message: '✅ Email removed successfully.' });
    } else {
      return res.status(400).json({ error: '❌ Email not found or already removed.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}

function getCSRF(cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'accountinformation.roblox.com',
      path: '/v1/email/remove',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      }
    }, (res) => {
      const token = res.headers['x-csrf-token'];
      if (token) resolve(token);
      else reject(new Error('Failed to get CSRF token'));
    });

    req.on('error', reject);
    req.end(); // No body needed, this is just for CSRF
  });
}

function removeEmail(cookie, csrfToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'accountinformation.roblox.com',
      path: '/v1/email/remove',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'X-CSRF-TOKEN': csrfToken
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          if (json.success === true || !json.errors) {
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          reject(new Error(`Unexpected response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write('{}'); // Must send an empty body
    req.end();
  });
}
