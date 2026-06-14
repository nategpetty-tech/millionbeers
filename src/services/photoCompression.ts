import * as ImageManipulator from "expo-image-manipulator";

export type CompressedPhoto = {
  uri: string;
  width?: number;
  height?: number;
};

export async function compressBeerPhoto(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 900, compress: 0.58 });
}

export async function compressBeerThumbnail(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 320, compress: 0.52 });
}

export async function compressProfilePhoto(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 360, compress: 0.7 });
}

export async function compressBackdropPhoto(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 1100, compress: 0.68 });
}

async function compressPhoto(uri: string, options: { maxWidth: number; compress: number }): Promise<CompressedPhoto> {
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: options.maxWidth } }], {
      compress: options.compress,
      format: ImageManipulator.SaveFormat.JPEG
    });
    return {
      uri: result.uri,
      width: result.width,
      height: result.height
    };
  } catch {
    return { uri };
  }
}
