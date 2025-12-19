const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('Request upload event:', JSON.stringify(event, null, 2));
    
    // 從環境變數取得 Bucket 資訊
    const bucketName = process.env.BUCKET_NAME;
    
    if (!bucketName) {
        console.error('BUCKET_NAME environment variable is not set');
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
        const contentType = body.contentType || 'application/octet-stream';
        
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
        
        // 驗證檔案名稱格式（防止路徑遍歷攻擊）
        if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    error: 'Invalid fileName format'
                })
            };
        }
        
        // 產生唯一的檔案名稱（加入時間戳記避免衝突）
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueFileName = `${timestamp}-${sanitizedFileName}`;
        
        // 產生 S3 預簽名 URL
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: uniqueFileName,
            ContentType: contentType
        });
        
        // 預簽名 URL 有效期為 1 小時（3600 秒）
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        
        // 記錄上傳請求
        console.log('Upload request generated:', {
            fileName: uniqueFileName,
            originalFileName: fileName,
            contentType: contentType,
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
                uploadUrl: presignedUrl,
                fileName: uniqueFileName,
                originalFileName: fileName,
                expiresIn: 3600
            })
        };
        
        return response;
    } catch (error) {
        console.error('Error processing upload request:', error);
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

