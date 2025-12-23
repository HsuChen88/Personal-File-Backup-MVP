const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('Share file event:', JSON.stringify(event, null, 2));
    
    const topicArn = process.env.SNS_TOPIC_ARN;
    const bucketName = process.env.BUCKET_NAME; // 需在 template.yaml 設定此環境變數
    
    // 1. 環境變數檢查
    if (!topicArn || !bucketName) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Server configuration error: TopicArn or BucketName missing' })
        };
    }
    
    try {
        // 2. 解析請求 Body
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
        } catch (e) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Invalid JSON format' })
            };
        }
        
        const { fileName, recipientEmail, customMessage, s3Key } = body;
        
        // 3. 參數驗證
        if (!recipientEmail || !s3Key) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'recipientEmail and s3Key are required' })
            };
        }

        // 4. 產生 S3 預簽名下載連結 (有效期 24 小時)
        const getObjectParams = {
            Bucket: bucketName,
            Key: s3Key
        };
        const command = new GetObjectCommand(getObjectParams);
        const signedDownloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 86400 });

        // 5. 組合 SNS 訊息內容
        const displayFileName = fileName || s3Key.split('/').pop();
        const messageContent = `
[Dropbex] 有人分享了檔案給您！

檔案名稱: ${displayFileName}
分享者的話: ${customMessage || '無額外訊息'}

直接下載連結 (有效期 24 小時):
${signedDownloadUrl}

---
此訊息由 Dropbex 系統自動發送，請勿直接回覆。
`;

        // 6. 發布訊息至 SNS
        const publishParams = {
            TopicArn: topicArn,
            Subject: `[Dropbex] 檔案分享：${displayFileName}`,
            Message: messageContent,
            MessageAttributes: {
                recipientEmail: {
                    DataType: 'String',
                    StringValue: recipientEmail
                }
            }
        };

        const result = await snsClient.send(new PublishCommand(publishParams));
        console.log('Message published successfully:', result.MessageId);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ 
                message: 'Share notification sent successfully', 
                messageId: result.MessageId 
            })
        };

    } catch (error) {
        console.error('Error sharing file:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};