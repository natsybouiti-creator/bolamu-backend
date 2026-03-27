function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function simulateSendOtp(phone, otp) {
  console.log(`\n--- 📱 SIMULATION ENVOI OTP ---`);
  console.log(`[SMS Africa's Talking] Vers ${phone} : Code Bolamu ${otp}`);
  console.log(`[WhatsApp/App/Vocal] Code envoyé : ${otp}`);
  console.log(`-------------------------------\n`);
}

module.exports = { generateOtp, simulateSendOtp };
