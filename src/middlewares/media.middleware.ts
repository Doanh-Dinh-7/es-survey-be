import multer from "multer";
import path from "path";
import fs from "fs";

// Xác định thư mục upload dựa vào mimetype
function getUploadDirByMimetype(mimetype: string) {
  if (mimetype.startsWith("image/"))
    return path.join(__dirname, "../../media/images");
  if (mimetype.startsWith("video/"))
    return path.join(__dirname, "../../media/videos");
  if (mimetype.startsWith("audio/"))
    return path.join(__dirname, "../../media/audios");
  return path.join(__dirname, "../../media/others");
}

const storage = multer.diskStorage({
  destination: function (_req, file, cb) {
    const uploadDir = getUploadDirByMimetype(file.mimetype);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

export const upload = multer({ storage });
