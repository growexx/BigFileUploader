
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEY_STATUS = 'status';
export const STORAGE_KEY_UPLOAD_DETAILS = 'uploadDetails';
export const STORAGE_KEY_CHUNKS = 'uploadedChunks';

class StorageHelper {
  static async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('AsyncStorage Error: ', error);
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('AsyncStorage Error: ', error);
      return null;
    }
  }

  static async setItemChunnk(key: string, value: any): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('AsyncStorage Error: ', error);
    }
  }

  static async getItemChunk(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('AsyncStorage Error: ', error);
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('AsyncStorage Error: ', error);
    }
  }
  static async clearAll(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('AsyncStorage Error: ', error);
    }
  }
}

export default StorageHelper;
