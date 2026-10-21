import sharp from 'sharp';

const SIZE = 256;

export class InvalidImageError extends Error {
  override name = 'InvalidImageError';
}

/**
 * Turns an upload into the stored guild image: cropped square, 256×256, WebP. Re-encoding
 * drops metadata (EXIF, location) and anything hidden in the file. Throws InvalidImageError
 * when the data isn't an image of an accepted type.
 */
export async function toGuildImage(data: Buffer): Promise<Buffer> {
  try {
    const image = sharp(data, { limitInputPixels: 40_000_000 });
    const { format } = await image.metadata();
    if (format !== 'png' && format !== 'jpeg' && format !== 'webp') {
      throw new InvalidImageError(`Unsupported format: ${format}`);
    }
    // rotate() applies the EXIF orientation before the metadata is dropped.
    return await image
      .rotate()
      .resize(SIZE, SIZE, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
  } catch (err) {
    if (err instanceof InvalidImageError) throw err;
    throw new InvalidImageError('Not a readable image', { cause: err });
  }
}
