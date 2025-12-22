const AWS_CONFIG = {
    region: 'us-east-1',
    userPoolId: 'us-east-1_ZuZMQa718',                // 來自 Outputs: UserPoolId
    appClientId: 'u2i3a89f3aub4ei7t6u55rlgh',         // 來自 Outputs: UserPoolClientId
    identityPoolId: 'us-east-1:2d7779c4-2309-4c01-9c0a-2a7d90f2bcd3', // 來自 Outputs: IdentityPoolId
    s3BucketName: 'dropbex-app-2025-storage-934297345929', // 來自 Outputs: S3BucketName
    snsTopicArn: '' // 來自 Outputs: SNSTopicArn
};
