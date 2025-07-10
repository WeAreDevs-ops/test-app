const https = require('https');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { cookie } = req.body;
  if (!cookie) return res.status(400).json({ success: false, message: 'Missing cookie' });

  try {
    // Step 1: Get CSRF Token
    const csrfRes = await fetch('https://accountsettings.roblox.com/v1/email', {
      method: 'POST',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
      }
    });

    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) throw new Error('Failed to retrieve CSRF token');

    // Step 2: Send DELETE request to remove email
    const delRes = await fetch('https://accountinformation.roblox.com/v1/email/remove', {
      method: 'POST',
      headers: {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'X-CSRF-TOKEN': csrfToken,
        'Content-Type': 'application/json'
      },
    });

    const result = await delRes.json();

    if (delRes.status === 200) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(404).json({ success: false, message: JSON.stringify(result) });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
