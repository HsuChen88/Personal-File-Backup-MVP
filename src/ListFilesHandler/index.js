const { S3Client, ListObjectsV2Command, ListObjectVersionsCommand } = require("@aws-sdk/client-s3");
const s3Client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

exports.handler = async (event) => {
    console.log("Event:", JSON.stringify(event, null, 2));
    const bucketName = process.env.BUCKET_NAME;

    // ✅ 從 Query String 獲取 userPrefix (例如: uploads/email/)
    const userPrefix = event.queryStringParameters?.prefix || ""; 

    if (!userPrefix) {
        // 如果沒傳 prefix，為了安全起見，可以回傳空陣列，或者錯誤
        // 這裡示範回傳空，避免列出別人的檔案
        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ files: [], bucket: bucketName })
        };
    }

    try {
        // 1. 列出正常檔案 (帶 Prefix)
        const listParams = { 
            Bucket: bucketName,
            Prefix: userPrefix  // ✅ 關鍵：只列出該使用者的檔案
        };
        const listCommand = new ListObjectsV2Command(listParams);
        const listResponse = await s3Client.send(listCommand);

        const files = (listResponse.Contents || []).map(obj => ({
            Key: obj.Key,
            Size: obj.Size,
            LastModified: obj.LastModified,
            ETag: obj.ETag,
            isDeleted: false,
            status: "Stored"
        }));

        // 2. 列出 Delete Markers (帶 Prefix)
        const versionsParams = { 
            Bucket: bucketName, 
            Prefix: userPrefix // ✅ 關鍵：只列出該使用者的 Delete Markers
        };
        const versionsCommand = new ListObjectVersionsCommand(versionsParams);
        const versionsResponse = await s3Client.send(versionsCommand);

        const deletedFiles = (versionsResponse.DeleteMarkers || [])
            .filter(dm => dm.IsLatest)
            .map(dm => ({
                Key: dm.Key,
                Size: 0,
                LastModified: dm.LastModified,
                VersionId: dm.VersionId,
                isDeleted: true,
                status: "Deleted"
            }));

        const allFiles = [...files, ...deletedFiles];

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
                files: allFiles,
                bucket: bucketName,
                total: allFiles.length
            })
        };

    } catch (error) {
        console.error("Error listing files:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};
