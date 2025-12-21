/**
 * Global State Management
 * Manages application-wide state
 */

const AppState = {
    isLoggedIn: false,
    currentUser: null,
    mockFiles: [
        { id: 1, name: "Project_Proposal_v2.pdf", size: 2500000, date: "2023-12-14", status: "normal" },
        { id: 2, name: "Financial_Report_Q3.xlsx", size: 120000, date: "2023-12-10", status: "deleted", backupDate: "2023-12-10 14:30" },
        { id: 3, name: "Meeting_Recording.mp4", size: 45000000, date: "2023-11-20", status: "deleted", backupDate: "2023-11-20 09:15" },
        { id: 4, name: "Old_Log_Files.zip", size: 5000000, date: "2023-10-01", status: "expired" }
    ],
    currentRestoreFile: null,

    setLoggedIn(value) {
        this.isLoggedIn = value;
    },

    setCurrentUser(user) {
        this.currentUser = user;
    },

    addFile(file) {
        this.mockFiles.unshift(file);
    },

    updateFileStatus(fileId, status, backupDate = null) {
        const file = this.mockFiles.find(f => f.id === fileId);
        if (file) {
            file.status = status;
            if (backupDate) {
                file.backupDate = backupDate;
            }
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
    }
};

