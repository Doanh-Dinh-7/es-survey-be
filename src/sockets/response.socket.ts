import { Socket, Server } from 'socket.io';
import { ResponseService } from '../services/response.service';

export const registerResponseSocket = (socket: Socket, io: Server) => {
  // Listen for new survey responses
  socket.on('survey:response:submit', async (data: { surveyId: string }) => {
    try {
      console.log('📊 Received survey response submit:', data);
      const statistics = await ResponseService.getSurveyStatistics(
        data.surveyId,
        socket.data.user?.id
      );
      
      console.log('📈 Emitting statistics update to room:', `survey:${data.surveyId}`);
      io.to(`survey:${data.surveyId}`).emit('survey:statistics:update', statistics);
    } catch (error) {
      console.error('❌ Error in survey:response:submit:', error);
      socket.emit('error', { message: 'Failed to update statistics' });
    }
  });

  // Listen for response deletion
  socket.on('survey:response:delete', async (data: { surveyId: string, responseId: string }) => {
    try {
      await ResponseService.deleteResponse(
        data.surveyId,
        data.responseId,
        socket.data.user.id
      );

      // Get updated statistics after deletion
      const statistics = await ResponseService.getSurveyStatistics(
        data.surveyId,
        socket.data.user.id
      );
      
      // Emit the updated statistics to all clients watching this survey
      io.to(`survey:${data.surveyId}`).emit('survey:statistics:update', statistics);
    } catch (error) {
      socket.emit('error', { message: 'Failed to delete response' });
    }
  });

  // Join survey room to receive updates
  socket.on('survey:join', (surveyId: string) => {
    console.log('👥 User joined survey room:', surveyId);
    socket.join(`survey:${surveyId}`);
    // Send confirmation
    socket.emit('survey:joined', { surveyId, message: 'Successfully joined survey room' });
  });

}; 