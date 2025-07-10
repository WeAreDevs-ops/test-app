export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cookie } = req.body;
  if (!cookie || !cookie.includes('.ROBLOSECURITY')) {
    return res.status(400).json({ error: 'Missing or invalid .ROBLOSECURITY cookie' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `.ROBLOSECURITY=${cookie}`,
    'User-Agent': 'Roblox/WinInet',
  };

  // Step 1: Get CSRF token
  let csrfToken = '';
  try {
    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', {
      method: 'POST',
      headers,
    });
    csrfToken = csrfRes.headers.get('x-csrf-token');
    if (!csrfToken) throw new Error('Missing CSRF token');
    headers['X-CSRF-TOKEN'] = csrfToken;
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get CSRF token' });
  }

  // Step 2: Get email ID
  let emailId = null;
  try {
    const emailRes = await fetch('https://accountinformation.roblox.com/v1/email', {
      method: 'GET',
      headers,
    });
    const data = await emailRes.json();
    if (data?.emailAddress && data?.emailAddressVerified && data?.id) {
      emailId = data.id;
    } else {
      return res.status(400).json({ error: 'No email found on account or email not verified' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch email info' });
  }

  // Step 3: Remove email
  try {
    const removeRes = await fetch('https://accountinformation.roblox.com/v1/email/remove', {
      method: 'POST',
      headers,
      body: JSON.stringify({ emailId }),
    });

    const removeData = await removeRes.json();
    if (removeRes.ok) {
      return res.status(200).json({ message: '✅ Email successfully removed!' });
    } else {
      return res.status(400).json({ error: removeData?.errors?.[0]?.message || 'Failed to remove email' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error during email removal' });
  }
}
