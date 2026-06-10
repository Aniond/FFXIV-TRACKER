/**
 * routes/auth.js — Discord OAuth login flow and the session probe.
 * Routers keep their full original paths; index.js mounts them at '/'.
 */
const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate } = require('../middleware');
const { USER_SELECT } = require('./users');

const router = express.Router();

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3001/auth/discord/callback',
  scope: ['identify'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { id, username, avatar } = profile;
    const result = await pool.query(
      `INSERT INTO users (discord_id, username, avatar)
       VALUES ($1, $2, $3)
       ON CONFLICT (discord_id) DO UPDATE SET username = $2, avatar = $3
       RETURNING *`,
      [id, username, avatar]
    );
    return done(null, result.rows[0]);
  } catch (err) {
    return done(err);
  }
}));


router.get('/auth/discord', passport.authenticate('discord'));

router.get('/auth/discord/callback',
  passport.authenticate('discord', { session: false, failureRedirect: `${process.env.FRONTEND_URL}?auth=failed` }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, discord_id: req.user.discord_id, username: req.user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const dest = req.user.discord_id === process.env.ADMIN_DISCORD_ID ? '/admin' : '/';
    // Fragment, not query string: #token= never leaves the browser (no server
    // logs, no Referer leak, no proxy/CDN capture of a 7-day bearer token).
    res.redirect(`${process.env.FRONTEND_URL}${dest}#token=${token}`);
  }
);

router.get('/auth/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(USER_SELECT, [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ ...result.rows[0], is_admin: req.user.discord_id === process.env.ADMIN_DISCORD_ID });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
