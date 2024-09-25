import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, NativeModules, Platform } from 'react-native';
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
      console.log('Error deleting old files:', error);
    }
  };

  export const takePersistableUriPermission = (uri: any) => {
    if (FileUtils && Platform.OS === 'android') {
      FileUtils.takePersistableUriPermission(uri);
    }
  };

  export  const checkUriPermissions = (uri: any) => {
    return new Promise((resolve, reject) => {
      FileUtils.checkUriPermissions(uri)
        .then((result: unknown) => resolve(result))
        .catch((error: any) => reject(error));
    });
  };

// Open document picker to select video and get persistable URI
export const pickVideo = async () => {
  try {
    const uri = await FileUtils.openDocumentPicker();
    console.log('Picked video URI:', uri);
   // readFileContent(uri);
    await AsyncStorage.setItem('persistedUri', uri);
    return uri;
  } catch (error) {
    console.error('Error picking video:', error);
  }
};

export const readFileContent = async (uri: any) => {
  try {
    const content = await FileUtils.readFileContent(uri);
    console.log('File Content:', content);
  } catch (error) {
    console.error('Error reading file content:', error);
  }
};

export const requestManageExternalStoragePermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 30) {
    try {
      const result = await FileUtils.checkManageExternalStoragePermission();
      if (result === 'Permission request opened') {
        // Redirect user to settings or show a message
        Linking.openSettings();
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    }
  }
};
