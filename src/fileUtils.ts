import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import Toast from 'react-native-toast-message';

export const createFileChunks = async (fileUri: string, chunkSize: number) => {
  try {
    console.log("fileUri:", fileUri);
    
    const fileName = `${Date.now()}_${fileUri.split('/').pop()}`;
    const destinationPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
  
    try {
      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        // For Android content URIs
        const result = await RNFS.copyFile(fileUri, destinationPath);
        console.log('File copied successfully to:', destinationPath);
        fileUri = destinationPath;
      } else {
        // For regular file paths
        await RNFS.copyFile(fileUri, destinationPath);
        console.log('File copied successfully to:', destinationPath);
        fileUri = destinationPath;
      }
      
      const fileExists = await RNFS.exists(fileUri);
      if (!fileExists) {
        throw new Error('Copied file not found');
      }
      console.log('Using file path:', fileUri);
    } catch (error) {
      console.error('Error copying file:', error);
      // Attempt to read from original URI if copy fails
      if (Platform.OS === 'android' && fileUri.startsWith('content://')) {
        const fileContent = await RNFS.readFile(fileUri, 'base64');
        await RNFS.writeFile(destinationPath, fileContent, 'base64');
        fileUri = destinationPath;
        console.log('File read and written successfully to:', fileUri);
      } else {
        throw error; // Re-throw if we can't handle it
      }
    }
    const fileStat = await RNFS.stat(fileUri);
    const totalSize = fileStat.size;


    const chunks = [];
    const totalChunks = Math.ceil(totalSize / chunkSize);
    console.log("Toatal Chunks " + totalChunks);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = await RNFS.read(fileUri, end - start, start, 'base64');
      chunks.push(chunk);
    }
    console.log("log");

    return chunks;
  } catch (err) {
    console.error('Upload failed:', err);
    Toast.show({
      type: 'error',
      text1: 'Upload Error',
      text2: 'An error occurred during the upload.',
    });
  }
};
