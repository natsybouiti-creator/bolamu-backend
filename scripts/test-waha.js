require('dotenv').config();

fetch('https://waha-bolamu.onrender.com/api/sendText', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.WAHA_API_KEY
  },
  body: JSON.stringify({
    chatId: '242069735418@c.us',
    text: 'Bolamu WAHA test - connexion OK',
    session: 'default'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
