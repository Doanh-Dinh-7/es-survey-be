import express, { NextFunction } from "express";
import cors from "cors";
import { createServer } from "http";
import { errorHandler } from "./middlewares/error.middleware";
import authRoutes from "./routes/auth.routes";
import surveyRoutes from "./routes/survey.routes";
import mediaRoutes from "./routes/media.routes";
import slackRoutes from "./routes/slack.routes";
import { setupWebSocket } from "./sockets";
import { CronService } from "./services/cron.service";
import { initializeSlackIntegration } from "./slack";
import path from "path";

const app = express();

app.use(
  cors({
    origin: [`${process.env.FRONTEND_URL}`, "http://localhost:5173", "http://192.168.1.23:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  })
);

app.use(cors());
app.use(express.json());

// Create HTTP server
const httpServer = createServer(app);

// Initialize socket.io with the HTTP server
const io = setupWebSocket(httpServer);

// Initialize cron jobs
CronService.initCronJobs();

(async () => {
  await initializeSlackIntegration();
  console.log("⚡️ Slack app is running!");
})();

// Routes
app.get("/", (req, res) => {
  res.send("Health check");
});
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/surveys", surveyRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use("/api/v1/slack", slackRoutes);
app.use("/images", express.static(path.join(__dirname, "../media/images")));

// Optional: Add an endpoint to manually trigger status checks (for testing)
app.post('/api/v1/admin/check-survey-status', async (req, res) => {
  await CronService.checkAndUpdateSurveyStatus();
  res.json({ message: 'Survey status check triggered' });
});

// Error handling
app.use(errorHandler);

// Export both app and httpServer
export { app, httpServer };
