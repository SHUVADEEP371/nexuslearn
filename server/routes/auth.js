const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

// This legacy entry point must not mint long-lived credentials. Use the active
// TypeScript API (`npm start` after building) for registration and sign-in.
router.post('/register', (_req, res) => res.status(410).json({ message: 'Legacy authentication is disabled. Use the active NexusLearn API.' }));
router.post('/login', (_req, res) => res.status(410).json({ message: 'Legacy authentication is disabled. Use the active NexusLearn API.' }));
router.get('/me', auth, (req, res) => res.json({ user: req.user }));

module.exports = router;
