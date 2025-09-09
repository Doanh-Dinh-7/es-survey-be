import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { httpServer } from './app';

dotenv.config();

const prisma = new PrismaClient();

// Test database connection
async function testConnection() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || '3000', 10);

// Start server only after testing database connection
testConnection().then(async () => {
  httpServer.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
