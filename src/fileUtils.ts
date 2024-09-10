
import RNFS from 'react-native-fs';
import Toast from 'react-native-toast-message';

export const createFileChunks = async (fileUri: string, chunkSize: number) => {
  try {
    console.log("fileUri:", fileUri);

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
  // const file = await fetch(fileUri);
  // const blob = await file.blob();
  // const chunks = [];
  // console.log(fileUri);

  // const totalChunks = Math.ceil(blob.size / chunkSize);
  // for (let i = 0; i < totalChunks; i++) {
  //   const start = i * chunkSize;
  //   const end = Math.min(start + chunkSize, blob.size);
  //   const chunk = blob.slice(start, end);
  //   chunks.push(chunk);
  // }

  // return {chunks, totalChunks};
};
