const fetch = require('node-fetch');

module.exports = async function (req, res) {
  const { cookie } = req.body;

  if (!cookie || !cookie.startsWith('_|')) {
    return res.status(400).json({ status: 'fail', message: 'Invalid or missing cookie.' });
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
    if (!csrfToken) throw new Error('❌ Failed to get CSRF token');

    // Step 2: Make DELETE request with body and token
    const response = await fetch('https://accountinformation.roblox.com/v1/email', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Cookie': `.ROBLOSECURITY=${cookie}`
      },
      body: JSON.stringify({})
    });

    if (response.status === 200) {
      return res.json({ status: 'success', message: '✅ Email removed successfully.' });
    }

    const text = await response.text();
    return res.status(response.status).json({
      status: 'fail',
      message: `❌ Unknown error: ${text}`
    });

  } catch (err) {
    return res.status(500).json({ status: 'fail', message: '🔥 Request failed or was blocked.' });
  }
};
