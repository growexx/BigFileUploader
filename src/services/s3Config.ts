import AWS from 'aws-sdk';
import Config from 'react-native-config';

AWS.config.update({
  accessKeyId: Config.AWS_ACCESS_KEY_ID,
  secretAccessKey: Config.AWS_SECRET_ACCESS_KEY,
  region: Config.AWS_REGION,
});

const s3 = new AWS.S3();

export const getSignedUrl = async (bucketName: string, key: string, expires: number = 60) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expires,
  };
  return s3.getSignedUrlPromise('putObject', params);
};

export default s3;
