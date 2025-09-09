import { socketAuth } from '../middlewares/socket.middleware';
import { Server } from 'socket.io';
import { registerSurveySocket } from './survey.socket';
import { registerResponseSocket } from './response.socket';
import { Server as HttpServer } from 'http';

let io: Server;

export const setupWebSocket = (server: HttpServer) => {
  if (io) {
    return io; // Return existing instance if already initialized
  }

  io = new Server(server, {
    cors: { 
      origin: ['http://localhost:5173', `${process.env.FRONTEND_URL}`], 
      credentials: true 
    }
  });

  // io.use(socketAuth); // 👈 auth middleware

  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id, 'User:', socket.data.user?.id);
    
    // Register all socket event handlers
    registerSurveySocket(socket, io);
    registerResponseSocket(socket, io);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected:', socket.id);
    });
  });
  
  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};