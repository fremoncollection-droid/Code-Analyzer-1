import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authenticateToken, authorize } from "../middleware/auth";

const router = Router();

const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `logo${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.post(
  "/logo",
  authenticateToken,
  authorize("admin"),
  upload.single("logo"),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const fileUrl = `/api/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  }
);

export default router;
