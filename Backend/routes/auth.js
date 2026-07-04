import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import verifyToken from '../middleware/verifyToken.js';
import { encrypt } from '../utils/encrypt.js';
import {
  generateTokens,
  storeRefreshToken,
  verifyRefreshToken,
  deleteRefreshToken,
  deleteAllRefreshTokens,
  setRefreshCookie,
  clearRefreshCookie,
} from '../utils/tokenUtils.js';

const router = express.Router();

// Step 1 — redirect user to GitHub
router.get('/github', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_CALLBACK_URL,
    scope: 'repo read:user',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// Step 2 — GitHub redirects back here with code
router.get('/github/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
  }

  try {
    // Exchange code for GitHub access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const githubAccessToken = tokenRes.data.access_token;

    if (!githubAccessToken) {
      return res.redirect(`${process.env.FRONTEND_URL}?error=github_token_failed`);
    }

    // Fetch GitHub profile
    const profileRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${githubAccessToken}` },
    });

    const { id: githubId, login: username, avatar_url: avatarUrl } = profileRes.data;

    // Encrypt GitHub token before storing — never store raw
    const githubAccessTokenEncrypted = encrypt(githubAccessToken);

    // Upsert user
    const user = await User.findOneAndUpdate(
  { githubId: String(githubId) },
  { username, avatarUrl, githubAccessTokenEncrypted },
  { upsert: true, returnDocument: 'after' }
);
    // Issue your own access + refresh token pair
    const { accessToken, refreshToken } = generateTokens(user._id.toString());

    // Store hashed refresh token in DB
    await storeRefreshToken(user._id.toString(), refreshToken);

    // Set httpOnly cookie
    setRefreshCookie(res, refreshToken);

    // Pass access token in redirect — cookie alone won't work cross-port in dev
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`);

  } catch (err) {
    console.error('GitHub OAuth error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL}?error=oauth_failed`);
  }
});

// Get profile — verifyToken middleware protects this
router.get('/profile', verifyToken, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      avatarUrl: req.user.avatarUrl,
    },
  });
});

// Silent refresh — called by apiClient interceptor on 401
router.post('/refresh', async (req, res) => {
/*   console.log('COOKIES RECEIVED:', req.cookies);
 */  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ message: 'NO_TOKEN' });
  }

  try {
    const stored = await verifyRefreshToken(refreshToken);
/*     console.log('STORED TOKEN FOUND:', stored); // add this
 */    if (!stored) {
      return res.status(401).json({ message: 'INVALID_OR_EXPIRED_TOKEN' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    console.log('DECODED:', decoded); // add this

    const user = await User.findById(decoded.userId).select(
      '-githubAccessTokenEncrypted'
    );
/*     console.log('USER FOUND:', user); // add this
 */
    if (!user) {
      return res.status(401).json({ message: 'USER_NOT_FOUND' });
    }

    const { accessToken } = generateTokens(user._id.toString());
    res.json({ accessToken });

  } catch (err) {
/*     console.log('REFRESH ERROR:', err.message); // add this
 */    return res.status(401).json({ message: 'TOKEN_EXPIRED' });
  }
});

// Logout — current device only
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    await deleteRefreshToken(refreshToken);
  }

  clearRefreshCookie(res);
  res.json({ message: 'Logged out successfully' });
});

// Logout all devices — verifyToken protects this
router.post('/logout-all', verifyToken, async (req, res) => {
  await deleteAllRefreshTokens(req.userId);
  clearRefreshCookie(res);
  res.json({ message: 'Logged out from all devices' });
});

export default router;