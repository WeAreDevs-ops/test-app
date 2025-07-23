const https = require("https");
const chromium = require("chrome-aws-lambda");
const puppeteer = require("puppeteer-core");

// 🔧 Replace these with your actual logic if not already present
const getCsrfToken = async (cookie) => {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "auth.roblox.com",
        path: "/v2/logout",
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
        },
      },
      (res) => {
        const token = res.headers["x-csrf-token"];
        if (token) return resolve(token);
        reject(new Error("Failed to get CSRF token"));
      }
    );
    req.on("error", reject);
    req.end();
  });
};

const fetchEmail = async (cookie, csrf) => {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "accountinformation.roblox.com",
        path: "/v1/email",
        method: "GET",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "X-CSRF-TOKEN": csrf,
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(JSON.parse(body)));
      }
    );
    req.on("error", reject);
    req.end();
  });
};

const deleteEmail = async (cookie, csrf, emailId, challengeId = "") => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      emailAddress: emailId,
      challengeId: challengeId || null,
    });

    const req = https.request(
      {
        hostname: "accountinformation.roblox.com",
        path: "/v1/email/remove",
        method: "POST",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "X-CSRF-TOKEN": csrf,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(JSON.parse(body)));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
};

// Dummy challenge continuation (implement as needed)
const continueChallenge = async (cookie, csrf, challengeId, metadata) => {
  return {
    success: true,
  };
};

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
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    console.log("🔑 Getting CSRF token...");
    const csrfToken = await getCsrfToken(cookie);
    console.log("✅ CSRF token:", csrfToken);

    console.log("📧 Fetching email info...");
    const emailInfo = await fetchEmail(cookie, csrfToken);
    console.log("📬 Email info:", emailInfo);

    if (!emailInfo || (!emailInfo.emailId && !emailInfo.emailAddress)) {
      await browser.close();
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
        await browser.close();
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: "Challenge continuation failed",
          challenge: challengeResult,
        }));
      }
    }

    if (result && result.errors && result.errors.length > 0) {
      await browser.close();
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        error: result.errors[0].message || "Challenge required",
        code: result.errors[0].code,
      }));
    }

    await browser.close();
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
