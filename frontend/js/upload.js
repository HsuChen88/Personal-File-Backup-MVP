/**
 * Upload Module
 * Handles file upload, drag & drop, and progress tracking
 */

/**
 * Handle drag over event
 * @param {Event} e - Drag event
 */
function handleDragOver(e) {
    e.preventDefault();
    if (!AppState.isLoggedIn) return;
    
    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.classList.add('active');
    }
}

/**
 * Handle drag leave event
 * @param {Event} e - Drag event
 */
function handleDragLeave(e) {
    e.preventDefault();
    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.classList.remove('active');
    }
}

/**
 * Handle drop event
 * @param {Event} e - Drop event
 */
function handleDrop(e) {
    e.preventDefault();
    if (!AppState.isLoggedIn) return;

    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.classList.remove('active');
    }
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
}

/**
 * Handle file select from input
 * @param {Event} e - File input change event
 */
function handleFileSelect(e) {
    if (!AppState.isLoggedIn) return;
    const files = Array.from(e.target.files);
    processFiles(files);
}

/**
 * Process selected files for upload
 * @param {File[]} files - Array of file objects
 */
function processFiles(files) {
    const progressSection = document.getElementById('progressSection');
    const fileList = document.getElementById('fileList');

    if (!progressSection || !fileList) return;

    progressSection.classList.add('visible');

    files.forEach(file => {
        const fileId = generateFileId();
        const fileIcon = getFileIcon(file.name);

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.id = fileId;
        fileItem.innerHTML = `
            <div class="file-name">
                <span>${fileIcon}</span>
                <span>${file.name}</span>
                <span style="color: #6b7280; font-size: 12px; margin-left: auto;">(${formatFileSize(file.size)})</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%"></div>
            </div>
            <div class="progress-text">Uploading... 0%</div>
        `;

        fileList.appendChild(fileItem);

        // Simulate upload (replace with actual S3 upload)
        uploadFile(file, fileId);
    });
}

/**
 * Upload a single file
 * @param {File} file - File object to upload
 * @param {string} fileId - Unique identifier for the file item
 */
function uploadFile(file, fileId) {
    const progressBar = document.querySelector(`#${fileId} .progress-bar`);
    const progressText = document.querySelector(`#${fileId} .progress-text`);

    if (!progressBar || !progressText) return;

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) progress = 100;

        progressBar.style.width = progress + '%';
        progressText.textContent = `Uploading... ${Math.round(progress)}%`;

        if (progress >= 100) {
            clearInterval(interval);
            progressText.textContent = '✓ Upload complete';
            progressText.style.color = '#10b981';

            // Add to dashboard (delayed slightly for effect)
            setTimeout(() => {
                AppState.addFile({
                    id: Date.now(),
                    name: file.name,
                    size: file.size,
                    date: new Date().toISOString().split('T')[0],
                    status: 'normal'
                });
                renderFileDashboard();
            }, 1000);
        }
    }, 300);
}

