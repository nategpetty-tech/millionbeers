import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

export type CompressedPhoto = {
  uri: string;
  width?: number;
  height?: number;
};

export async function compressBeerPhoto(uri: string): Promise<CompressedPhoto> {
  const compressed = await compressPhoto(uri, { maxWidth: 900, compress: 0.58 });
  return {
    ...compressed,
    uri: await persistBeerPhoto(compressed.uri)
  };
}

export async function compressBeerThumbnail(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 320, compress: 0.52 });
}

export async function compressProfilePhoto(uri: string): Promise<CompressedPhoto> {
  return compressPhoto(uri, { maxWidth: 900, compress: 0.9 });
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

async function persistBeerPhoto(uri: string) {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory || uri.startsWith(documentDirectory)) return uri;

  try {
    const directory = `${documentDirectory}pintly-beer-photos/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const extension = extensionForUri(uri);
    const destination = `${directory}beer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch {
    return uri;
  }
}

function extensionForUri(uri: string) {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:[?#].*)?$/);
  const extension = match?.[1]?.toLowerCase();
  if (extension === "png" || extension === "heic" || extension === "heif" || extension === "webp") return extension;
  return "jpg";
}
