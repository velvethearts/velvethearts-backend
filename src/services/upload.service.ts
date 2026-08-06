import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';
import { logger } from '../utils/logger';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export class UploadService {
  async uploadImage(fileBuffer: Buffer, folder = 'velvet_hearts', mimeType?: string): Promise<{ secureUrl: string; publicId: string; width: number; height: number }> {
    // Check for default development Cloudinary keys
    if (env.CLOUDINARY_API_KEY === '123456789012345' || !env.CLOUDINARY_API_KEY) {
      logger.warn('Mock Cloudinary upload active (using fallback assets for development).');
      const isAudio = mimeType?.startsWith('audio/') || mimeType?.includes('webm') || mimeType?.includes('mp3') || mimeType?.includes('ogg') || mimeType?.includes('wav') || mimeType?.includes('m4a');
      return {
        secureUrl: isAudio 
          ? 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg'
          : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
        publicId: `mock_asset_${Date.now()}`,
        width: isAudio ? 0 : 500,
        height: isAudio ? 0 : 500,
      };
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload failure:', error);
            reject(new Error('Cloudinary media upload failed'));
          } else if (result) {
            resolve({
              secureUrl: result.secure_url,
              publicId: result.public_id,
              width: result.width || 0,
              height: result.height || 0,
            });
          } else {
            reject(new Error('Empty upload result from Cloudinary'));
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  }
}
