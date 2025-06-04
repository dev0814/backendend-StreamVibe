const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Create HTTP server with increased timeout for video streaming
const server = http.createServer({
  // Increase timeout for video streaming (5 minutes)
  timeout: 300000
}, app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Handle socket events for real-time chat/comments
  socket.on('joinVideoRoom', (videoId) => {
    socket.join(`video_${videoId}`);
  });
  
  socket.on('leaveVideoRoom', (videoId) => {
    socket.leave(`video_${videoId}`);
  });
  
  socket.on('newComment', (data) => {
    io.to(`video_${data.videoId}`).emit('commentReceived', data);
  });
  
  socket.on('commentReplyReceived', (data) => {
    io.to(`video_${data.videoId}`).emit('commentReplyReceived', data);
  });
  
  socket.on('commentDeleted', (data) => {
    io.to(`video_${data.videoId}`).emit('commentDeleted', data);
  });
  
  socket.on('replyDeleted', (data) => {
    io.to(`video_${data.videoId}`).emit('replyDeleted', data);
  });
  
  socket.on('newQuestion', (data) => {
    io.to(`video_${data.videoId}`).emit('questionReceived', data);
  });
  
  socket.on('newAnswer', (data) => {
    io.to(`video_${data.videoId}`).emit('answerReceived', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Body parser with increased limit for video uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Increase timeout for video streaming
app.use((req, res, next) => {
  // Set timeout to 5 minutes for video routes
  if (req.url.includes('/videos/proxy/')) {
    req.setTimeout(300000); // 5 minutes
    res.setTimeout(300000); // 5 minutes
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Enable CORS with specific options for video streaming
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Route files
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const videoRoutes = require('./routes/videoRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const noticeRoutes = require('./routes/notice');
const viewRoutes = require('./routes/viewRoutes');
const searchRoutes = require('./routes/searchRoutes');
const statsRoutes = require('./routes/statsRoutes');
const noteRoutes = require('./routes/note');
const commentRoutes = require('./routes/comment');
const questionRoutes = require('./routes/questionRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/views', viewRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/reports', reportRoutes);

// Health check route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body
  });
  
  // Don't send error response if headers are already sent
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', {
    error: err.message,
    stack: err.stack
  });
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });
  // Close server & exit process
  server.close(() => process.exit(1));
});
