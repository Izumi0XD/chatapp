// backend/src/middleware/upload.middleware.js
import multer from 'multer';

// Store files in memory as Buffer — we'll stream them to Cloudinary
// Don't store on disk because Render/Railway have ephemeral filesystems
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow images and common file types
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'audio/mpeg', 'audio/wav', 'audio/webm',
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);   // accept file
  } else {
    cb(new Error('File type not supported'), false); // reject
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});