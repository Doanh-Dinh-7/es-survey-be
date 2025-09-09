import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";
import { Server } from "socket.io";

const prisma = new PrismaClient();

export const registerSurveySocket = (socket: Socket, io: Server) => {
    socket.on('survey:join', async (surveyId: string) => {
      console.log('👥 User joining survey room:', surveyId);
      
      // Change room name to match response.socket.ts
      socket.join(`survey:${surveyId}`);
      
      // Send confirmation
      socket.emit('survey:joined', { 
        surveyId, 
        message: 'Successfully joined survey room' 
      });
      console.log('👥 User joined survey room:', surveyId);
    });
  
    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id}`);
    });
  };
  