/**
 * Utility Functions
 * Common helper functions used across the application
 */

/**
 * Format file size from bytes to human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Get file icon based on file extension
 * @param {string} fileName - Name of the file
 * @returns {string} Emoji icon for the file type
 */
function getFileIcon(fileName) {
    if (fileName.endsWith('xlsx') || fileName.endsWith('xls')) return '📊';
    if (fileName.endsWith('mp4') || fileName.endsWith('avi') || fileName.endsWith('mov')) return '🎬';
    if (fileName.endsWith('zip') || fileName.endsWith('rar') || fileName.endsWith('7z')) return '🗂️';
    if (fileName.endsWith('pdf')) return '📕';
    if (fileName.endsWith('jpg') || fileName.endsWith('png') || fileName.endsWith('gif')) return '🖼️';
    return '📄';
}

/**
 * Generate unique file ID
 * @returns {string} Unique file identifier
 */
function generateFileId() {
    return 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

