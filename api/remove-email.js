const https = require('https');

function robloxRequest({ method, hostname, path, cookie, csrfToken = '', includeCsrf = false }) {
  return new Promise((resolve) => {
    const options = {
      method,
      hostname,
      path,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Roblox/WinInet',
        'Accept': 'application/json',
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      },
    };

    if (csrfToken) {
      options.headers['X-CSRF-TOKEN'] = csrfToken;
    }

    const req = https.request(options, (res) => {
      let data = '';
      const csrf = res.headers['x-csrf-token'];

      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          if (includeCsrf && csrf) {
            resolve({ ...json, csrfToken: csrf });
          } else {
            resolve(json);
          }
        } catch (e) {
          resolve({ error: 'Failed to parse response', raw: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err);
      resolve({ error: 'Request failed' });
    });

    req.write('{}');
    req.end();
  }).catch((err) => {
    console.error('robloxRequest error:', err);
    if (err.error === 'Request failed') {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(robloxRequest({ ...err.options, csrfToken: '' }));
        }, 1000);
      });
    }
    throw err;
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookie = req.body?.cookie;
  if (!cookie || !cookie.startsWith('_|WARNING')) {
    return res.status(400).json({ error: 'Missing or invalid .ROBLOSECURITY cookie' });
  }

  try {
    // Step 1: Check if email is present
    const emailInfo = await robloxRequest({
      method: 'GET',
      hostname: 'accountinformation.roblox.com',
      path: `/v1/users/${cookie}/email`,
      cookie,
    });

    if (!emailInfo) {
      return res.status(400).json({ error: 'No email found on account or invalid cookie' });
    }

    // Step 2: Get CSRF token
    const csrfRes = await robloxRequest({
      method: 'POST',
      hostname: 'accountinformation.roblox.com',
      path: '/v1/email/remove',
      cookie,
      includeCsrf: true,
    });

    const csrfToken = csrfRes.csrfToken;
    if (!csrfToken) {
      return res.status(400).json({ error: 'Failed to get CSRF token' });
    }

    // Step 3: Send final remove request
    const removeRes = await robloxRequest({
      method: 'POST',
      hostname: 'accountinformation.roblox.com',
      path: '/v1/email/remove',
      cookie,
      csrfToken,
    });

    if (removeRes.errors && removeRes.errors.length > 0) {
      return res.status(400).json({ error: 'Failed to remove email', details: removeRes.errors });
    }

    return res.status(200).json({ success: true, message: 'Email successfully removed' });
  } catch (err) {
    console.error('Unexpected error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
