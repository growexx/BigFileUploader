
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import NetworkHelper from './helper/NetworkHelper';
import StorageHelper, { STORAGE_KEY_CHUNKS } from './helper/LocalStorage';
// Define the structure of the response from getDeviceMemory function
interface DeviceMemory {
  totalMemory: number;
  usableMemory: number;
}

// Mock functions for demonstration purposes. You should replace them with actual implementations.
async function getDeviceMemory(): Promise<DeviceMemory> {
  const totalMemory = await DeviceInfo.getTotalMemory(); // Total memory in bytes
  const usableMemory = await DeviceInfo.getFreeDiskStorage();
  return {
    totalMemory, // 2GB in bytes
    usableMemory, // 1GB in bytes
  };
}
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;
async function getDynamicChunkSize(): Promise<number> {
  // Get memory and network information
  const { totalMemory, usableMemory } = await getDeviceMemory();
  const bandwidth = await NetworkHelper.getNetworkBandwidth();
  console.log('totalMemory : ' + totalMemory);
  console.log('usableMemory : ' + usableMemory);
  // Set default chunk size (e.g., 5MB)
  let chunkSize = DEFAULT_CHUNK_SIZE; // Default to 5MB

  // Adjust chunk size based on usable memory
  if (usableMemory < 100 * 1024 * 1024) {
    // If usable memory is less than 100MB, use 1MB chunks
    chunkSize = 1 * 1024 * 1024;
  } else if (usableMemory < 500 * 1024 * 1024) {
    console.log('usableMemory < 500 * 1024 * 1024');
    // If usable memory is less than 500MB but greater than 100MB, use 5MB chunks
    chunkSize = DEFAULT_CHUNK_SIZE;
  } else if (usableMemory >= 500 * 1024 * 1024) {
    console.log('usableMemory >= 500 * 1024 * 1024');
    // If usable memory is greater than or equal to 500MB, allow larger chunk sizes
    chunkSize = 10 * 1024 * 1024; // Default to 10MB for good memory availability
  }

  // Adjust based on network bandwidth
  if (bandwidth) {
    if (bandwidth < 5) {
      console.log('Slow network (3G or lower): using 1MB chunks');
      chunkSize = 6 * 1024 * 1024; // 1MB for slow networks (< 5Mbps)
    } else if (bandwidth >= 5 && bandwidth < 20) {
      console.log('Medium network (4G): using 5MB chunks');
      chunkSize = Math.min(chunkSize, 5 * 1024 * 1024); // 5MB for medium networks (5-20Mbps)
    } else if (bandwidth >= 20) {
      console.log('Fast network (5G or Wi-Fi): using 10MB chunks');
      chunkSize = Math.min(chunkSize, 10 * 1024 * 1024); // Up to 10MB for fast networks (>= 20Mbps)
    }
  }

  console.log('chunkSize : ' + chunkSize);

  // Limit chunk size to a reasonable range (1MB to 10MB)
  chunkSize = Math.max(1 * 1024 * 1024, Math.min(chunkSize, 20 * 1024 * 1024));
  console.log('after limit chunkSize : ' + chunkSize);
  return chunkSize;
}

export const createFileChunks = async (fileUri: string) => {
  try {
   let uploadedChunkSize: any = 0; // await StorageHelper.getItemChunk(STORAGE_KEY_CHUNKS);
   const value = await StorageHelper.getItem(STORAGE_KEY_CHUNKS);
   if (value !== null) {
    uploadedChunkSize = Number(value);
  }
   console.log('uploadedChunkSize : ' + uploadedChunkSize);
    const dynamicChunkSize = await getDynamicChunkSize();
    const partNumbers = [];
    const file = await fetch(fileUri);
    const blob = await file.blob();
    const mimeType = blob.type || 'application/octet-stream';
    const chunks = [];
// Calculate the remaining size
    const remainingSize = blob.size - (uploadedChunkSize || 0);
    console.log('remainingSize : ' + remainingSize);
    const totalChunks = Math.ceil(remainingSize / dynamicChunkSize);
    for (let i = 0; i < totalChunks; i++) {
      const start = i * dynamicChunkSize + uploadedChunkSize;
      const end = Math.min(start + dynamicChunkSize, blob.size);
      const chunk = blob.slice(start, end, mimeType);
      chunks.push(chunk);
      partNumbers.push(i + uploadedChunkSize === 0 ? 1 : i + uploadedChunkSize);
    }
    console.log('totalChunks : ' + totalChunks);

    return { chunks, partNumbers , uploadedChunkSize, blobSize: blob.size};
  } catch (err) {
    console.error('Upload failed:', err);
    Toast.show({
      type: 'error',
      text1: 'Upload Error',
      text2: 'An error occurred during the upload.',
    });
  }
};
