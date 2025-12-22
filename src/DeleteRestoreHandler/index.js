const { S3Client, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
        throw new Error('Server configuration error: BUCKET_NAME not set');
    }

    try {
        const path = event.path || event.requestContext?.http?.path;
        const body = JSON.parse(event.body || '{}');
        const key = body.key || body.fileName; // 支援兩種參數名
        
        if (!key) {
             return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Missing key or fileName parameter' })
            };
        }

        // 判斷是刪除還是還原操作
        // /delete -> 軟刪除 (不帶 VersionId 刪除 = 產生 Delete Marker)
        // /restore -> 還原 (刪除 Delete Marker)
        
        if (path.endsWith('/delete')) {
            // 軟刪除：直接對物件執行 DeleteObject (不指定 VersionId)
            // S3 會自動產生一個 Delete Marker
            const command = new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key
            });
            await s3Client.send(command);
            
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ 
                    message: 'File moved to recycle bin (soft deleted)',
                    key: key
                })
            };
            
        } else if (path.endsWith('/restore')) {
            // 還原：需要刪除最新的 Delete Marker
            // 前端必須傳遞 VersionId (這個 VersionId 是 Delete Marker 的 VersionId)
            const versionId = body.versionId;
            
            if (!versionId) {
                return {
                    statusCode: 400,
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Missing versionId for restore operation' })
                };
            }

            // 刪除指定的 Delete Marker 就能讓舊版本浮現 (還原)
            const command = new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key,
                VersionId: versionId
            });
            await s3Client.send(command);

            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ 
                    message: 'File restored successfully',
                    key: key
                })
            };
        } else {
             return {
                statusCode: 404,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Invalid path' })
            };
        }

    } catch (error) {
        console.error('Error processing request:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
