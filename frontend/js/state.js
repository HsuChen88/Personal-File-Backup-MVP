/**
 * Global State Management
 * Manages application-wide state
 */

const AppState = {
    isLoggedIn: false,       // 登入狀態
    currentUserEmail: null,  // 當前使用者的 Email (用來作為 S3 資料夾名稱)
    
    // 模擬檔案列表 (預設可以保留一些範例，或設為空陣列)
    mockFiles: [
        { id: 1, name: "Project_Proposal_v2.pdf", size: 2500000, date: "2023-12-14", status: "normal" }
    ],
    
    currentRestoreFile: null,
    currentShareFile: null,

    // --- 設定狀態的方法 ---
    setLoggedIn(value, email = null) {
        this.isLoggedIn = value;
        this.currentUserEmail = email;
        console.log("🔄 State Updated:", { isLoggedIn: value, email: email });
    },

    // --- 檔案操作方法 ---
    addFile(file) {
        // 新檔案加入到列表最前面
        this.mockFiles.unshift(file);
    },

    updateFileStatus(fileId, status) {
        const file = this.mockFiles.find(f => f.id === fileId);
        if (file) {
            file.status = status;
        }
    },

    getFileById(fileId) {
        return this.mockFiles.find(f => f.id === fileId);
    },

    setCurrentRestoreFile(file) {
        this.currentRestoreFile = file;
    },

    clearCurrentRestoreFile() {
        this.currentRestoreFile = null;
    },

    setCurrentShareFile(file) {
        this.currentShareFile = file;
    },

    clearCurrentShareFile() {
        this.currentShareFile = null;
    }
};