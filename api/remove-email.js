const fetch = require('node-fetch');
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { cookie } = req.body;
  if (!cookie) {
    return res.status(400).json({ message: 'Missing .ROBLOSECURITY cookie' });
  }

  try {
    // Get CSRF Token
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
      }
    });

    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) {
      return res.status(403).json({ message: 'Failed to fetch CSRF token' });
    }

    // Send request to remove email
    const response = await fetch('https://accountinformation.roblox.com/v1/email/remove', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': csrfToken,
        'Content-Type': 'application/json',
        'Cookie': `.ROBLOSECURITY=${cookie}`
      }
    });

    if (response.ok) {
      return res.status(200).json({ success: true, message: '✅ Email removed successfully' });
    } else {
      const err = await response.json();
      return res.status(response.status).json({ success: false, message: err.errors?.[0]?.message || '❌ Failed to remove email' });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: '🚫 Server error' });
  }
}
