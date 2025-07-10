// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import removeEmailHandler from './api/remove-email.js';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Backend route
app.post('/api/remove-email', removeEmailHandler);

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
