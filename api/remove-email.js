const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method allowed' });
  }

  const { cookie } = req.body;
  if (!cookie) {
    return res.status(400).json({ status: 'error', message: 'Missing .ROBLOSECURITY cookie' });
  }

  try {
    // Step 1: Get CSRF token
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`
      }
    });

    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) throw new Error('Failed to get CSRF token');

    // Step 2: Delete email
    const deleteRes = await fetch('https://accountinformation.roblox.com/v1/email', {
      method: 'DELETE',
      headers: {
        'X-CSRF-TOKEN': csrfToken,
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await deleteRes.json();

    if (deleteRes.ok) {
      return res.status(200).json({ status: 'success', message: 'Email removed successfully.' });
    } else {
      const errMsg = data?.errors?.[0]?.message || 'Unknown error';
      return res.status(400).json({ status: 'error', message: errMsg });
    }
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};
