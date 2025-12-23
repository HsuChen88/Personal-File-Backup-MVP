const { SNSClient, ListSubscriptionsByTopicCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('Check subscription event:', JSON.stringify(event, null, 2));
    
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
        
        // 查詢 SNS Topic 的所有 subscriptions
        const listParams = {
            TopicArn: topicArn
        };
        
        let isSubscribed = false;
        let nextToken = null;
        
        do {
            if (nextToken) {
                listParams.NextToken = nextToken;
            }
            
            const listResponse = await snsClient.send(new ListSubscriptionsByTopicCommand(listParams));
            
            // 檢查 email 是否存在於已確認的 subscriptions 中
            if (listResponse.Subscriptions) {
                for (const subscription of listResponse.Subscriptions) {
                    // 只檢查 email protocol 的訂閱，且狀態為 "Confirmed"
                    // SubscriptionArn 必須是真正的 ARN，排除 'PendingConfirmation' 和 'Deleted'
                    if (subscription.Protocol === 'email' && 
                        subscription.Endpoint === email &&
                        subscription.SubscriptionArn.startsWith('arn:aws:sns:')) {
                        isSubscribed = true;
                        break;
                    }
                }
            }
            
            nextToken = listResponse.NextToken;
        } while (nextToken && !isSubscribed);
        
        // 記錄檢查結果
        console.log('Subscription check result:', {
            email: email,
            isSubscribed: isSubscribed,
            timestamp: new Date().toISOString()
        });
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                isSubscribed: isSubscribed
            })
        };
    } catch (error) {
        console.error('Error checking subscription:', error);
        
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