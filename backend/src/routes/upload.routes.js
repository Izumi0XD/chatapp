import { Router } from 'express';
import { uploadFile } from '../controllers/upload.controller.js';
import protect from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

const router = Router();

// protect → upload.single('file') → uploadFile
// Middleware runs left to right:
// 1. Check JWT auth
// 2. Parse the multipart file with multer
// 3. Upload to Cloudinary and return URL
router.post('/', protect, upload.single('file'), uploadFile);

export default router;