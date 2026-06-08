import * as ImageManipulator from "expo-image-manipulator";

export type CompressedPhoto = {
  uri: string;
  width?: number;
  height?: number;
};

export async function compressBeerPhoto(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 1600, compress: 0.76 });
}

export async function compressProfilePhoto(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 900, compress: 0.78 });
}

export async function compressBackdropPhoto(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 1800, compress: 0.78 });
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
