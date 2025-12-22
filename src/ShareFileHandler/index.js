const { SNSClient, PublishCommand, SubscribeCommand } = require('@aws-sdk/client-sns');

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
        
        // 嘗試訂閱 email 到 SNS Topic（如果還沒訂閱）
        let subscriptionStatus = 'unknown';
        try {
            const subscribeParams = {
                TopicArn: topicArn,
                Protocol: 'email',
                Endpoint: recipientEmail
            };
            
            const subscribeResponse = await snsClient.send(new SubscribeCommand(subscribeParams));
            subscriptionStatus = 'subscribed';
            console.log('Email subscription attempted:', {
                email: recipientEmail,
                subscriptionArn: subscribeResponse.SubscriptionArn,
                status: 'new_subscription'
            });
        } catch (subscribeError) {
            // 如果已經訂閱或訂閱失敗，記錄但不中斷流程
            if (subscribeError.name === 'SubscriptionLimitExceeded' || 
                subscribeError.message?.includes('already exists') ||
                subscribeError.message?.includes('already subscribed')) {
                subscriptionStatus = 'already_subscribed';
                console.log('Email already subscribed:', {
                    email: recipientEmail,
                    status: 'already_subscribed'
                });
            } else {
                subscriptionStatus = 'subscription_failed';
                console.warn('Email subscription failed (will still attempt to send):', {
                    email: recipientEmail,
                    error: subscribeError.message,
                    status: 'subscription_failed'
                });
            }
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
            subscriptionStatus: subscriptionStatus,
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
                recipientEmail: recipientEmail,
                subscriptionStatus: subscriptionStatus,
                note: subscriptionStatus === 'subscribed' 
                    ? 'Email has been subscribed to receive notifications. Please check inbox for confirmation email.'
                    : subscriptionStatus === 'already_subscribed'
                    ? 'Email is already subscribed.'
                    : 'Email subscription attempted. Please ensure email is subscribed to receive notifications.'
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

