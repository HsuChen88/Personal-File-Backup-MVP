/**
 * UI Helper Functions
 * Functions for managing UI elements like toast notifications and modals
 */

/**
 * Show toast notification
 * @param {string} icon - Emoji or icon to display
 * @param {string} message - Message to show
 */
function showToast(icon, message) {
    const toast = document.getElementById('toast');
    document.getElementById('toastIcon').textContent = icon;
    document.getElementById('toastMessage').textContent = message;
    toast.classList.add('visible');

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

/**
 * Open restore modal
 * @param {Object} file - File object to restore
 */
function openRestoreModal(file) {
    if (!file) return;

    AppState.setCurrentRestoreFile(file);

    const modalData = document.getElementById('restoreModalText');
    modalData.innerHTML = `
        This will restore <strong>${file.name}</strong> from the secure backup vault.
        <br><br>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 13px; text-align: left; border: 1px solid #e5e7eb;">
            <div style="margin-bottom: 5px;">📅 Backup Snapshot: <strong>${file.backupDate}</strong></div>
            <div style="margin-bottom: 5px;">💾 Source: <strong>S3-Backup-Vault-01</strong></div>
            <div style="color: #059669;">🔒 Integrity Check: <strong>Verified</strong></div>
        </div>
    `;

    document.getElementById('restoreModal').classList.add('visible');
}

/**
 * Close restore modal
 */
function closeRestoreModal() {
    document.getElementById('restoreModal').classList.remove('visible');
    AppState.clearCurrentRestoreFile();
}

/**
 * Initialize restore modal event listener
 */
function initRestoreModal() {
    document.getElementById('confirmRestoreBtn').addEventListener('click', function () {
        const file = AppState.currentRestoreFile;
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

            // Update local state
            AppState.updateFileStatus(file.id, 'normal');
            renderFileDashboard();

            // Reset button
            btn.textContent = originalText;
            btn.disabled = false;
            btn.style.opacity = '1';
        }, 1500);
    });
}