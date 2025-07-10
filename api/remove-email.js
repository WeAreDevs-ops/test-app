// Vercel Serverless API: /api/remove-email.js
const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const cookie = req.body.cookie;
  if (!cookie || !cookie.includes('.ROBLOSECURITY=')) {
    return res.status(400).json({ error: 'Missing or invalid .ROBLOSECURITY cookie' });
  }

  try {
    const csrfToken = await getCsrfToken(cookie);
    const emailInfo = await fetchEmail(cookie, csrfToken);

    if (!emailInfo.emailId) {
      return res.status(400).json({ error: 'No email linked or failed to fetch emailId' });
    }

    const result = await deleteEmail(cookie, csrfToken, emailInfo.emailId);
    return res.status(200).json({ success: true, message: 'Email removed successfully', result });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
};

function getCsrfToken(cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'auth.roblox.com',
      path: '/v2/logout',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      }
    }, res => {
      const token = res.headers['x-csrf-token'];
      if (token) return resolve(token);
      reject(new Error('Failed to get CSRF token'));
    });

    req.on('error', reject);
    req.end();
  });
}

function fetchEmail(cookie, csrfToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'GET',
      hostname: 'apis.roblox.com',
      path: '/account/email',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'X-CSRF-TOKEN': csrfToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON from fetchEmail'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function deleteEmail(cookie, csrfToken, emailId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ emailId });
    const req = https.request({
      method: 'DELETE',
      hostname: 'apis.roblox.com',
      path: '/account/email/verification',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'X-CSRF-TOKEN': csrfToken,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Accept': 'application/json',
      }
    }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON from deleteEmail'));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
             }
