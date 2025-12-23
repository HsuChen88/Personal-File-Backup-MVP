/**
 * ListFilesHandler - 列出使用者檔案 (含回收筒狀態)
 * Runtime: Node.js 22.x (使用 AWS SDK v3)
 */

const { S3Client, ListObjectsV2Command, ListObjectVersionsCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({});

exports.handler = async (event) => {
    // 1. 設定 CORS Headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const bucketName = process.env.BUCKET_NAME;

        // 2. 從 Authorization Header 解析使用者 Email
        // 格式通常是 "Bearer <token>" 或直接 "<token>"
        const authHeader = event.headers.Authorization || event.headers.authorization;
        
        if (!authHeader) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ message: "Missing Authorization header" })
            };
        }

        // 簡單的手動 JWT 解碼 (不需額外 npm 套件)
        // JWT 結構: Header.Payload.Signature
        const tokenParts = authHeader.replace('Bearer ', '').split('.');
        if (tokenParts.length < 2) {
            return { statusCode: 400, headers, body: JSON.stringify({ message: "Invalid Token format" }) };
        }
        
        const payloadBuffer = Buffer.from(tokenParts[1], 'base64');
        const payload = JSON.parse(payloadBuffer.toString());
        const userEmail = payload.email;

        if (!userEmail) {
            return { statusCode: 400, headers, body: JSON.stringify({ message: "Token does not contain email" }) };
        }

        console.log(`🔍 Listing files for user: ${userEmail}`);

        // 3. 設定搜尋前綴 (Prefix)
        const userPrefix = `uploads/${userEmail}/`;

        // 4. 平行執行兩個查詢：
        //    (A) ListObjectsV2: 取得目前「活著」的檔案
        //    (B) ListObjectVersions: 取得所有版本 (用來找出被刪除的檔案)
        const [listCommand, versionsCommand] = await Promise.all([
            s3.send(new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: userPrefix
            })),
            s3.send(new ListObjectVersionsCommand({
                Bucket: bucketName,
                Prefix: userPrefix
            }))
        ]);

        // 5. 整理資料
        const activeFilesMap = new Set();
        const files = [];

        // A. 處理現存檔案 (Active)
        if (listCommand.Contents) {
            listCommand.Contents.forEach(item => {
                // 過濾掉系統檔案或資料夾本身
                if (item.Key === userPrefix || item.Key.endsWith('_summary.txt')) return;

                activeFilesMap.add(item.Key);
                files.push({
                    Key: item.Key,
                    LastModified: item.LastModified,
                    Size: item.Size,
                    ETag: item.ETag,
                    isDeleted: false
                });
            });
        }

        // B. 處理刪除標記 (Recycle Bin items)
        // 邏輯：如果一個檔案最新的版本是 "DeleteMarker"，那它就是被刪除的
        if (versionsCommand.DeleteMarkers) {
            versionsCommand.DeleteMarkers.forEach(marker => {
                // 如果這個 Key 不在 activeFilesMap 裡，代表它目前是被刪除狀態
                if (!activeFilesMap.has(marker.Key) && marker.IsLatest) {
                    // 再次過濾
                    if (marker.Key === userPrefix || marker.Key.endsWith('_summary.txt')) return;

                    files.push({
                        Key: marker.Key,
                        LastModified: marker.LastModified,
                        Size: 0, // 刪除標記沒有大小，前端顯示時可處理
                        isDeleted: true,
                        VersionId: marker.VersionId // 這是還原時需要的 ID
                    });
                }
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ files: files })
        };

    } catch (error) {
        console.error("Error listing files:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: "Internal Server Error", error: error.message })
        };
    }
};