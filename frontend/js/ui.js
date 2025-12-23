/**
 * UI Helper Functions
 */

function showToast(icon, message) {
    const toast = document.getElementById('toast');
    if (toast) {
        document.getElementById('toastIcon').textContent = icon;
        document.getElementById('toastMessage').textContent = message;
        toast.classList.add('visible');
        setTimeout(() => { toast.classList.remove('visible'); }, 3000);
    }
}

// 修正後的初始化函式
function initRestoreModal() {
    const confirmBtn = document.getElementById('confirmRestoreBtn');
    
    // 如果 HTML 中沒有這個按鈕（目前 index.html 確實沒有），則安靜地結束
    if (!confirmBtn) return; 

    confirmBtn.addEventListener('click', function () {
        const file = (typeof AppState !== 'undefined') ? AppState.currentRestoreFile : null;
        if (!file) return;

        const btn = this;
        btn.textContent = 'Processing...';
        btn.disabled = true;

        setTimeout(() => {
            closeRestoreModal();
            showToast('✅', `Success! ${file.name} has been restored.`);
            btn.textContent = 'Confirm Restore';
            btn.disabled = false;
        }, 1500);
    });
}

function showDashboard() {
    const mainGrid = document.getElementById('mainGrid');
    if (mainGrid) mainGrid.style.display = 'none';

    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) {
        loggedInGrid.style.display = 'grid';
        loggedInGrid.classList.add('visible');
    }

    const headerUser = document.getElementById('headerUserSection');
    if (headerUser) headerUser.style.display = 'flex';
}

function showAuth() {
    const mainGrid = document.getElementById('mainGrid');
    if (mainGrid) mainGrid.style.display = 'flex';

    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) {
        loggedInGrid.style.display = 'none';
        loggedInGrid.classList.remove('visible');
    }

    const headerUser = document.getElementById('headerUserSection');
    if (headerUser) headerUser.style.display = 'none';
}