
import Toast from 'react-native-toast-message';

export const createFileChunks = async (fileUri: string, chunkSize: number) => {
  try {
    console.log('fileUri:', fileUri);
    const partNumbers = [];
    const file = await fetch(fileUri);
    const blob = await file.blob();
    const chunks = [];
    console.log(fileUri);

    const totalChunks = Math.ceil(blob.size / chunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, blob.size);
      const chunk = blob.slice(start, end);
      if (i < 6) {
        chunks.push(chunk);
        partNumbers.push(i + 1);
      }

    }
    console.log('chunks : ' + totalChunks);

    return {chunks, partNumbers};
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
