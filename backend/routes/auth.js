const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const router = express.Router();
const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5500' // Default to frontend origin
);

// POST /api/auth/google
router.post('/google', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code is required' });

        // Exchange authorization code for tokens
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        // Get user profile info
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] });

        if (!user) {
            user = new User({
                name,
                email: email.toLowerCase(),
                googleId,
                googleAccessToken: tokens.access_token,
                googleRefreshToken: tokens.refresh_token
            });
        } else {
            // Update tokens
            user.googleId = googleId;
            user.googleAccessToken = tokens.access_token;
            if (tokens.refresh_token) {
                user.googleRefreshToken = tokens.refresh_token;
            }
            // Always update name/image if changed
            user.name = name;
        }

        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { 
                id: user._id, 
                name: user.name, 
                email: user.email,
                image: picture
            }
        });
    } catch (err) {
        console.error('Google auth error:', err);
        res.status(500).json({ error: 'Google login failed' });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword
        });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
