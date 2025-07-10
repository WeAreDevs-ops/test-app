import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST allowed' });
  }

  const { cookie } = req.body;
  if (!cookie) {
    return res.status(400).json({ message: 'Missing .ROBLOSECURITY cookie' });
  }

  try {
    const xcsrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    });

    const xcsrfToken = xcsrfRes.headers.get('x-csrf-token');
    if (!xcsrfToken) {
      return res.status(403).json({ message: 'Failed to get CSRF token' });
    }

    const removeRes = await fetch('https://accountinformation.roblox.com/v1/email/remove', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': xcsrfToken,
        'Content-Type': 'application/json',
        'Cookie': `.ROBLOSECURITY=${cookie}`
      }
    });

    if (removeRes.status === 200) {
      return res.status(200).json({ message: '✅ Email removed successfully' });
    } else {
      const data = await removeRes.json();
      return res.status(removeRes.status).json({ message: data.errors?.[0]?.message || '❌ Failed to remove email' });
    }
  } catch (err) {
    return res.status(500).json({ message: '⚠️ Internal error', error: err.message });
  }
}
