const { SNSClient, SubscribeCommand } = require('@aws-sdk/client-sns');
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('Subscribe email event:', JSON.stringify(event, null, 2));
    
    const topicArn = process.env.SNS_TOPIC_ARN;
    
    // 檢查環境變數
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
    
    // 修正：將 body 定義在 try 區塊外，確保 catch 區塊也能存取
    let body = {};

    try {
        // 解析請求 body
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
        
        // 驗證 email 參數
        const email = body.email;
        
        if (!email) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'email is required'
                })
            };
        }
        
        // 驗證 email 格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
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
        
        // 訂閱 email 到 SNS Topic
        const subscribeParams = {
            TopicArn: topicArn,
            Protocol: 'email',
            Endpoint: email
        };
        
        const subscribeResponse = await snsClient.send(new SubscribeCommand(subscribeParams));
        
        // 記錄訂閱請求
        console.log('Email subscription request sent:', {
            email: email,
            subscriptionArn: subscribeResponse.SubscriptionArn,
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
                message: 'Subscription request sent successfully',
                subscriptionArn: subscribeResponse.SubscriptionArn,
                email: email
            })
        };
        
        return response;

    } catch (error) {
        console.error('Error processing email subscription:', error);
        
        // 處理已存在的訂閱錯誤
        // 這裡現在可以安全地使用 body.email 了
        if (error.name === 'SubscriptionLimitExceeded' || error.message?.includes('already exists')) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    message: 'Subscription request sent successfully',
                    email: body?.email,
                    note: 'Email may already be subscribed'
                })
            };
        }
        
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