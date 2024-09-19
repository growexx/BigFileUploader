import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
const { FileUtils } = NativeModules;

export const getRealFilePath = async (uri: string) => {
  try {
    console.log('Resolving file path:', uri);
    console.log('Resolving file FileUtils:', FileUtils);
    const filePath = await FileUtils.getRealPathFromURI(uri);
    console.log('Resolved file path:', filePath);
    return filePath;
  } catch (error) {
    console.error('Error resolving file path:', error);
  }
};

export const deleteCachedFiles = async (dirPath: string, maxAgeInMs: number) => {
    try {
      const files = await RNFS.readDir(dirPath);
      const currentTime = Date.now();

      for (const file of files) {
        const fileAge = currentTime - (file.mtime ? file.mtime.getTime() : 0); // File's modification time
        if (fileAge > maxAgeInMs) {
          await RNFS.unlink(file.path);
          console.log(`Deleted file: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('Error deleting old files:', error);
    }
  };
