import path from "path";
import fs from "fs";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "../exceptions/http.exception";
import fsPromises from "fs/promises";

export class MediaService {
  static async uploadMedia(file: any) {
    file = file as Express.Multer.File;
    if (!file) throw new Error("No file provided");
    let mediaUrl = "";
    if (file.mimetype.startsWith("image/")) {
      mediaUrl = `/images/${file.filename}`;
    } else if (file.mimetype.startsWith("video/")) {
      mediaUrl = `/videos/${file.filename}`;
    } else if (file.mimetype.startsWith("audio/")) {
      mediaUrl = `/audios/${file.filename}`;
    } else {
      mediaUrl = `/others/${file.filename}`;
    }
    return { mediaUrl, filename: file.filename };
  }

  static async deleteMedia(mediaUrl: any) {
    mediaUrl = mediaUrl as string;
    if (!mediaUrl) {
      throw new BadRequestException("No media URL provided");
    }

    // Extract the filename from the media URL
    const filePath = path.join(__dirname, "../../media", mediaUrl);

    console.log("Deleting file at path:", filePath);

    if (!fs.existsSync(filePath)) {
      throw new BadRequestException("File not found");
    }

    fs.unlinkSync(filePath);

    return { message: "File deleted successfully" };
  }

  static async duplicateMedia(mediaUrl: string): Promise<string> {
    // mediaUrl dạng /images/xxx.jpg, /audios/xxx.mp3, /videos/xxx.mp4, /others/xxx.ext
    const match = mediaUrl.match(/^\/(images|audios|videos|others)\/(.+)$/);
    if (!match) {
      throw new Error("Invalid mediaUrl format");
    }
    const folder = match[1];
    const oldFilename = match[2];
    const mediaDir = path.join(__dirname, `../../media/${folder}`);
    const oldPath = path.join(mediaDir, oldFilename);
    const ext = path.extname(oldFilename);

    // Tạo tên file mới theo ngày
    const newFilename = `image-${
      Date.now() + "-" + Math.round(Math.random() * 1e9)
    }${ext}`;
    const newPath = path.join(mediaDir, newFilename);

    // Kiểm tra file tồn tại
    try {
      await fsPromises.access(oldPath);
    } catch {
      throw new Error("File not found to duplicate");
    }
    await fsPromises.copyFile(oldPath, newPath);
    return `/${folder}/${newFilename}`;
  }
}
