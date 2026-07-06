const http = require('http');
const payload = JSON.stringify({ username: 'admin', password: 'dispatch123' });
const opts = {
  hostname: 'localhost', port: 3000, path: '/api/v1/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
};
const req = http.request(opts, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    if (d.token) console.log('LOGIN OK — role:', d.user.role);
    else console.log('LOGIN FAILED:', data);
  });
});
req.on('error', e => console.error('ERROR:', e.message));
req.write(payload);
req.end();
