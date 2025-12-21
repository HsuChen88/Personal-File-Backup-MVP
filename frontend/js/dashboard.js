/**
 * Dashboard Module
 * Handles file dashboard rendering and file actions
 */

/**
 * Render file dashboard
 */
function renderFileDashboard() {
    const container = document.getElementById('fileDashboardList');
    if (!container) return;

    container.innerHTML = '';

    AppState.mockFiles.forEach(file => {
        let statusBadge = '';
        let actionBtn = '';
        const icon = getFileIcon(file.name);

        if (file.status === 'normal') {
            statusBadge = '<span class="status-status status-normal file-status">Active</span>';
            actionBtn = `
                <div class="file-actions">
                    <button class="action-btn download" data-tooltip="Download" onclick="handleDownloadFile(${file.id})">
                        ⬇
                    </button>
                    <button class="action-btn share" data-tooltip="Share" onclick="handleShareFile(${file.id})">
                        ↗
                    </button>
                    <button class="action-btn delete" data-tooltip="Delete" onclick="handleDeleteFile(${file.id})">
                        ✕
                    </button>
                </div>
            `;
        } else if (file.status === 'deleted') {
            statusBadge = '<span class="status-status status-deleted file-status">Deleted</span>';
            actionBtn = `<button class="restore-btn" data-tooltip="Restore" onclick="handleRestoreFile(${file.id})">↺</button>`;
        } else {
            statusBadge = '<span class="status-status status-expired file-status">Expired</span>';
        }

        const html = `
            <div class="file-row">
                <div class="file-icon">${icon}</div>
                <div class="file-info">
                    <div class="file-title">${file.name}</div>
                    <div class="file-meta">${formatFileSize(file.size)} • ${file.date}</div>
                </div>
                ${statusBadge}
                ${actionBtn}
            </div>
        `;
        container.innerHTML += html;
    });
}

/**
 * 真實 S3 下載：產生 Pre-signed URL 並觸發瀏覽器下載
 */
async function handleDownloadFile(fileId) {
    const file = AppState.getFileById(fileId);
    if (!file) return;

    showToast('⬇️', `正在產生 ${file.name} 的下載連結...`);

    const s3 = new AWS.S3();
    const params = {
        Bucket: AWS_CONFIG.s3BucketName,
        Key: `uploads/${file.name}`,
        Expires: 60 // 連結 60 秒後過期
    };

    try {
        const url = await s3.getSignedUrlPromise('getObject', params);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('✅', '下載已開始');
    } catch (err) {
        showToast('❌', '下載失敗：' + err.message);
    }
}

/**
 * Handle share file action
 * @param {number} fileId - File ID
 */
function handleShareFile(fileId) {
    const file = AppState.getFileById(fileId);
    if (!file) return;

    showToast('📤', `Sharing ${file.name}...`);
    
    // Simulate share process
    setTimeout(() => {
        showToast('✅', `Share link generated for ${file.name}!`);
        // In real implementation: Generate share link, notify subscribers via SNS
    }, 1500);
}

/**
 * 真實 S3 刪除：從 Bucket 中移除檔案
 */
async function handleDeleteFile(fileId) {
    const file = AppState.getFileById(fileId);
    if (!file || !confirm(`確定要永久刪除 "${file.name}" 嗎？`)) return;

    showToast('🗑️', `正在從 S3 刪除檔案...`);

    const s3 = new AWS.S3();
    const params = {
        Bucket: AWS_CONFIG.s3BucketName,
        Key: `uploads/${file.name}`
    };

    try {
        await s3.deleteObject(params).promise();
        
        // 更新 UI 狀態
        AppState.updateFileStatus(fileId, 'deleted');
        renderFileDashboard();
        showToast('✅', '檔案已從雲端刪除');
    } catch (err) {
        showToast('❌', '刪除失敗：' + err.message);
    }
}

/**
 * Handle restore file action (called from modal)
 * @param {number} fileId - File ID
 */
function handleRestoreFile(fileId) {
    const file = AppState.getFileById(fileId);
    if (!file) return;
    openRestoreModal(file);
}

