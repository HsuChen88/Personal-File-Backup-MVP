const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('S3 upload event:', JSON.stringify(event, null, 2));
    
    const topicArn = process.env.SNS_TOPIC_ARN;
    const bucketName = process.env.BUCKET_NAME;
    
    if (!topicArn) {
        console.error('SNS_TOPIC_ARN environment variable is not set');
        throw new Error('Server configuration error: SNS_TOPIC_ARN not set');
    }
    
    if (!bucketName) {
        console.error('BUCKET_NAME environment variable is not set');
        throw new Error('Server configuration error: BUCKET_NAME not set');
    }
    
    try {
        // 處理 S3 Event（可能包含多個記錄）
        const results = [];
        
        for (const record of event.Records || []) {
            // 只處理 S3 ObjectCreated 事件
            if (record.eventSource !== 'aws:s3' || !record.eventName?.startsWith('ObjectCreated')) {
                console.log('Skipping non-ObjectCreated event:', record.eventName);
                continue;
            }
            
            const s3 = record.s3;
            const bucket = s3.bucket.name;
            const objectKey = decodeURIComponent(s3.object.key.replace(/\+/g, ' '));
            
            console.log('Processing S3 upload:', {
                bucket: bucket,
                key: objectKey,
                eventName: record.eventName,
                eventTime: record.eventTime
            });
            
            // 驗證檔案確實存在於 S3（非同步確認）
            let fileMetadata = null;
            try {
                const headCommand = new HeadObjectCommand({
                    Bucket: bucket,
                    Key: objectKey
                });
                
                fileMetadata = await s3Client.send(headCommand);
                
                console.log('File verified in S3:', {
                    key: objectKey,
                    size: fileMetadata.ContentLength,
                    contentType: fileMetadata.ContentType,
                    lastModified: fileMetadata.LastModified
                });
            } catch (s3Error) {
                console.error('Failed to verify file in S3:', {
                    key: objectKey,
                    error: s3Error.message
                });
                // 如果檔案不存在，跳過此記錄
                continue;
            }
            
            // 準備 SNS 訊息內容
            const notificationMessage = {
                event: 'file_uploaded',
                fileName: objectKey,
                fileSize: fileMetadata.ContentLength || 0,
                contentType: fileMetadata.ContentType || 'application/octet-stream',
                uploadTimestamp: record.eventTime || new Date().toISOString(),
                bucket: bucket,
                etag: fileMetadata.ETag,
                lastModified: fileMetadata.LastModified?.toISOString(),
                metadata: {
                    eventName: record.eventName,
                    eventSource: record.eventSource,
                    awsRegion: record.awsRegion
                },
                timestamp: new Date().toISOString()
            };
            
            // 發送 SNS 訊息
            const params = {
                TopicArn: topicArn,
                Message: JSON.stringify(notificationMessage, null, 2),
                Subject: `File Uploaded: ${objectKey}`,
                MessageAttributes: {
                    eventType: {
                        DataType: 'String',
                        StringValue: 'file_uploaded'
                    },
                    fileName: {
                        DataType: 'String',
                        StringValue: objectKey
                    }
                }
            };
            
            const snsResponse = await snsClient.send(new PublishCommand(params));
            
            // 記錄通知
            console.log('Upload notification sent:', {
                fileName: objectKey,
                fileSize: fileMetadata.ContentLength,
                contentType: fileMetadata.ContentType,
                messageId: snsResponse.MessageId,
                timestamp: new Date().toISOString()
            });
            
            results.push({
                fileName: objectKey,
                messageId: snsResponse.MessageId,
                success: true
            });
        }
        
        return {
            statusCode: 200,
            processed: results.length,
            results: results
        };
    } catch (error) {
        console.error('Error processing upload notification:', error);
        throw error;
    }
};

