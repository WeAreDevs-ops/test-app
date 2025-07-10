const express = require('express');
const bodyParser = require('body-parser');
const handler = require('./api/remove-email');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());

// POST endpoint for removing email
app.post('/api/remove-email', handler);

// Simple GET homepage
app.get('/', (req, res) => {
  res.send('✅ API is live');
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
