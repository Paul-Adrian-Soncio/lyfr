// Medication photo capture and storage. See CLAUDE.md §5, "Photos":
// downscale to ~800px on the long edge, store in the app document
// directory, and persist only the RELATIVE path in SQLite — the app
// container path itself changes between installs and OS updates, so an
// absolute path stored today would break later.

import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const PHOTOS_SUBDIR = "medication-photos";
const LONG_EDGE_PX = 800;

/**
 * Launches the system camera, downscales the result, and copies it into
 * the app's document directory. Returns the path RELATIVE to the document
 * directory (what gets stored in medications.photo_path), or null if the
 * user cancelled or permission was denied.
 */
export async function captureMedicationPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.9,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const captured = result.assets[0];

  const manipulated = await ImageManipulator.manipulate(captured.uri)
    .resize({ width: LONG_EDGE_PX })
    .renderAsync();
  const saved = await manipulated.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
  });

  const photosDir = new Directory(Paths.document, PHOTOS_SUBDIR);
  if (!photosDir.exists) {
    photosDir.create({ intermediates: true });
  }

  const fileName = `${Crypto.randomUUID()}.jpg`;
  const sourceFile = new File(saved.uri);
  const destFile = new File(photosDir, fileName);
  sourceFile.copy(destFile);

  return `${PHOTOS_SUBDIR}/${fileName}`;
}

/** Resolves a stored relative photo path back to a usable file:// URI. */
export function resolveMedicationPhotoUri(relativePath: string): string {
  return new File(Paths.document, relativePath).uri;
}
