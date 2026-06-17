const express = require("express");
const multer = require("multer");

const { authenticateToken } = require("../middlewares/auth");
const c = require("../controllers/aiController");

const router = express.Router();

const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error("unsupported_image_type"));
  },
});

router.use(authenticateToken);

router.get("/usage", c.getUsage);
router.post("/shape-recognition", upload.single("image"), c.shapeRecognition);
router.post("/room-suggestions", express.json(), c.roomSuggestions);
router.post("/color-palettes",  express.json(), c.colorPalettes);
router.get("/jobs/:jobId", c.getJobStatus);

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: "upload_failed", code: err.code, message: err.message });
  }
  if (err && err.message === "unsupported_image_type") {
    return res.status(400).json({ error: "unsupported_image_type" });
  }
  next(err);
});

module.exports = router;
