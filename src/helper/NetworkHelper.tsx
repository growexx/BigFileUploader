import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
// Limits based on network type
const NETWORK_LIMITS: { [key: string]: number } = {
  '3g': 10 * 1024 * 1024, // 100MB
  '4g': 300 * 1024 * 1024, // 300MB
  '5g': 500 * 1024 * 1024, // 500MB
  'wifi': Number.MAX_SAFE_INTEGER, // Unlimited
};
class NetworkHelper {
  static async getNetworkInfo() {
    const state = await NetInfo.fetch();
    console.log('Network info: ' + JSON.stringify(state));

    return {
      isConnected: state.isConnected,
      type: state.type,
      effectiveType:
        state.type === 'cellular'
          ? state.details?.cellularGeneration
          : 'unknown',
    };
  }
// Measure bandwidth by downloading a small file
static async  measureNetworkBandwidth(): Promise<number | null> {
  try {
    const startTime = Date.now();
    const response = await fetch('https://speed.hetzner.de/100MB.bin');
    const endTime = Date.now();

    const fileSizeInBytes = parseInt(response.headers.get('content-length') || '0', 10);
    const durationInSeconds = (endTime - startTime) / 1000;

    if (durationInSeconds > 0 && fileSizeInBytes > 0) {
      const bandwidthInBps = fileSizeInBytes / durationInSeconds; // Bandwidth in bytes per second
      const bandwidthInMbps = (bandwidthInBps * 8) / (1024 * 1024); // Convert to Mbps
      console.log(`Estimated bandwidth: ${bandwidthInMbps} Mbps`);
      return bandwidthInMbps;
    }

    return null;
  } catch (error) {
    console.error('Error measuring network bandwidth:', error);
    return null;
  }
}
  static monitorBandwidthChanges(
    onLowBandwidth: () => void,
    onInternetLost: () => void,
    onInternetRegained: () => void,
  ) {
    const unsubscribe = NetInfo.addEventListener(state => {
      const networkType = state.type; // E.g., "wifi", "cellular"
      if (
        networkType !== 'cellular' &&
        (state.details?.cellularGeneration ?? 'unknown') === '3g'
      ) {
        onLowBandwidth();
      }
      if (!state.isConnected) {
        onInternetLost();
      } else {
        onInternetRegained();
      }
    });

    // Return the unsubscribe function to allow cleanup
    return unsubscribe;
  }

  static async getNetworkBandwidth() {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      const networkType = state.type; // E.g., "wifi", "cellular"
      console.log('Network type: ' + networkType);
      if (networkType === 'wifi' || networkType === 'cellular') {
        // Measure bandwidth if on Wi-Fi or cellular network
        const bandwidth = await NetworkHelper.measureNetworkBandwidth();
        return bandwidth;
      } else {
        console.log('No active network connection');
        return null;
      }
      // Network speed estimation logic
      // let bandwidthEstimate;
      // switch (networkType) {
      //   case 'wifi':
      //     bandwidthEstimate = 100 * 1024 * 1024; // Assume 50 Mbps for Wi-Fi
      //     break;
      //   case 'cellular':
      //     // Estimate based on cellular connection type
      //     if (state.details.cellularGeneration === '5g') {
      //       bandwidthEstimate = 5 * 1024 * 1024; // Assume 10 Mbps for 4G
      //     } else if (state.details.cellularGeneration === '4g') {
      //       console.log('4g');
      //       bandwidthEstimate = 3 * 1024 * 1024; // Assume 10 Mbps for 4G
      //     } else if (state.details.cellularGeneration === '3g') {
      //       bandwidthEstimate = 1 * 1024 * 1024; // Assume 2 Mbps for 3G
      //     } else {
      //       bandwidthEstimate = 0.5 * 1024 * 1024; // Assume 0.5 Mbps for lower generation
      //     }
      //     break;
      //   default:
      //     bandwidthEstimate = 1 * 1024 * 1024; // Assume 1 Mbps as a fallback
      // }
      // console.log('Bandwidth estimate: ' + bandwidthEstimate);
      // return bandwidthEstimate; // Bandwidth in bytes per second
    }

    return null;
  }

  // Function to validate data size before starting the download/upload
  static async  validateNetworkAndDataSize(dataSize: number) {
  const netInfo = await NetInfo.fetch();
  const networkType = netInfo.type; // 3g, 4g, 5g, wifi, etc.
  const isConnected = netInfo.isConnected;

  if (!isConnected) {
   Toast.show({
      type: 'error',
      text1: 'No Internet Connection',
      text2: '',
    });
    return false;
  }

  // Define the limit based on network type
  let dataLimit = NETWORK_LIMITS['4g'] || 0; // default to 0 if unsupported network type
  console.log('Data size: ' + dataSize);
  console.log('Data limit: ' + dataLimit);
  if (dataSize > dataLimit) {
    // If the data size exceeds the limit, prompt to use Wi-Fi
    Toast.show({
      type: 'error',
      text1: 'Network Limitation',
      text2: `The total data size exceeds the limit for ${networkType.toUpperCase()}. Please connect to Wi-Fi.`,
    });
    return false;
  }

  // Proceed with the operation if the validation passes
  return true;
}
}

export default NetworkHelper;
