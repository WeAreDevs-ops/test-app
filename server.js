const express = require('express');
const path = require('path');
const handler = require('./api/remove-email');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API route
app.post('/api/remove-email', handler);

// Default
app.get('/api', (req, res) => {
  res.send('✅ API is live');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
