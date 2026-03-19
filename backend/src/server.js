import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import connectDB from './config/db.js';
import { initSocket } from './socket/index.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import messageRoutes from './routes/message.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import conversationRoutes from './routes/conversation.routes.js';

// ✅ Register models globally
import './models/User.model.js';
import './models/Conversation.model.js';
import './models/Message.model.js';


const app = express();
const httpServer = createServer(app);

// ✅ Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

// ✅ Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());


if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ✅ Make io available in routes/controllers
app.set('io', io);

// ✅ Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/conversations', conversationRoutes);

// ✅ Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ❌ 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route ' + req.originalUrl + ' not found',
  });
});

// ❌ Global error handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.stack);
  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// ✅ Initialize socket
initSocket(io);

// ✅ Start server AFTER DB connection (best practice)
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(
        'Server running on port ' + PORT + ' in ' + process.env.NODE_ENV + ' mode'
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();