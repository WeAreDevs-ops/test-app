const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Health check
app.get('/', (req, res) => {
  res.send('✅ API is live');
});

// POST endpoint to remove email
app.post('/api/remove-email', async (req, res) => {
  const cookie = req.body.cookie;

  if (!cookie || !cookie.includes('_|')) {
    return res.status(400).json({ status: 'error', message: 'Invalid .ROBLOSECURITY cookie' });
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
    if (!csrfToken) throw new Error('CSRF token not received');

    // Step 2: Request email removal
    const removeRes = await fetch('https://accountinformation.roblox.com/v1/email/remove', {
      method: 'POST',
      headers: {
        'x-csrf-token': csrfToken,
        'Content-Type': 'application/json',
        Cookie: `.ROBLOSECURITY=${cookie}`
      }
    });

    const data = await removeRes.json();

    if (removeRes.ok) {
      return res.json({ status: 'success', message: '✅ Email removed successfully.' });
    } else {
      return res.status(400).json({ status: 'fail', message: data.errors?.[0]?.message || '❌ Failed to remove email' });
    }

  } catch (error) {
    return res.status(500).json({ status: 'error', message: '⚠️ Server Error: ' + error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
