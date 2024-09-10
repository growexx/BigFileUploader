// NetworkHelper.ts
import NetInfo from '@react-native-community/netinfo';

const LOW_BANDWIDTH_THRESHOLD = 1; // 1 Mbps

class NetworkHelper {
  static async getNetworkInfo() {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected,
      type: state.type,
      effectiveType: state.details?.cellularGeneration || 'unknown',
      downlinkMax: state.details?.downlinkMax || 'unknown',
    };
  }

  static async getBandwidthEstimate() {
    const state = await NetInfo.fetch();
    return state.details?.downlinkMax || 'unknown';
  }

  static monitorBandwidthChanges(onLowBandwidth: () => void, onInternetLost: () => void, onInternetRegained: () => void) {
    NetInfo.addEventListener(state => {
      const bandwidth = state.details?.downlinkMax || 'unknown';
      if (bandwidth !== 'unknown' && bandwidth < LOW_BANDWIDTH_THRESHOLD) {
        onLowBandwidth();
      }
      if (!state.isConnected) {
        onInternetLost();
      } else {
        onInternetRegained();
      }
    });
  }
}

export default NetworkHelper;
