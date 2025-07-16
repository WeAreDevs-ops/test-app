import fetch from 'node-fetch';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);
const brotliDecompress = promisify(zlib.brotliDecompress);
const inflate = promisify(zlib.inflate);

// CONFIGURATION
const cookie = 'YOUR_ROBLOSECURITY_COOKIE_HERE';
const csrfUrl = 'https://auth.roblox.com/';
const emailInfoUrl = 'https://accountinformation.roblox.com/v1/email';
const deleteEmailUrl = 'https://accountinformation.roblox.com/v1/email/remove';
const challengeApiUrl = 'https://auth.roblox.com/v2/challenge';

// OBTAIN CSRF
async function getCsrfToken() {
  const res = await fetch(csrfUrl, {
    method: 'POST',
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`
    }
  });
  const token = res.headers.get('x-csrf-token');
  if (!token) throw new Error('Failed to fetch CSRF token');
  return token;
}

// FETCH EMAIL INFO
async function fetchEmail(csrfToken) {
  const res = await fetch(emailInfoUrl, {
    headers: {
      'X-CSRF-TOKEN': csrfToken,
      'Cookie': `.ROBLOSECURITY=${cookie}`
    }
  });
  const data = await res.json();
  return data;
}

// ATTEMPT EMAIL DELETE
async function deleteEmail(csrfToken) {
  const res = await fetch(deleteEmailUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrfToken,
      'Cookie': `.ROBLOSECURITY=${cookie}`
    }
  });

  const buffer = await res.buffer();
  let decompressed;

  try {
    decompressed = await brotliDecompress(buffer);
  } catch {
    try {
      decompressed = await gunzip(buffer);
    } catch {
      try {
        decompressed = await inflate(buffer);
      } catch {
        console.warn('❌ Failed all decompression methods, fallback to raw base64');
        return {
          challengeBlob: buffer.toString('base64'),
          status: res.status
        };
      }
    }
  }

  const json = JSON.parse(decompressed.toString());
  return { challengeBlob: json.dataExchangeBlob || buffer.toString('base64'), status: res.status };
}

// SEND CHALLENGE
async function solveChallenge(csrfToken, challengeId, blob) {
  const payload = {
    challengeId: challengeId,
    actionType: 'EmailUpdate.Remove',
    challengeMetadata: {
      dataExchangeBlob: blob
    }
  };

  const res = await fetch(challengeApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': csrfToken,
      'Cookie': `.ROBLOSECURITY=${cookie}`
    },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  return { status: res.status, result };
}

// MAIN FLOW
(async () => {
  try {
    console.log('🔐 Obtaining CSRF token...');
    const csrf = await getCsrfToken();
    console.log('✅ CSRF token obtained.');

    console.log('📧 Fetching email info...');
    const info = await fetchEmail(csrf);
    console.log('✅ Email info:', info);

    console.log('🗑️ Attempting email deletion...');
    const { challengeBlob, status } = await deleteEmail(csrf);

    if (status === 403) {
      const challengeId = `roblox_403_${Date.now()}`;
      console.log('🔧 Solving challenge...');
      const { status: chStatus, result } = await solveChallenge(csrf, challengeId, challengeBlob);

      if (chStatus === 200) {
        console.log('✅ Challenge solved. Retrying email removal...');
        const retry = await deleteEmail(csrf);
        if (retry.status === 200) {
          console.log('✅ Email successfully removed.');
        } else {
          console.log('❌ Retry failed:', retry.status);
        }
      } else {
        console.log('❌ Challenge solve failed:', result);
      }
    } else if (status === 200) {
      console.log('✅ Email removed without challenge.');
    } else {
      console.log('❌ Unexpected status:', status);
    }

  } catch (err) {
    console.error('💥 Error:', err);
  }
})();
