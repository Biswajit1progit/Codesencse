import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'NO_TOKEN' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const user = await User.findById(decoded.userId).select(
      '-githubAccessTokenEncrypted' // never leak this field
    );

    if (!user) {
      return res.status(401).json({ message: 'USER_NOT_FOUND' });
    }

    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: 'INVALID_TOKEN' });
  }
};

export default verifyToken;