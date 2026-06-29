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
    console.log('=== LOGIN AGENT ===');
    console.log(data);
    const loginResult = JSON.parse(data);
    
    if (loginResult.token) {
      // Souscription
      const souscriptionData = JSON.stringify({
        phone: '+242069999001',
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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResult.token}`,
          'Content-Length': Buffer.byteLength(souscriptionData)
        }
      };

      const souscriptionReq = https.request(souscriptionOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('\n=== SOUSCRIPTION ===');
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
