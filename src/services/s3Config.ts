// s3Config.ts
import AWS from 'aws-sdk';

AWS.config.update({
  accessKeyId: 'YOUR_ACCESS_KEY_ID', // Replace with your AWS access key ID
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY', // Replace with your AWS secret access key
  region: 'YOUR_AWS_REGION', // Replace with your AWS region
});

const s3 = new AWS.S3();

export const getSignedUrl = async (bucketName: string, key: string, expires: number = 60) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expires, // URL expiration time in seconds
  };
  return s3.getSignedUrlPromise('putObject', params);
};

export default s3;
