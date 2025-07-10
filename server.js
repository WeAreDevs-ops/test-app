const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static("public")); // Serve index.html from /public

app.post("/api/remove-email", async (req, res) => {
  const cookie = req.body.cookie;
  if (!cookie) return res.status(400).json({ status: "error", message: "Missing cookie" });

  try {
    const csrfRes = await fetch("https://auth.roblox.com/v2/logout", {
      method: "POST",
      headers: {
        Cookie: `.ROBLOSECURITY=${cookie}`,
      }
    });

    const csrfToken = csrfRes.headers.get("x-csrf-token");
    if (!csrfToken) return res.status(403).json({ status: "error", message: "CSRF token missing" });

    const removeRes = await fetch("https://accountinformation.roblox.com/v1/email", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
        "Cookie": `.ROBLOSECURITY=${cookie}`
      }
    });

    if (removeRes.status === 200) {
      return res.json({ status: "success", message: "✅ Email removed!" });
    } else {
      const errData = await removeRes.json();
      return res.status(removeRes.status).json({ status: "error", message: errData.errors?.[0]?.message || "Failed to remove email" });
    }
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Server error" });
  }
});

// Fallback: always serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
