const AWS_CONFIG = {
    region: 'us-east-1',
    userPoolId: 'us-east-1_nDlgnpFm1',                // 來自 Outputs: UserPoolId
    appClientId: '3qlbo4iuurta617e35amiisgl8',         // 來自 Outputs: UserPoolClientId
    identityPoolId: 'us-east-1:0116c6d4-bab3-4bd4-976e-d1a5bc1d53cb', // 來自 Outputs: IdentityPoolId
    s3BucketName: 'dropbex-app-2025-storage-306653833547', // 來自 Outputs: S3BucketName
    ApiUrl: "https://sa3g7ezkqb.execute-api.us-east-1.amazonaws.com/Prod"
};
