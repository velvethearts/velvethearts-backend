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
      const isVideo = mimeType?.startsWith('video/') || mimeType?.includes('mp4') || mimeType?.includes('mov');
      return {
        secureUrl: isAudio 
          ? 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg'
          : isVideo
            ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
        publicId: `mock_asset_${Date.now()}`,
        width: isAudio ? 0 : 500,
        height: isAudio ? 0 : 500,
      };
    }

    return new Promise((resolve, reject) => {
      // [H-5 FIX] Determine resource_type and allowed formats based on MIME type
      const isAudioMime = mimeType?.startsWith('audio/') || mimeType?.includes('webm') || mimeType?.includes('ogg');
      const isVideoMime = mimeType?.startsWith('video/') || mimeType?.includes('mp4') || mimeType?.includes('mov');
      const uploadOptions: any = {
        folder,
      };

      if (isAudioMime) {
        // Voice intros / voice notes: use 'video' resource_type
        uploadOptions.resource_type = 'video';
      } else if (isVideoMime) {
        // Videos: use 'video' resource_type
        uploadOptions.resource_type = 'video';
      } else {
        // Photos: use 'image' or auto
        uploadOptions.resource_type = 'auto';
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload failure:', error);
            reject(new Error(error?.message || 'Media upload failed'));
          } else if (result) {
            logger.info('[Cloudinary Upload Result]', JSON.stringify({
              public_id: result.public_id,
              secure_url: result.secure_url,
              moderation: result.moderation,
            }, null, 2));

            // Check moderation status if returned
            const moderationStatus = (result.moderation as any)?.[0]?.status;
            if (moderationStatus === 'rejected') {
              logger.warn(`Cloudinary moderation REJECTED upload: ${result.public_id}`);
              reject(new Error('Upload rejected: Image contains inappropriate or explicit content'));
              return;
            }

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

  async deleteAsset(publicId: string, resourceType: 'image' | 'video' = 'image'): Promise<void> {
    if (!publicId || publicId.startsWith('mock_')) return;
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      logger.info(`[Cloudinary Asset Deleted] ${publicId}`);
    } catch (err) {
      logger.warn(`Failed to delete Cloudinary asset ${publicId}:`, err);
    }
  }
}
