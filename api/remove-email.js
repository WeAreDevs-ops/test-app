const express = require('express');
const https = require('https');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Function to make Roblox API requests with CSRF support
function robloxRequest({ method, hostname, path, cookie, body = null, csrfToken = '' }) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      hostname,
      path,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Roblox/WinInet',
        'Accept': 'application/json',
      },
    };

    if (csrfToken) {
      options.headers['X-CSRF-TOKEN'] = csrfToken;
    }

    const req = https.request(options, (res) => {
      let data = '';
      const csrf = res.headers['x-csrf-token'];

      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          resolve({ ...json, csrfToken: csrf });
        } catch (err) {
          resolve({ error: 'Failed to parse response', raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject({ error: 'Request failed', details: err });
    });

    if (body) {
      req.write(JSON.stringify(body));
    } else {
      req.write('{}');
    }

    req.end();
  });
}

// Function to remove email using correct Roblox endpoint
async function removeEmail(cookie) {
  // First request to get CSRF token
  const preflight = await robloxRequest({
    method: 'POST',
    hostname: 'accountinformation.roblox.com',
    path: '/v1/email/remove',
    cookie,
  });

  if (!preflight.csrfToken) {
    return { error: 'Failed to fetch CSRF token' };
  }

  // Second request: actually remove the email
  const final = await robloxRequest({
    method: 'POST',
    hostname: 'accountinformation.roblox.com',
    path: '/v1/email/remove',
    cookie,
    csrfToken: preflight.csrfToken,
  });

  return final;
}

// API route
app.post('/remove-email', async (req, res) => {
  const cookie = req.body.cookie;
  if (!cookie) return res.status(400).json({ error: 'No cookie provided' });

  try {
    const result = await removeEmail(cookie);

    if (result.errors) {
      return res.status(400).json({ error: 'Failed', details: result.errors });
    }

    res.status(200).json({ success: true, message: 'Email removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
