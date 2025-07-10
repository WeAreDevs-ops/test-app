import express from "express";
import removeEmailHandler from "./api/remove-email.js";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());
app.post("/api/remove-email", removeEmailHandler);

// Optional: add root route for checking
app.get("/", (req, res) => {
  res.send("✅ API is live");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
