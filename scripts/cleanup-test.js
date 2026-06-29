const https = require('https');

// Login admin
const loginData = JSON.stringify({
  phone: '+242060000099',
  password: 'bolamu2026'
});

const loginOptions = {
  hostname: 'api.bolamu.co',
  port: 443,
  path: '/api/v1/auth/admin-login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = https.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const loginResult = JSON.parse(data);
    
    if (loginResult.accessToken) {
      // Cleanup
      const cleanupData = JSON.stringify({
        phones: ['+242069000099']
      });

      const cleanupOptions = {
        hostname: 'api.bolamu.co',
        port: 443,
        path: '/api/v1/admin/test/cleanup',
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResult.accessToken}`,
          'Content-Length': Buffer.byteLength(cleanupData)
        }
      };

      const cleanupReq = https.request(cleanupOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('=== CLEANUP ===');
          console.log(data);
        });
      });

      cleanupReq.on('error', (e) => {
        console.error(`Erreur cleanup: ${e.message}`);
      });

      cleanupReq.write(cleanupData);
      cleanupReq.end();
    }
  });
});

loginReq.on('error', (e) => {
  console.error(`Erreur login: ${e.message}`);
});

loginReq.write(loginData);
loginReq.end();
