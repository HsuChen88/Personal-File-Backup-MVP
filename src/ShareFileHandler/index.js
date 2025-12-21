const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('Share file event:', JSON.stringify(event, null, 2));
    
    const topicArn = process.env.SNS_TOPIC_ARN;
    
    if (!topicArn) {
        console.error('SNS_TOPIC_ARN environment variable is not set');
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Server configuration error'
            })
        };
    }
    
    try {
        // 解析請求 body
        let body;
        try {
            body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Invalid request body format'
                })
            };
        }
        
        // 驗證請求參數
        const fileName = body.fileName;
        const recipientEmail = body.recipientEmail;
        const customMessage = body.customMessage || '';
        
        if (!fileName) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'fileName is required'
                })
            };
        }
        
        if (!recipientEmail) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'recipientEmail is required'
                })
            };
        }
        
        // 驗證 email 格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(recipientEmail)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Invalid email format'
                })
            };
        }
        
        // 準備 SNS 訊息內容
        const shareMessage = {
            event: 'file_shared',
            fileName: fileName,
            recipientEmail: recipientEmail,
            customMessage: customMessage,
            timestamp: new Date().toISOString()
        };
        
        // 建立 email 內容（純文字格式，方便閱讀）
        const emailContent = `File Shared: ${fileName}

${customMessage ? `Message from sender:\n${customMessage}\n\n` : ''}This file has been shared with you via Dropbex.

Timestamp: ${new Date().toISOString()}`;
        
        // 發送 SNS 訊息
        const params = {
            TopicArn: topicArn,
            Message: emailContent,
            Subject: `File Shared: ${fileName}`,
            MessageAttributes: {
                eventType: {
                    DataType: 'String',
                    StringValue: 'file_shared'
                },
                fileName: {
                    DataType: 'String',
                    StringValue: fileName
                },
                recipientEmail: {
                    DataType: 'String',
                    StringValue: recipientEmail
                }
            }
        };
        
        const snsResponse = await snsClient.send(new PublishCommand(params));
        
        // 記錄分享請求
        console.log('File share notification sent:', {
            fileName: fileName,
            recipientEmail: recipientEmail,
            messageId: snsResponse.MessageId,
            timestamp: new Date().toISOString(),
            requestId: event.requestContext?.requestId
        });
        
        const response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'File share notification sent successfully',
                messageId: snsResponse.MessageId,
                fileName: fileName,
                recipientEmail: recipientEmail
            })
        };
        
        return response;
    } catch (error) {
        console.error('Error processing share request:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: error.message || 'Internal server error'
            })
        };
    }
};

