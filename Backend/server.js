import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import repoRoutes from './routes/repos.js';
import qaRoutes from './routes/qa.js';
import webhookRoutes from './routes/webhooks.js';
import reviewRoutes from './routes/reviews.js';
import evalRoutes from './routes/evals.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Webhooks FIRST — needs raw body
app.use('/api/webhooks', webhookRoutes);

// Then JSON parser for everything else
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/evals', evalRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'CodeSense backend running' });
});

mongoose.connect(process.env.MONGODB_URI,{
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });