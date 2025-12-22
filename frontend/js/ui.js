/**
 * UI Helper Functions
 * Functions for managing UI elements like toast notifications, modals, and view switching
 */

/**
 * Show toast notification
 * @param {string} icon - Emoji or icon to display
 * @param {string} message - Message to show
 */
function showToast(icon, message) {
    const toast = document.getElementById('toast');
    if (toast) {
        document.getElementById('toastIcon').textContent = icon;
        document.getElementById('toastMessage').textContent = message;
        toast.classList.add('visible');

        setTimeout(() => {
            toast.classList.remove('visible');
        }, 3000);
    }
}

/**
 * Open restore modal
 * @param {Object} file - File object to restore
 */
function openRestoreModal(file) {
    if (!file) return;

    // Ensure AppState exists before using it
    if (typeof AppState !== 'undefined') {
        AppState.setCurrentRestoreFile(file);
    }

    const modalData = document.getElementById('restoreModalText');
    if (modalData) {
        modalData.innerHTML = `
            This will restore <strong>${file.name}</strong> from the secure backup vault.
            <br><br>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 13px; text-align: left; border: 1px solid #e5e7eb;">
                <div style="margin-bottom: 5px;">📅 Backup Snapshot: <strong>${file.backupDate || 'Today'}</strong></div>
                <div style="margin-bottom: 5px;">💾 Source: <strong>S3-Backup-Vault-01</strong></div>
                <div style="color: #059669;">🔒 Integrity Check: <strong>Verified</strong></div>
            </div>
        `;
    }

    const modal = document.getElementById('restoreModal');
    if (modal) modal.classList.add('visible');
}

/**
 * Close restore modal
 */
function closeRestoreModal() {
    const modal = document.getElementById('restoreModal');
    if (modal) modal.classList.remove('visible');
    
    if (typeof AppState !== 'undefined') {
        AppState.clearCurrentRestoreFile();
    }
}

/**
 * Initialize restore modal event listener
 */
function initRestoreModal() {
    const confirmBtn = document.getElementById('confirmRestoreBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
            // Check if AppState is available
            const file = (typeof AppState !== 'undefined') ? AppState.currentRestoreFile : null;
            if (!file) return;

            const btn = this;
            const originalText = btn.textContent;
            btn.textContent = 'Processing...';
            btn.disabled = true;
            btn.style.opacity = '0.7';

            // Simulate API Call
            setTimeout(() => {
                // Success
                closeRestoreModal();
                showToast('✅', `Success! ${file.name} has been restored.`);

                // Update local state and UI if render function exists
                if (typeof AppState !== 'undefined') {
                    AppState.updateFileStatus(file.id, 'normal');
                }
                if (typeof renderFileDashboard === 'function') {
                    renderFileDashboard();
                }

                // Reset button
                btn.textContent = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';
            }, 1500);
        });
    }
}

// ==========================================
// [新增] 畫面切換邏輯 (View Switching)
// ==========================================

/**
 * 切換至登入後的主畫面 (Dashboard)
 * 顯示：儀表板、Header 使用者區塊
 * 隱藏：登入/註冊表單
 */
function showDashboard() {
    console.log("🚀 Showing Dashboard...");
    
    // 1. 隱藏登入介面
    const mainGrid = document.getElementById('mainGrid');
    if (mainGrid) mainGrid.style.display = 'none';

    // 2. 顯示主儀表板 (改用 class 控制)
    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) {
        loggedInGrid.style.display = 'grid'; // 強制指定 grid
        loggedInGrid.classList.add('visible');
    }

    // 3. 顯示頂部 Header 的使用者資訊
    const headerUser = document.getElementById('headerUserSection');
    if (headerUser) {
        headerUser.style.display = 'flex';
    }
}

/**
 * 切換至登入前畫面 (Auth / Login)
 * 顯示：登入/註冊表單
 * 隱藏：儀表板、Header 使用者區塊
 */
function showAuth() {
    console.log("🔐 Showing Auth...");
    
    const mainGrid = document.getElementById('mainGrid');
    if (mainGrid) mainGrid.style.display = 'flex';

    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) {
        loggedInGrid.style.display = 'none';
        loggedInGrid.classList.remove('visible');
    }

    const headerUser = document.getElementById('headerUserSection');
    if (headerUser) {
        headerUser.style.display = 'none';
    }
}