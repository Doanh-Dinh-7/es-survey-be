import { Router } from "express";
import { MediaController } from "../controllers/media.controller";
import { upload } from "../middlewares/media.middleware";

const router = Router();

// Route upload ảnh
router.post(
  "/upload-file",
  upload.single("image"),
  MediaController.uploadMedia
);

export default router;
