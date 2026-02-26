const express = require('express');
const path = require('path');
const app = express();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const uploads = path.join(process.cwd(), DATA_DIR, 'uploads');

app.use('/', express.static(uploads));

const PORT = process.env.FILE_SERVER_PORT || 6700;
app.listen(PORT, () =>
  console.log(`File server running on port ${PORT}, serving ${uploads}`)
);
