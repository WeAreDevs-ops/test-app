const https = require('https');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cookie = req.body?.cookie;
  if (!cookie) {
    return res.status(400).json({ error: 'Missing .ROBLOSECURITY cookie' });
  }

  // 1. Get email info
  const emailInfo = await robloxRequest({
    method: 'GET',
    hostname: 'accountinformation.roblox.com',
    path: '/v1/email',
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
    },
  });

  if (!emailInfo || !emailInfo.verified || !emailInfo.emailAddressId) {
    return res.status(400).json({ error: 'No verified email found on account' });
  }

  const emailId = emailInfo.emailAddressId;

  // 2. Get CSRF token
  const csrfData = await robloxRequest({
    method: 'POST',
    hostname: 'accountinformation.roblox.com',
    path: `/v1/email/${emailId}/remove`,
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
    },
    includeCsrf: true,
  });

  const csrfToken = csrfData?.csrfToken;
  if (!csrfToken) {
    return res.status(500).json({ error: 'Failed to retrieve CSRF token' });
  }

  // 3. Actually remove email
  const removeResult = await robloxRequest({
    method: 'POST',
    hostname: 'accountinformation.roblox.com',
    path: `/v1/email/${emailId}/remove`,
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      'X-CSRF-TOKEN': csrfToken,
    },
  });

  if (removeResult?.errors) {
    return res.status(500).json({ error: 'Failed to remove email', detail: removeResult.errors });
  }

  return res.status(200).json({ success: true, message: 'Email successfully removed' });
};

// Helper function to handle HTTPS requests and CSRF token grabbing
function robloxRequest({ method, hostname, path, headers = {}, includeCsrf = false }) {
  return new Promise((resolve) => {
    const options = {
      method,
      hostname,
      path,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      const csrfToken = res.headers['x-csrf-token'];

      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (includeCsrf && csrfToken) {
            resolve({ ...parsed, csrfToken });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });
}
