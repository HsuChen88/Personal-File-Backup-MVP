/**
 * Main Application Initialization
 * Initializes the application and sets up event listeners
 */

function initApp() {
    console.log('🚀 App Initializing...');

    // 初始化還原視窗
    if (typeof initRestoreModal === 'function') {
        initRestoreModal();
    }
    
    // 關鍵：網頁載入時，檢查是否有舊的登入 Session
    if (typeof checkCurrentSession === 'function') {
        checkCurrentSession();
    }

    console.log('✅ Dropbex application initialized');
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}