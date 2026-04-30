require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/database');
const redis = require('./config/redis');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const channelRoutes = require('./routes/channelRoutes');
const groupRoutes = require('./routes/groupRoutes');
const aiRoutes = require('./routes/aiRoutes');
const additionalRoutes = require('./routes/additionalRoutes');
const disappearingRoutes = require('./routes/disappearingRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');
const folderRoutes = require('./routes/folderRoutes');
const { startDisappearingJob } = require('./jobs/disappearingJob');
const { initializeMessageSocket } = require('./sockets/messageSocket');

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.0.106',
  'http://192.168.0.106:5173'
];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health checks
app.get('/health', (req, res) => res.json({ success: true }));
app.get('/api/status-check', (req, res) => res.json({ success: true, message: 'API connected' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', additionalRoutes);
app.use('/api/messages/disappearing', disappearingRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/folders', folderRoutes);

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await db.testConnection();
    redis.connect().catch(e => console.log('Redis wait...'));
    initializeMessageSocket(io);
    server.listen(PORT, '0.0.0.0', () => {
      console.log('🚀 Server on port ' + PORT);
      startDisappearingJob(io);
    });
  } catch (err) {
    console.error('Startup error:', err.message);
    process.exit(1);
  }
};

start();
