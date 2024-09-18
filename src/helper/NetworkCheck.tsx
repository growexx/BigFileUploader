import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import UploadScreen from '../screens/UploadScreen';
import crashlytics from '@react-native-firebase/crashlytics';

const NetworkCheck: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
 crashlytics().log('App mounted.');
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected || false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Checking network...</Text>
      </View>
    );
  }

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <Text>No internet connection. Please check your network settings.</Text>
      </View>
    );
  }

  return <UploadScreen />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NetworkCheck;
