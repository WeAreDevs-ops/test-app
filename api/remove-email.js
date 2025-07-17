import https from "https";

export default async function handler(req, res) {
  const cookie = req.headers.cookieHeader;
  if (!cookie) return res.status(400).json({ error: "Missing .ROBLOSECURITY cookie" });

  const csrfToken = await getCSRFToken(cookie);
  if (!csrfToken) return res.status(500).json({ error: "Failed to get CSRF token" });

  const emailInfo = await getEmail(cookie, csrfToken);
  if (!emailInfo || emailInfo.error) return res.status(500).json({ error: "Failed to fetch email info", details: emailInfo });

  console.log("Email info response:", emailInfo);

  const removeResponse = await removeEmail(cookie, csrfToken);
  console.log("Remove email result:", removeResponse);

  if (removeResponse.status === 403 && removeResponse.headers["rblx-challenge-id"]) {
    console.log("⚠️ Challenge required. Attempting to continue challenge...");

    const challengeId = removeResponse.headers["rblx-challenge-id"];
    const challengeMetadata = removeResponse.headers["rblx-challenge-metadata"];

    const result = await continueChallenge(cookie, csrfToken, challengeId, challengeMetadata);
    console.log("Challenge continue result:", result);

    return res.status(result.status || 500).json({ message: "Challenge continue attempted", result });
  }

  return res.status(removeResponse.status).json(removeResponse);
}

function getCSRFToken(cookie) {
  return new Promise((resolve) => {
    const req = https.request({
      method: "POST",
      hostname: "auth.roblox.com",
      path: "/v2/logout",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
      },
    }, (res) => {
      resolve(res.headers["x-csrf-token"]);
    });
    req.end();
  });
}

function getEmail(cookie, csrfToken) {
  return new Promise((resolve) => {
    const req = https.request({
      method: "GET",
      hostname: "accountsettings.roblox.com",
      path: "/v1/email",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "X-CSRF-TOKEN": csrfToken,
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: "Invalid JSON", raw: data });
        }
      });
    });
    req.end();
  });
}

function removeEmail(cookie, csrfToken) {
  return new Promise((resolve) => {
    const req = https.request({
      method: "PATCH",
      hostname: "accountsettings.roblox.com",
      path: "/v1/email",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "X-CSRF-TOKEN": csrfToken,
        "Content-Type": "application/json",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.write("{}");
    req.end();
  });
}

function continueChallenge(cookie, csrfToken, challengeId, challengeMetadata) {
  return new Promise((resolve, reject) => {
    console.log("Attempting to continue challenge using latest Roblox challenge API...");

    if (!challengeMetadata) {
      return resolve({ success: false, error: "No challenge metadata provided" });
    }

    let parsedMetadata;
    try {
      parsedMetadata = JSON.parse(Buffer.from(challengeMetadata, "base64").toString("utf8"));
    } catch (e) {
      return resolve({ success: false, error: "Failed to decode challenge metadata" });
    }

    const payload = JSON.stringify({
      challengeId: challengeId,
      challengeMetadata: parsedMetadata,
    });

    console.log("Challenge payload:", payload);

    const req = https.request({
      method: "POST",
      hostname: "apis.roblox.com",
      path: "/challenge/v1/continue",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "X-CSRF-TOKEN": csrfToken,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log("Challenge continue response status:", res.statusCode);
        console.log("Challenge continue response data:", data);
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode === 200 || res.statusCode === 204) {
            resolve({ success: true, data: parsed });
          } else {
            resolve({
              success: false,
              status: res.statusCode,
              data: parsed,
              error: `HTTP ${res.statusCode} Data: ${data}`,
            });
          }
        } catch (e) {
          resolve({ success: false, error: `Invalid JSON response: ${data}` });
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
              }
