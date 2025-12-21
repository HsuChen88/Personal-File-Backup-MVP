/**
 * Upload Module
 * Handles file upload, drag & drop, and progress tracking
 */

/**
 * Handle drag over event
 */
function handleDragOver(e) {
    e.preventDefault();
    console.log("🔥 Drag Over event detected"); // Debug

    if (!AppState.isLoggedIn) {
        // 不回傳 return，讓使用者至少能看到禁止符號，或者除錯時能看到 log
        return;
    }
    
    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.classList.add('active');
    }
}

/**
 * Handle drag leave event
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
 */
function handleDrop(e) {
    e.preventDefault();
    console.log("🔥 Drop event detected"); // Debug

    if (!AppState.isLoggedIn) {
        console.warn("⚠️ User not logged in, upload aborted.");
        alert("請先登入後再上傳檔案！(AppState.isLoggedIn is false)");
        return;
    }

    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
        dropzone.classList.remove('active');
    }
    
    const files = Array.from(e.dataTransfer.files);
    console.log("📂 Files dropped:", files); // Debug
    processFiles(files);
}

/**
 * Handle file select from input
 */
function handleFileSelect(e) {
    console.log("🔥 File Input Changed"); // Debug

    if (!AppState.isLoggedIn) {
        console.warn("⚠️ User not logged in.");
        alert("請先登入後再上傳檔案！");
        return;
    }

    const files = Array.from(e.target.files);
    console.log("📂 Files selected:", files); // Debug
    processFiles(files);
}

/**
 * Process selected files for upload
 */
function processFiles(files) {
    const progressSection = document.getElementById('progressSection');
    const fileList = document.getElementById('fileList');

    if (!progressSection || !fileList) {
        console.error("❌ Error: progressSection or fileList DOM element not found!");
        return;
    }

    progressSection.classList.add('visible');

    files.forEach(file => {
        const fileId = generateFileId(); // 確保 utils.js 有載入
        const fileIcon = typeof getFileIcon === 'function' ? getFileIcon(file.name) : '📄';

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
            <div class="progress-text">Waiting...</div>
        `;

        fileList.appendChild(fileItem);

        // 呼叫上傳函數
        console.log(`🚀 Starting upload for: ${file.name}`);
        uploadFile(file, fileId);
    });
}

/**
 * Upload a single file to S3
 */
function uploadFile(file, fileId) {
    const progressBar = document.querySelector(`#${fileId} .progress-bar`);
    const progressText = document.querySelector(`#${fileId} .progress-text`);

    // 1. 檢查 AWS SDK 是否載入
    if (typeof AWS === 'undefined') {
        console.error("❌ AWS SDK not loaded! Check index.html script order.");
        if(progressText) {
            progressText.textContent = "Error: AWS SDK missing";
            progressText.style.color = 'red';
        }
        return;
    }

    // 2. 檢查 Config
    if (typeof AWS_CONFIG === 'undefined') {
        console.error("❌ AWS_CONFIG not found! Check config.js.");
        return;
    }

    // 3. 配置 AWS 憑證
    try {
        AWS.config.region = AWS_CONFIG.region;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: AWS_CONFIG.identityPoolId,
            Logins: {
                [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: localStorage.getItem('idToken')
            }
        });
    } catch (err) {
        console.error("❌ Credential Setup Error:", err);
        return;
    }

    const s3 = new AWS.S3();
    
    // 決定上傳路徑 (如果有 email 就分資料夾，沒有就放根目錄 uploads)
    const userFolder = AppState.currentUserEmail ? `${AppState.currentUserEmail}/` : '';
    const s3Key = `uploads/${userFolder}${file.name}`;

    console.log(`📤 Uploading to Bucket: ${AWS_CONFIG.s3BucketName}, Key: ${s3Key}`);

    const params = {
        Bucket: AWS_CONFIG.s3BucketName,
        Key: s3Key,
        Body: file,
        ContentType: file.type
    };

    const upload = s3.upload(params);

    upload.on('httpUploadProgress', (evt) => {
        const progress = Math.round((evt.loaded * 100) / evt.total);
        if (progressBar) progressBar.style.width = progress + '%';
        if (progressText) progressText.textContent = `Uploading... ${progress}%`;
    });

    upload.send((err, data) => {
        if (err) {
            console.error("❌ S3 Upload Failed:", err);
            if (progressText) {
                progressText.textContent = '❌ Failed';
                progressText.style.color = '#ef4444';
            }
            showToast('❌', 'Upload failed: ' + err.message);
            return;
        }
        
        console.log("✅ Upload Success:", data);
        if (progressText) {
            progressText.textContent = '✓ Upload complete';
            progressText.style.color = '#10b981';
        }

        // 模擬延遲更新 UI
        setTimeout(() => {
            if (typeof AppState !== 'undefined' && typeof renderFileDashboard === 'function') {
                AppState.addFile({
                    id: Date.now(),
                    name: file.name,
                    size: file.size,
                    s3Key: data.Key, 
                    date: new Date().toISOString().split('T')[0],
                    status: 'normal'
                });
                renderFileDashboard();
            }
        }, 1000);
    });
}