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

  // Clean the cookie - remove any prefix if present
  cookie = cookie.trim();
  if (cookie.includes(".ROBLOSECURITY=")) {
    cookie = cookie.split(".ROBLOSECURITY=")[1];
  }

  // Basic validation - Roblox security cookies are typically long alphanumeric strings
  if (cookie.length < 50) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: "Invalid .ROBLOSECURITY cookie format" }),
    );
  }

  try {
    console.log("ðŸ”‘ Obtaining CSRF token...");
    const csrfToken = await getCsrfToken(cookie);
    console.log("CSRF Token obtained:", csrfToken ? "Yes" : "No");

    console.log("ðŸ“§ Fetching email information...");
    const emailInfo = await fetchEmail(cookie, csrfToken);
    console.log("Email info response:", emailInfo);

    if (!emailInfo || (!emailInfo.emailId && !emailInfo.emailAddress)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error:
            "No email linked to this account or failed to fetch email information",
          debug: emailInfo,
        }),
      );
    }

    console.log("ðŸ—‘ï¸ Attempting to remove email...");
    const emailToDelete = emailInfo.emailId || emailInfo.emailAddress;
    const result = await deleteEmail(cookie, csrfToken, emailToDelete);

    // Check if the deletion was successful
    if (result && result.errors && result.errors.length > 0) {
      const error = result.errors[0];
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error:
            error.message || "Challenge is required to authorize the request",
          code: error.code,
          needsChallenge: true,
        }),
      );
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        success: true,
        message: "Email removal request processed successfully",
        result,
      }),
    );
  } catch (err) {
    console.error("âŒ Error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        error: err.message || "Unknown server error",
        type: "server_error",
      }),
    );
  }
};

function getCsrfToken(cookie) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "POST",
        hostname: "auth.roblox.com",
        path: "/v2/logout",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
        },
      },
      (res) => {
        const token = res.headers["x-csrf-token"];
        if (token) return resolve(token);
        reject(new Error("Failed to get CSRF token"));
      },
    );

    req.on("error", reject);
    req.end();
  });
}

function fetchEmail(cookie, csrfToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: "GET",
        hostname: "accountsettings.roblox.com",
        path: "/v1/email",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "X-CSRF-TOKEN": csrfToken,
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
      (res) => {
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
      },
    );

    req.on("error", reject);
    req.end();
  });
}

function deleteEmail(cookie, csrfToken, emailAddress) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      emailAddress: "",
    });

    const req = https.request(
      {
        method: "PATCH",
        hostname: "accountsettings.roblox.com",
        path: "/v1/email",
        headers: {
          Cookie: `.ROBLOSECURITY=${cookie}`,
          "X-CSRF-TOKEN": csrfToken,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          console.log("Delete email response status:", res.statusCode);
          console.log("Delete email response data:", data);
          try {
            const parsed = data ? JSON.parse(data) : { success: true };
            resolve(parsed);
          } catch (e) {
            resolve({
              success: res.statusCode === 200 || res.statusCode === 204,
            });
          }
        });
      },
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
               }
