const fetch = require('node-fetch');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { cookie } = req.body;
  if (!cookie) {
    return res.status(400).json({ message: 'Missing cookie' });
  }

  try {
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`
      }
    });

    const csrfToken = csrfRes.headers.get('x-csrf-token');

    const res2 = await fetch('https://accountinformation.roblox.com/v1/email', {
      method: 'DELETE',
      headers: {
        'X-CSRF-TOKEN': csrfToken,
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'Content-Type': 'application/json'
      }
    });

    if (res2.status === 200) {
      return res.json({ message: '✅ Successfully removed email!' });
    } else {
      const err = await res2.json();
      return res.status(res2.status).json({ message: `❌ Failed: ${err.errors?.[0]?.message || 'Unknown error'}` });
    }
  } catch (err) {
    return res.status(500).json({ message: '❌ Server error: ' + err.message });
  }
}

module.exports = handler;
