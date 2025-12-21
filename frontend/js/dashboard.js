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
 * Handle download file action
 * @param {number} fileId - File ID
 */
function handleDownloadFile(fileId) {
    const file = AppState.getFileById(fileId);
    if (!file) return;

    showToast('⬇️', `Downloading ${file.name}...`);
    
    // Simulate download process
    setTimeout(() => {
        showToast('✅', `${file.name} downloaded successfully!`);
        // In real implementation: Generate pre-signed S3 URL and trigger download
    }, 1500);
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
 * Handle delete file action
 * @param {number} fileId - File ID
 */
function handleDeleteFile(fileId) {
    const file = AppState.getFileById(fileId);
    if (!file) return;

    // Show confirmation with more details
    const confirmMessage = `Delete "${file.name}"?\n\n` +
        `The file will be moved to deleted status and can be restored within the retention period.\n\n` +
        `Size: ${formatFileSize(file.size)}\n` +
        `Date: ${file.date}`;

    if (confirm(confirmMessage)) {
        showToast('🗑️', `Deleting ${file.name}...`);
        
        // Simulate delete process
        setTimeout(() => {
            // Update file status
            const backupDate = new Date().toISOString().replace('T', ' ').substring(0, 16);
            AppState.updateFileStatus(fileId, 'deleted', backupDate);
            
            renderFileDashboard();
            showToast('✅', `${file.name} has been deleted!`);
            // In real implementation: Update DynamoDB, move to backup vault
        }, 1000);
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

