import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import RefreshToken from '../models/RefreshToken.js';

// Hash refresh token before storing — never store raw token in DB
export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate both tokens
export const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Store hashed refresh token in DB
export const storeRefreshToken = async (userId, refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await RefreshToken.create({ userId, tokenHash, expiresAt });
};

// Verify incoming refresh token against DB hash
export const verifyRefreshToken = async (refreshToken) => {
  const tokenHash = hashToken(refreshToken);

  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored) return null;
  if (stored.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ tokenHash }); // clean up expired
    return null;
  }

  return stored;
};

// Delete single session (logout current device)
export const deleteRefreshToken = async (refreshToken) => {
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.deleteOne({ tokenHash });
};

// Delete all sessions for a user (logout all devices)
export const deleteAllRefreshTokens = async (userId) => {
  await RefreshToken.deleteMany({ userId });
};

// Set httpOnly cookie — one place, consistent options everywhere
/* export const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  });
}; */

export const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true on Render, false locally
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // none required for cross-domain
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
};