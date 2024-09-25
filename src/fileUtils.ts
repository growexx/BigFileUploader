
import DeviceInfo from 'react-native-device-info';
import NetworkHelper from './helper/NetworkHelper';
import StorageHelper, { STORAGE_KEY_CHUNKS } from './helper/LocalStorage';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const {usableMemory } = await getDeviceMemory();
  const bandwidth = 10;//await NetworkHelper.getNetworkBandwidth();
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
      console.log('Slow network (3G or lower): using 5MB chunks');
      chunkSize = 10 * 1024 * 1024; // 1MB for slow networks (< 5Mbps)
    } else if (bandwidth >= 5 && bandwidth < 20) {
      console.log('Medium network (4G): using 5MB chunks');
      chunkSize = Math.min(chunkSize, 15 * 1024 * 1024); // 5MB for medium networks (5-20Mbps)
    } else if (bandwidth >= 20) {
      console.log('Fast network (5G or Wi-Fi): using 10MB chunks');
      chunkSize = Math.min(chunkSize, 25 * 1024 * 1024); // Up to 10MB for fast networks (>= 20Mbps)
    }
  }
// Limit chunk size to a reasonable range (1MB to 10MB)
  chunkSize = Math.max(5 * 1024 * 1024, Math.min(chunkSize, 20 * 1024 * 1024));
  return chunkSize;
}

export const createDynamicChukSize = async () => {
  const dynamicChunkSize = await getDynamicChunkSize();
  return dynamicChunkSize || DEFAULT_CHUNK_SIZE;
 };

export const getUploadedChunks = async () => {
  const value = await StorageHelper.getItem(STORAGE_KEY_CHUNKS);
  console.log('getUploadedChunks : ' + Number(value));
  if (value !== null) {
    return Number(value);
  } else {
  return  0;
  }
};

// Function to delete a file
export const deleteFile = async (filePath: string) => {
  RNFS.exists(filePath)
    .then(exists => {
      if (exists) {
        return RNFS.unlink(filePath);
      } else {
        console.log('File does not exist:', filePath);
      }
    })
    .then(() => {
      console.log('File deleted successfully');
    })
    .catch(error => {
      console.log('Failed to delete file:', error);
    });
};

export const cleanUpOldCache = async () => {
  await AsyncStorage.clear();
  const cacheDir = RNFS.CachesDirectoryPath;
  const files = await RNFS.readDir(cacheDir);
  for (const file of files) {
    const fileExists = await RNFS.exists(file.path);
    if (fileExists) {
      const stats = await RNFS.stat(file.path);
      const fileAge = Date.now() - stats.mtime;
      const maxAge = 1 * 60 * 1000; // 1 Min

      if (fileAge > maxAge) {
        await RNFS.unlink(file.path);
      }
    }
  }
};
