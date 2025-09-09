import { Request, Response, NextFunction } from "express";
import { ApiResponseBuilder } from "../utils/api-response";
import { MediaService } from "../services/media.service";

export class MediaController {
  static async uploadMedia(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { mediaUrl, filename } = await MediaService.uploadMedia(req.file);
      res.json(
        ApiResponseBuilder.success(
          { mediaUrl, filename },
          "Upload file successfully",
          201
        )
      );
    } catch (error) {
      next(error);
    }
  }

  static async deleteMedia(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { mediaUrl } = req.query;
      console.log("deleting media: ", mediaUrl);

      const message = await MediaService.deleteMedia(mediaUrl);
      res.json(
        ApiResponseBuilder.success(null, "File deleted successfully", 200)
      );
    } catch (error) {
      next(error);
    }
  }
}
