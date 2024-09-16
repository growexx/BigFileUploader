import NetInfo from '@react-native-community/netinfo';

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
      // Network speed estimation logic
      let bandwidthEstimate;
      switch (networkType) {
        case 'wifi':
          bandwidthEstimate = 15 * 1024 * 1024; // Assume 50 Mbps for Wi-Fi
          break;
        case 'cellular':
          // Estimate based on cellular connection type
          if (state.details.cellularGeneration === '5g') {
            bandwidthEstimate = 5 * 1024 * 1024; // Assume 10 Mbps for 4G
          } else if (state.details.cellularGeneration === '4g') {
            console.log('4g');
            bandwidthEstimate = 3 * 1024 * 1024; // Assume 10 Mbps for 4G
          } else if (state.details.cellularGeneration === '3g') {
            bandwidthEstimate = 1 * 1024 * 1024; // Assume 2 Mbps for 3G
          } else {
            bandwidthEstimate = 0.5 * 1024 * 1024; // Assume 0.5 Mbps for lower generation
          }
          break;
        default:
          bandwidthEstimate = 1 * 1024 * 1024; // Assume 1 Mbps as a fallback
      }
      console.log('Bandwidth estimate: ' + bandwidthEstimate);
      return bandwidthEstimate; // Bandwidth in bytes per second
    }

    return null;
  }
}

export default NetworkHelper;
