import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    disabledButton: {
      backgroundColor: '#d3d3d3',
    },
    disabledText: {
      color: '#a9a9a9',
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 20,
    },
    fileName: {
      fontSize: 16,
      marginBottom: 20,
    },
    progressContainer: {
      width: '100%',
      marginBottom: 20,
    },
    progressBar: {
      borderRadius: 5,
    },
    progressText: {
      textAlign: 'center',
      marginTop: 5,
      fontSize: 16,
    },
    pauseButton: {
      backgroundColor: '#007bff',
      padding: 10,
      borderRadius: 5,
      marginBottom: 20,
    },
    cancelButton: {
      backgroundColor: '#28a745',
      padding: 10,
      borderRadius: 5,
      marginBottom: 20,
    },
    selectButton: {
      backgroundColor: '#28a745',
      padding: 10,
      borderRadius: 5,
      letterSpacing: 1,
    },
    clearAllButton: {
      backgroundColor: '#6c757d',
      padding: 10,
      borderRadius: 5,
      position: 'absolute',
      top: 50,
      right: 20,
    },
    buttonText: {
      color: '#fff',
      fontSize: 16,
    },
    processingContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    processingText: {
      marginTop: 10,
      fontSize: 16,
    },
    networkStatus: {
      position: 'absolute',
      top: 50,
      fontSize: 14,
      color: '#fff',
      backgroundColor: '#007bff',
      padding: 10,
      borderRadius: 5,
      left: 20,
    },
    networkWarning: {
      color: 'red',
      marginTop: 20,
    },
    loaderContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    loaderText: {
      marginTop: 10,
      fontSize: 16,
    },
    uploadStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
      paddingHorizontal: 10,
    },
    uploadLoader: {
      paddingTop: 10,
      marginRight: 10,
    },
  });
