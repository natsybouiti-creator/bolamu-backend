const https = require('https');

// Login agent
const loginData = JSON.stringify({
  phone: '+242077000010',
  password: 'bolamu2026'
});

const loginOptions = {
  hostname: 'api.bolamu.co',
  port: 443,
  path: '/api/v1/agence/login',
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
    
    if (loginResult.token) {
      // Souscription avec Origin header
      const souscriptionData = JSON.stringify({
        phone: '+242069999002',
        nom: 'Test',
        prenom: 'Patient',
        dob: '1990-01-01',
        genre: 'M',
        ville: 'Brazzaville',
        plan: 'essentiel'
      });

      const souscriptionOptions = {
        hostname: 'api.bolamu.co',
        port: 443,
        path: '/api/v1/agence/souscrire-complet',
        method: 'POST',
        headers: {
          'Origin': 'https://www.bolamu.co',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResult.token}`,
          'Content-Length': Buffer.byteLength(souscriptionData)
        }
      };

      const souscriptionReq = https.request(souscriptionOptions, (res) => {
        console.log('=== HEADERS CORS ===');
        console.log('Status:', res.statusCode);
        console.log('Access-Control-Allow-Origin:', res.headers['access-control-allow-origin']);
        console.log('Access-Control-Allow-Methods:', res.headers['access-control-allow-methods']);
        console.log('Access-Control-Allow-Headers:', res.headers['access-control-allow-headers']);
        console.log('Access-Control-Allow-Credentials:', res.headers['access-control-allow-credentials']);
        console.log('Access-Control-Max-Age:', res.headers['access-control-max-age']);
        console.log('\n=== RESPONSE BODY ===');
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(data);
        });
      });

      souscriptionReq.on('error', (e) => {
        console.error(`Erreur souscription: ${e.message}`);
      });

      souscriptionReq.write(souscriptionData);
      souscriptionReq.end();
    }
  });
});

loginReq.on('error', (e) => {
  console.error(`Erreur login: ${e.message}`);
});

loginReq.write(loginData);
loginReq.end();
