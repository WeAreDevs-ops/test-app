const fetch = require('node-fetch');

module.exports = async function (req, res) {
  const { cookie } = req.body;

  if (!cookie || !cookie.startsWith('_|')) {
    return res.status(400).json({ status: 'error', message: 'Invalid or missing cookie.' });
  }

  try {
    // Get CSRF token
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    });

    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) throw new Error('Failed to get CSRF token');

    // Send DELETE request to remove email
    const deleteRes = await fetch('https://accountinformation.roblox.com/v1/email', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
        'Cookie': `.ROBLOSECURITY=${cookie}`
      }
    });

    if (deleteRes.status === 200) {
      return res.json({ status: 'success', message: 'Email removed successfully.' });
    } else {
      const err = await deleteRes.text();
      return res.status(deleteRes.status).json({ status: 'fail', message: `Unknown error: ${err}` });
    }
  } catch (err) {
    return res.status(500).json({ status: 'fail', message: 'Request failed.' });
  }
};
