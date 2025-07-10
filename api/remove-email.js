// ... (previous code)

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
          if (includeCsrf) {
            resolve(json);
          } else {
            resolve({ ...json, csrfToken: csrf });
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

function removeEmail(cookie) {
  const request = {
    method: 'POST',
    hostname: 'api.roblox.com',
    path: '/user/managed-emails/remove',
    cookie: cookie,
    includeCsrf: true,
  };

  return robloxRequest(request)
    .then((response) => {
      if (response.error) {
        throw response.error;
      }
      return response;
    })
    .then((response) => {
      const email = response.email;
      if (!email) {
        throw new Error('Failed to get email');
      }
      const url = `https://www.roblox.com/user/${response.userId}/managed-emails`;
      const payload = {
        csrfToken: response.csrfToken,
        email: '',
      };

      return robloxRequest({
        method: 'POST',
        hostname: 'api.roblox.com',
        path: url,
        cookie: cookie,
        csrfToken: response.csrfToken,
        body: JSON.stringify(payload),
      });
    })
    .then((response) => {
      if (response.error) {
        throw response.error;
      }
      return response;
    })
    .then((response) => {
      console.log('Email removed successfully:', response);
      return response;
    })
    .catch((err) => {
      console.error('Error removing email:', err);
      throw err;
    });
}

// ... (previous code)

document.getElementById('removeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cookie = document.getElementById('cookieInput').value.trim();
  const resultDiv = document.getElementById('result');
  resultDiv.textContent = "⏳ Processing...";

  try {
    const res = await removeEmail(cookie);
    if (res.error) {
      if (res.error === 'Request failed') {
        resultDiv.textContent = `❌ Request failed: ${res.raw}`;
      } else {
        resultDiv.textContent = `❌ Failed: ${res.error || 'Unknown error'}`;
      }
    } else {
      resultDiv.textContent = `✅ ${res.message}`;
    }
  } catch (err) {
    resultDiv.textContent = `❌ Request failed: ${err.message}`;
  }
});
