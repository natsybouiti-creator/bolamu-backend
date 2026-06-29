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
    console.log('=== ADMIN LOGIN ===');
    console.log(data);
    
    if (loginResult.accessToken) {
      // Vérifier profil utilisateur
      const profileOptions = {
        hostname: 'api.bolamu.co',
        port: 443,
        path: '/api/v1/admin/users/+242069000099/profile',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResult.accessToken}`
        }
      };

      const profileReq = https.request(profileOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('\n=== USER PROFILE ===');
          console.log(data);
        });
      });

      profileReq.on('error', (e) => {
        console.error(`Erreur profile: ${e.message}`);
      });

      profileReq.end();
    }
  });
});

loginReq.on('error', (e) => {
  console.error(`Erreur login: ${e.message}`);
});

loginReq.write(loginData);
loginReq.end();

// Login agent pour verifier-adherent
const agentLoginData = JSON.stringify({
  phone: '+242077000010',
  password: 'bolamu2026'
});

const agentLoginOptions = {
  hostname: 'api.bolamu.co',
  port: 443,
  path: '/api/v1/agence/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(agentLoginData)
  }
};

const agentLoginReq = https.request(agentLoginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const agentLoginResult = JSON.parse(data);
    console.log('\n=== AGENT LOGIN ===');
    console.log(data);
    
    if (agentLoginResult.token) {
      // Vérifier adherent
      const adherentOptions = {
        hostname: 'api.bolamu.co',
        port: 443,
        path: '/api/v1/agence/verifier-adherent?q=+242069000099',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${agentLoginResult.token}`
        }
      };

      const adherentReq = https.request(adherentOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('\n=== VERIFIER ADHERENT ===');
          console.log(data);
        });
      });

      adherentReq.on('error', (e) => {
        console.error(`Erreur adherent: ${e.message}`);
      });

      adherentReq.end();
    }
  });
});

agentLoginReq.on('error', (e) => {
  console.error(`Erreur agent login: ${e.message}`);
});

agentLoginReq.write(agentLoginData);
agentLoginReq.end();
