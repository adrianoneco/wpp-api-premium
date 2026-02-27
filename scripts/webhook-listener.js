const http = require('http');

const PORT = process.env.WEBHOOK_PORT || 5678;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    console.log('Headers:', req.headers);
    console.log('Body:', body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Webhook listener running on http://0.0.0.0:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down webhook listener');
  server.close(() => process.exit(0));
});
