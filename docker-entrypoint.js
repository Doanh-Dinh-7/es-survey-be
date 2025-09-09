const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function updateDatabase() {
  try {
    console.log('Updating database schema...');
    
    // Deploy migrations
    console.log('Deploying Prisma migrations...');
    const { stdout: migrateOutput } = await execAsync('npx prisma migrate deploy', { timeout: 30000 });
    console.log('Migrations deployed successfully:');
    console.log(migrateOutput);
    
    // Generate Prisma client (in case of updates)
    console.log('Generating Prisma client...');
    const { stdout: generateOutput } = await execAsync('npx prisma generate', { timeout: 20000 });
    console.log('Prisma client generated successfully:');
    console.log(generateOutput);
    
    // Run database seed
    try {
      console.log('Running database seed...');
      const { stdout: seedOutput } = await execAsync('node dist/prisma/seed.js', { timeout: 30000 });
      console.log('Database seed completed successfully:');
      console.log(seedOutput);
    } catch (seedError) {
      console.log('Database seed failed or was skipped:', seedError.message);
      console.log('This is normal if seed data already exists or seed script is not configured.');
      // Don't throw - seed failure shouldn't stop the app
    }
    
    console.log('Database update completed successfully!');
    
  } catch (error) {
    console.error('Database update failed:', error.message);
    console.error('This might be expected if migrations are already applied or database is not ready yet.');
    // Don't exit - let the application try to start anyway
  }
}

async function startApplication() {
  try {
    console.log('=== Survey Server Startup ===');
    
    // Update database before starting the application
    await updateDatabase();
    
    console.log('Starting application server...');
    require('./dist/src/index.js');
    
  } catch (error) {
    console.error('Startup failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

startApplication();

