// backend/src/controllers/upload.controller.js
import cloudinary from '../config/cloudinary.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    // Convert buffer to base64 data URI for Cloudinary
    const fileStr = 'data:' + req.file.mimetype + ';base64,' +
                    req.file.buffer.toString('base64');

    // Determine resource type for Cloudinary
    const resourceType = req.file.mimetype.startsWith('image/') ? 'image' : 'raw';

    const result = await cloudinary.uploader.upload(fileStr, {
      folder: 'chatapp',
      resource_type: resourceType,
    });

    res.status(200).json({
      url: result.secure_url,
      publicId: result.public_id,
      resourceType,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
};