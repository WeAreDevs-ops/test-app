const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const handler = require('./api/remove-email');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());

// Serve HTML/CSS/JS from public folder
app.use(express.static(path.join(__dirname, 'public')));

// API handler
app.post('/api/remove-email', handler);

// Fallback if page not found
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
