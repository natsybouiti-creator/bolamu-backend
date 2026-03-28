const express = require('express');
const router = express.Router();

const {
    requestOtp,
    verifyOtp,
    login
} = require('../controllers/auth.controller');

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login);

module.exports = router;