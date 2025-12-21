/**
 * Dashboard Module
 * Handles S3 file listing, rendering, and file actions (Download/Delete/Share)
 */

/**
 * [核心功能] 從 S3 抓取最新的檔案列表並更新畫面
 */
function refreshFileDashboard() {
    console.log("🔄 Refreshing dashboard...");
    const container = document.getElementById('fileDashboardList');
    if (!container) return;

    // 1. 檢查登入狀態
    if (!AppState.isLoggedIn || !AppState.currentUserEmail) {
        container.innerHTML = '<div class="empty-state">請先登入以查看檔案</div>';
        return;
    }

    // 2. 關鍵修正：設定 AWS 憑證 (讓 Dashboard 也有權限存取 S3)
    // -----------------------------------------------------------
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
        console.error("❌ No ID Token found!");
        return;
    }

    AWS.config.region = AWS_CONFIG.region;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: AWS_CONFIG.identityPoolId,
        Logins: {
            [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: idToken
        }
    });
    // -----------------------------------------------------------

    const s3 = new AWS.S3();
    const userPrefix = `uploads/${AppState.currentUserEmail}/`;
    
    const params = {
        Bucket: AWS_CONFIG.s3BucketName,
        Prefix: userPrefix
    };

    container.innerHTML = '<div class="loading-state">⏳ 正在讀取雲端檔案...</div>';

    // 3. 呼叫 S3 ListObjectsV2
    s3.listObjectsV2(params, (err, data) => {
        if (err) {
            console.error("❌ List files failed:", err);
            // 如果是憑證過期或其他權限問題，顯示更友善的錯誤
            container.innerHTML = `<div class="error-state">無法讀取檔案列表: ${err.message}</div>`;
            return;
        }

        console.log("✅ Files fetched:", data.Contents);

        // 4. 過濾掉資料夾本身
        const files = data.Contents ? data.Contents.filter(item => item.Key !== userPrefix) : [];

        if (files.length === 0) {
            container.innerHTML = '<div class="empty-state">📭 目前沒有檔案，試著上傳一些論文吧！</div>';
            return;
        }

        // 5. 渲染列表
        renderFileList(files, userPrefix);
    });
}

/**
 * 渲染檔案列表 HTML
 */
function renderFileList(files, prefix) {
    const container = document.getElementById('fileDashboardList');
    container.innerHTML = ''; 

    // 依時間排序 (最新的在上面)
    files.sort((a, b) => b.LastModified - a.LastModified);

    files.forEach(file => {
        const fileName = file.Key.replace(prefix, '');
        const fileSize = formatFileSize(file.Size);
        const fileDate = file.LastModified.toLocaleDateString() + ' ' + file.LastModified.toLocaleTimeString();
        const icon = getFileIcon(fileName);
        
        // 處理單引號，避免 HTML 屬性壞掉
        const safeKey = file.Key.replace(/'/g, "\\'"); 

        const html = `
            <div class="file-row">
                <div class="file-icon">${icon}</div>
                <div class="file-info">
                    <div class="file-title">${fileName}</div>
                    <div class="file-meta">${fileSize} • ${fileDate}</div>
                </div>
                <span class="status-status status-normal file-status">Stored</span>
                
                <div class="file-actions">
                    <button class="action-btn download" data-tooltip="Download" 
                        onclick="handleDownloadFile('${safeKey}')">
                        ⬇
                    </button>
                    <button class="action-btn share" data-tooltip="Share / AI Summary" 
                        onclick="handleShareFile('${safeKey}')">
                        ✨
                    </button>
                    <button class="action-btn delete" data-tooltip="Delete" 
                        onclick="handleDeleteFile('${safeKey}')">
                        ✕
                    </button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

/**
 * 下載檔案
 */
async function handleDownloadFile(s3Key) {
    if (!s3Key) return;
    const fileName = s3Key.split('/').pop();
    showToast('⬇️', `正在準備下載...`);

    // 這裡也要確保憑證存在 (通常 refreshFileDashboard 已經設定過了，但保險起見)
    const s3 = new AWS.S3();
    const params = {
        Bucket: AWS_CONFIG.s3BucketName,
        Key: s3Key,
        Expires: 300 
    };

    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName; 
        a.target = "_blank"; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('✅', '下載請求已送出');
    } catch (err) {
        console.error("Download Error:", err);
        showToast('❌', '下載失敗：' + err.message);
    }
}

/**
 * 刪除檔案
 */
async function handleDeleteFile(s3Key) {
    const fileName = s3Key.split('/').pop();
    if (!confirm(`確定要永久刪除 "${fileName}" 嗎？`)) return;

    showToast('🗑️', `正在刪除...`);

    const s3 = new AWS.S3();
    const params = {
        Bucket: AWS_CONFIG.s3BucketName,
        Key: s3Key
    };

    try {
        await s3.deleteObject(params).promise();
        showToast('✅', '檔案已刪除');
        refreshFileDashboard(); // 重新整理列表
    } catch (err) {
        console.error("Delete Error:", err);
        showToast('❌', '刪除失敗：' + err.message);
    }
}

function handleShareFile(s3Key) {
    const fileName = s3Key.split('/').pop();
    showToast('✨', `AI 摘要功能開發中... (${fileName})`);
}

// 綁定全域呼叫
const renderFileDashboard = refreshFileDashboard;