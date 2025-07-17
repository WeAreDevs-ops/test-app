// Node.js API: /api/remove-email.js
const https = require("https");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Only POST allowed" }));
  }

  let cookie = req.body.cookie;
  if (!cookie) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Missing .ROBLOSECURITY cookie" }));
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

    console.log("📧 Fetching email information...");
    const emailInfo = await fetchEmail(cookie, csrfToken);
    console.log("Email info response:", emailInfo);

    if (!emailInfo || (!emailInfo.emailId && !emailInfo.emailAddress)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: "No email linked or failed to fetch email information",
        debug: emailInfo,
      }));
    }

    console.log("🗑️ Attempting to remove email...");
    const emailToDelete = emailInfo.emailId || emailInfo.emailAddress;
    let result = await deleteEmail(cookie, csrfToken, emailToDelete);

    if (result && result.needsChallenge) {
      console.log("⚠️ Challenge required. Attempting to continue challenge...");
      try {
        const challengeResult = await continueChallenge(
          cookie,
          csrfToken,
          result.realChallengeId, // 🛠️ Use the correct challengeId from headers
          result.challengeMetadata,
        );

        console.log("Challenge continue result:", challengeResult);

        if (challengeResult.success) {
          console.log("✅ Challenge passed. Retrying email removal...");
          result = await deleteEmail(cookie, csrfToken, emailToDelete, result.realChallengeId);
        } else {
          console.log("❌ Challenge continue failed:", challengeResult);
          res.writeHead(403, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({
            error: "Challenge continuation failed",
            needsChallenge: true,
            challengeId: result.realChallengeId,
            challengeType: result.challengeType,
            challengeDetails: challengeResult,
          }));
        }
      } catch (challengeError) {
        console.error("❌ Challenge handling error:", challengeError);
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: "Challenge handling failed: " + challengeError.message,
          needsChallenge: true,
        }));
      }
    }

    if (result && result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: error.message || "Challenge is required to authorize the request",
        code: error.code,
        needsChallenge: true,
      }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      success: true,
      message: "Email removal request processed successfully",
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
    }, (res) => {
      const token = res.headers["x-csrf-token"];
      if (token) return resolve(token);
      reject(new Error("Failed to get CSRF token"));
    });

    req.on("error", reject);
    req.end();
  });
}

function fetchEmail(cookie, csrfToken) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: "GET",
      hostname: "accountsettings.roblox.com",
      path: "/v1/email",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
        "X-CSRF-TOKEN": csrfToken,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log("Email fetch response status:", res.statusCode);
        console.log("Email fetch response data:", data);
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid JSON from fetchEmail: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

function deleteEmail(cookie, csrfToken, emailAddress, challengeId = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ emailAddress: "" });

    const headers = {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      "X-CSRF-TOKEN": csrfToken,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    };

    if (challengeId) {
      headers["rblx-challenge-id"] = challengeId;
      headers["rblx-challenge-type"] = "twostepverification";
      headers["rblx-challenge-metadata"] = "{}";
    }

    const req = https.request({
      method: "PATCH",
      hostname: "accountsettings.roblox.com",
      path: "/v1/email",
      headers,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        console.log("Delete email response status:", res.statusCode);
        console.log("Delete email response data:", data);
        console.log("Delete email response headers:", res.headers);

        try {
          const parsed = data ? JSON.parse(data) : { success: true };
          if (res.statusCode === 403 && parsed.errors) {
            const challengeError = parsed.errors.find(
              (e) => e.code === 0 || e.message?.toLowerCase().includes("challenge"),
            );
            if (challengeError) {
              const headerChallengeId = res.headers["rblx-challenge-id"];
              const challengeType = res.headers["rblx-challenge-type"];
              const challengeMetadata = res.headers["rblx-challenge-metadata"];

              if (headerChallengeId && challengeType) {
                resolve({
                  needsChallenge: true,
                  realChallengeId: headerChallengeId, // ✅ CORRECTED
                  challengeType,
                  challengeMetadata,
                  error: "Challenge verification required",
                });
                return;
              }
            }
          }

          resolve(parsed);
        } catch (e) {
          resolve({ success: res.statusCode === 200 || res.statusCode === 204 });
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function continueChallenge(cookie, csrfToken, challengeId, challengeMetadata) {
  return new Promise((resolve, reject) => {
    console.log("Attempting to continue challenge using latest Roblox challenge API...");

    if (!challengeMetadata) {
      return resolve({ success: false, error: "No challenge metadata provided" });
    }

    const payload = JSON.stringify({
      challengeId: challengeId,
      challengeMetadata: challengeMetadata,
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
