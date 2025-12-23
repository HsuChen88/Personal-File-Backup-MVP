/**
 * Dashboard Module - Dropbex
 * 核心功能模組：負責檔案列表管理、Tab切換、外部爬蟲、轉存邏輯與互動功能
 */

// ==========================================
// 1. AWS 初始化與憑證管理 (Auth & Init)
// ==========================================

function ensureAWSCredentials() {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
        AWS.config.credentials = null;
        return false;
    }

    AWS.config.region = AWS_CONFIG.region;
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: AWS_CONFIG.identityPoolId,
        Logins: {
            [`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`]: idToken
        }
    });
    return true;
}

/**
 * 自動初始化 S3 資料夾結構 (僅在不存在時執行)
 */
async function autoInitializeFolders(userEmail) {
    if (!userEmail) return;

    const s3 = new AWS.S3();
    const requiredFolders = [
        'public/',
        'uploads/',
        `uploads/${userEmail}/`
    ];

    console.log("🛠️ 正在驗證 S3 目錄結構...");

    for (const folderKey of requiredFolders) {
        try {
            await s3.headObject({
                Bucket: AWS_CONFIG.s3BucketName,
                Key: folderKey
            }).promise();
        } catch (err) {
            if (err.statusCode === 404 || err.code === 'NotFound') {
                console.log(`✨ 偵測到缺失目錄，正在建立: ${folderKey}`);
                try {
                    await s3.putObject({
                        Bucket: AWS_CONFIG.s3BucketName,
                        Key: folderKey,
                        Body: '',
                        ContentType: 'application/x-directory'
                    }).promise();
                } catch (putErr) {
                    console.warn(`⚠️ 建立目錄 ${folderKey} 失敗:`, putErr);
                }
            }
        }
    }
}

/**
 * 儀表板統一入口
 */
async function refreshAllDashboards() {
    console.log("🔄 同步所有儀表板資料...");
    
    if (!ensureAWSCredentials()) {
        console.log("⚠️ 尚未登入，停止同步");
        const privateList = document.getElementById('fileDashboardList');
        if(privateList) privateList.innerHTML = '<div class="empty-state-gray">請先登入以查看檔案</div>';
        return;
    }

    let userEmail = null;
    if (typeof AppState !== 'undefined' && AppState.currentUserEmail) {
        userEmail = AppState.currentUserEmail;
    } else {
        const emailElem = document.getElementById('statusBarEmail');
        if (emailElem) userEmail = emailElem.innerText;
    }

    if (userEmail && userEmail.includes('@')) {
        await autoInitializeFolders(userEmail);
    }

    refreshFileDashboard();
    refreshPublicRepository();
}

// ==========================================
// 2. Tab 切換邏輯
// ==========================================

function switchListTab(tabName) {
    const btnPrivate = document.getElementById('tabBtnPrivate');
    const btnPublic = document.getElementById('tabBtnPublic');
    const listPrivate = document.getElementById('fileDashboardList');
    const listPublic = document.getElementById('publicFileList');

    if (!btnPrivate || !btnPublic) return;

    if (tabName === 'private') {
        btnPrivate.classList.add('active');
        btnPrivate.style.backgroundColor = '#ffffff';
        btnPrivate.style.color = '#6366f1';
        
        btnPublic.classList.remove('active');
        btnPublic.style.backgroundColor = 'transparent';
        btnPublic.style.color = '#64748b';
        
        if(listPrivate) listPrivate.style.display = 'block';
        if(listPublic) listPublic.style.display = 'none';
    } else {
        btnPublic.classList.add('active');
        btnPublic.style.backgroundColor = '#ffffff';
        btnPublic.style.color = '#6366f1';

        btnPrivate.classList.remove('active');
        btnPrivate.style.backgroundColor = 'transparent';
        btnPrivate.style.color = '#64748b';
        
        if(listPublic) listPublic.style.display = 'block';
        if(listPrivate) listPrivate.style.display = 'none';
        
        if (listPublic && listPublic.children.length <= 1) {
            refreshPublicRepository();
        }
    }
}

// ==========================================
// 3. 資料獲取與搜尋邏輯 (核心修改區)
// ==========================================

async function refreshFileDashboard() {
    const container = document.getElementById('fileDashboardList');
    if (!container) return;

    // 取得 Token，若無則不執行
    const idToken = localStorage.getItem('idToken');
    if (!idToken) return;

    // 取得當前 User Email
    let userEmail = AppState.currentUserEmail || document.getElementById('statusBarEmail')?.innerText;
    
    container.innerHTML = '<div class="loading-state">⏳ 讀取檔案與回收筒...</div>';

    try {
        // ★ 修改重點：改成 fetch 後端 API (帶上 Authorization Header)
        const response = await fetch(AWS_CONFIG.filesApiUrl, {
            method: 'GET',
            headers: {
                'Authorization': idToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        // 相容處理：有些 API 回傳格式是 { files: [] }，有些直接是 []
        const files = Array.isArray(data) ? data : (data.files || []);

        if (files.length === 0) {
            container.innerHTML = '<div class="empty-state-gray">目前沒有資料</div>';
            return;
        }

        // 呼叫渲染函式 (傳入 email 以便處理檔名顯示)
        renderUserFileList(files, userEmail);

    } catch (err) {
        console.error("Refresh Error:", err);
        container.innerHTML = `<div class="error-state">無法讀取列表: ${err.message}</div>`;
    }
}

function refreshPublicRepository() {
    const publicContainer = document.getElementById('publicFileList');
    if (!publicContainer) return;

    const s3 = new AWS.S3();
    const publicPrefix = 'public/';

    publicContainer.innerHTML = '<div class="loading-state">🔍 讀取公共資源...</div>';

    s3.listObjectsV2({ Bucket: AWS_CONFIG.s3BucketName, Prefix: publicPrefix }, (err, data) => {
        if (err) {
            publicContainer.innerHTML = `<div class="empty-state-gray">無法讀取公共區</div>`;
            return;
        }
        
        const files = data.Contents ? data.Contents.filter(item => 
            !item.Key.endsWith('/') && !item.Key.endsWith('_summary.txt') && item.Key !== publicPrefix
        ) : [];
        
        const normalizedFiles = files.map(file => ({
            type: 's3',
            key: file.Key,
            name: file.Key.replace('public/', ''),
            size: formatFileSize(file.Size),
            date: file.LastModified
        }));
        
        if (normalizedFiles.length === 0) {
            publicContainer.innerHTML = '<div class="empty-state-gray">目前沒有公共資料</div>';
            return;
        }
        renderPublicFileList(normalizedFiles);
    });
}

/**
 * 搜尋處理器：優先顯示 S3 資料，後接 arXiv 爬蟲資料
 */
async function handleCrawlerSearch() {
    if (!ensureAWSCredentials()) {
        showToast('⚠️', '請先登入');
        return;
    }

    switchListTab('public');

    const inputEl = document.getElementById('crawlerSearchInput');
    const query = inputEl ? inputEl.value.trim() : "";
    const container = document.getElementById('publicFileList');

    if (!query) {
        refreshPublicRepository();
        return;
    }

    showToast('🔍', `搜尋: ${query}`);
    container.innerHTML = '<div class="loading-state">🔍 正在檢索 S3 與學術網路...</div>';

    try {
        const s3 = new AWS.S3();
        const publicPrefix = 'public/';

        // 1. 先執行 S3 內部檢索
        const s3Promise = s3.listObjectsV2({ Bucket: AWS_CONFIG.s3BucketName, Prefix: publicPrefix }).promise()
            .then(data => {
                return (data.Contents || [])
                    .filter(item => !item.Key.endsWith('/') && !item.Key.endsWith('_summary.txt'))
                    .filter(item => item.Key.toLowerCase().includes(query.toLowerCase()))
                    .map(file => ({
                        type: 's3',
                        key: file.Key,
                        name: file.Key.replace('public/', ''),
                        size: formatFileSize(file.Size),
                        date: file.LastModified
                    }));
            });

        // 2. 執行 arXiv 外部檢索
        const arxivPromise = fetchArxivPapers(query);

        // 3. 合併結果：將 s3Files 置於陣列前方
        const s3Files = await s3Promise;
        const arxivFiles = await arxivPromise;
        const allFiles = [...s3Files, ...arxivFiles]; 

        if (allFiles.length === 0) {
            container.innerHTML = '<div class="empty-state-gray">找不到相關論文</div>';
            return;
        }
        window.currentSearchResults = allFiles;
        renderPublicFileList(allFiles);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="error-state">搜尋發生錯誤</div>';
    }
}

// ==========================================
// 4. 渲染邏輯
// ==========================================

function renderUserFileList(files, userEmail) {
    const container = document.getElementById('fileDashboardList');
    if(!container) return;
    container.innerHTML = ''; 

    // 取得「已還原檔案」的清單
    const recoveredFiles = JSON.parse(localStorage.getItem('recovered_files') || '[]');

    files.sort((a, b) => {
        if (a.isDeleted !== b.isDeleted) {
            return a.isDeleted ? 1 : -1;
        }
        return new Date(b.LastModified) - new Date(a.LastModified);
    });

    files.forEach(file => {
        let displayFileName = file.Key;
        if (userEmail && displayFileName.includes(`uploads/${userEmail}/`)) {
            displayFileName = displayFileName.split(`uploads/${userEmail}/`)[1];
        } else if (displayFileName.startsWith('uploads/')) {
            displayFileName = displayFileName.replace('uploads/', '');
        }

        if (!displayFileName || displayFileName.endsWith('_summary.txt')) return;

        const fileSize = file.Size ? formatFileSize(file.Size) : '-';
        const safeKey = file.Key.replace(/'/g, "\\'");
        const icon = getFileIcon(displayFileName);
        
        const dateStr = file.LastModified 
            ? new Date(file.LastModified).toLocaleString() 
            : 'Unknown Date';

        const isDeleted = file.isDeleted === true;
        const versionId = file.VersionId || 'null';

        // ★★★ 修改重點：判斷標籤顯示邏輯 ★★★
        let statusTag = '';
        
        if (isDeleted) {
            // 1. 如果是刪除狀態，優先顯示紅色 Deleted
            statusTag = `<span class="status-tag status-deleted">Deleted</span>`;
        } else if (recoveredFiles.includes(file.Key)) {
            // 2. 如果不在刪除狀態，且在還原清單中，顯示淺藍色 Recover
            statusTag = `<span class="status-tag status-recovered">Recovered</span>`;
        } else {
            // 3. 其他情況顯示綠色 Stored
            statusTag = `<span class="status-tag status-stored">Stored</span>`;
        }

        const rowClass = isDeleted ? 'file-row deleted-row' : 'file-row';

        let buttonsHtml = '';
        if (isDeleted) {
            buttonsHtml = `
                <button class="action-btn restore" title="Restore File" onclick="handleRestore('${safeKey}', '${versionId}')">
                    ↩ 
                </button>
            `;
        } else {
            // ★ 注意：這裡使用單引號拼接法，確保不會報錯
            buttonsHtml = 
                '<button class="action-btn ai-summary" title="AI Summary" style="color: #f59e0b;" onclick="handleViewSummary(\'' + safeKey + '\')">✨</button>' +
                '<button class="action-btn publish" title="Publish to Public" style="color: #3b82f6;" onclick="handlePublishToPublic(\'' + safeKey + '\')">🌍</button>' +
                '<button class="action-btn download" title="Download" style="color: #10b981;" onclick="handleDownloadFile(\'' + safeKey + '\')">⬇</button>' +
                '<button class="action-btn share" title="Share via Email" style="color: #8b5cf6;" onclick="handleFileShare(\'' + safeKey + '\')">✉️</button>' +
                '<button class="action-btn delete" title="Recycle Bin" onclick="handleDeleteFile(\'' + safeKey + '\')">🗑️</button>';
        }

        const html = `
            <div class="${rowClass}">
                <div class="file-content-top" onclick="handleViewFile('${safeKey}')" style="cursor: pointer;">
                    <div class="file-icon">${icon}</div>
                    <div class="file-info">
                        <div class="file-title" title="${displayFileName}">${displayFileName}</div>
                        <div class="file-meta">
                            ${statusTag}
                            <span>${fileSize}</span>
                            <span style="border-left:1px solid #ddd; padding-left:6px; margin-left:2px;">${dateStr}</span>
                        </div>
                    </div>
                </div>
                
                <div class="file-actions" onclick="event.stopPropagation();">
                    ${buttonsHtml}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function renderPublicFileList(files) {
    const container = document.getElementById('publicFileList');
    if(!container) return;
    container.innerHTML = ''; 
    
    files.forEach((file, index) => {
        // 處理檔名中的單引號，避免 JS 報錯
        const safeKey = file.key.replace(/'/g, "\\'"); 
        
        let icon, tagHtml, actionHtml;
        let displayName = file.name;
        let contributorHtml = '';

        // ===============================================
        // 情境 A: S3 內部的公共檔案 (升級成 Email 分享)
        // ===============================================
        if (file.type === 's3') {
            if (displayName.includes('/')) {
                const parts = displayName.split('/');
                const realName = parts.pop(); 
                const contributor = parts.pop(); 
                
                displayName = realName;
                contributorHtml = `
                    <div style="font-size: 11px; color: #6b7280; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                        <span>👤</span> ${contributor}
                    </div>
                `;
            }

            icon = getFileIcon(displayName);
            tagHtml = `<span class="status-tag status-stored" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">Public</span>`;
            
            // ★★★ 修改重點：將原本的 Copy Link 改為 Email Share (handleFileShare) ★★★
            actionHtml = `
                <button class="action-btn ai-summary" title="AI Summary" style="color: #f59e0b;" onclick="handleViewSummary('${safeKey}')">✨</button>
                <button class="action-btn share" title="Share via Email" style="color: #8b5cf6;" onclick="handleFileShare('${safeKey}')">✉️</button>
                <button class="action-btn download" title="Download" onclick="handleDownloadFile('${safeKey}')">⬇</button>
            `;
        } 
        // ===============================================
        // 情境 B: 外部 arXiv 論文 (維持複製連結)
        // ===============================================
        else {
            icon = '🌐';
            tagHtml = `<span class="status-tag status-stored" style="background: #fef3c7; color: #d97706; border-color: #fcd34d;">arXiv</span>`;
            contributorHtml = `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">🏫 Source: Cornell University</div>`;
            
            // arXiv 是外部連結，後端無法簽名，所以維持 handlePublicShare (複製連結)
            actionHtml = `
                <button class="action-btn ai-summary" title="Preview Abstract" style="color: #f59e0b;" onclick="handleExternalSummary(${index})">✨</button>
                <button class="action-btn download" title="Save to My Collection" style="color: #10b981;" onclick="handleSaveToCollection(${index})">📥</button>
                <button class="action-btn share" title="Copy Link" onclick="handlePublicShare('${safeKey}')">➦</button>
            `;
        }

        const html = `
            <div class="file-row" onclick="handleViewFile('${safeKey}')" style="cursor: pointer;">
                <div class="file-content-top">
                    <div class="file-icon">${icon}</div>
                    <div class="file-info">
                        <div class="file-title" title="${displayName}">${displayName}</div>
                        <div class="file-meta">
                            ${tagHtml}
                            ${file.size}
                        </div>
                        ${contributorHtml}
                    </div>
                </div>
                <div class="file-actions" onclick="event.stopPropagation();">
                    ${actionHtml}
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function getFileIcon(fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.pdf')) return '📕';
    if (lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx')) return '📊';
    if (lowerName.match(/\.(jpg|jpeg|png|gif)$/)) return '🖼️';
    if (lowerName.endsWith('.txt')) return '📄';
    return '📁'; 
}

// ==========================================
// 5. 抓取外部論文 (arXiv)
// ==========================================

// ==========================================
// 5. 抓取外部論文 (arXiv) - 已修正 Proxy
// ==========================================

async function fetchArxivPapers(query) {
    // arXiv API 原始網址
    const targetUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5`;
    
    // ❌ 舊的 (corsproxy.io 目前似乎掛了)
    // const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    // ✅ 新的建議 (使用 AllOrigins，通常較穩定)
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    try {
        console.log(`正在透過 Proxy 抓取 arXiv: ${proxyUrl}`);
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
        
        const str = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(str, "text/xml");
        const entries = xmlDoc.getElementsByTagName("entry");
        
        const papers = [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            
            // 安全性檢查：確保欄位存在
            const titleElem = entry.getElementsByTagName("title")[0];
            const idElem = entry.getElementsByTagName("id")[0];
            const summaryElem = entry.getElementsByTagName("summary")[0];

            if (!titleElem || !idElem) continue;

            const title = titleElem.textContent.replace(/\n/g, "").trim();
            const id = idElem.textContent;
            const summary = summaryElem ? summaryElem.textContent.trim() : "No abstract available.";
            
            // 轉換 PDF連結
            let pdfLink = id.replace("abs", "pdf");
            if (pdfLink.startsWith("http://")) {
                pdfLink = pdfLink.replace("http://", "https://");
            }
            pdfLink += ".pdf";
            
            papers.push({
                type: 'external',
                key: pdfLink, 
                name: title,
                size: 'arXiv',
                date: new Date(),
                abstract: summary
            });
        }
        return papers;
    } catch (error) {
        console.error("arXiv fetch error:", error);
        // 若發生錯誤，回傳空陣列以免卡住 UI
        return [];
    }
}

// ==========================================
// 6. 使用者互動功能
// ==========================================

async function handleViewSummary(originalKey) {
    if (originalKey.startsWith('http')) {
        showToast('ℹ️', '外部檔案請先轉存');
        return;
    }
    showToast('✨', '正在讀取 AI 摘要...');
    const summaryKey = originalKey + "_summary.txt";
    const s3 = new AWS.S3();
    try {
        await s3.headObject({ Bucket: AWS_CONFIG.s3BucketName, Key: summaryKey }).promise();
        await handleViewFile(summaryKey);
        showToast('✅', '已顯示 AI 摘要');
    } catch (err) {
        showToast('ℹ️', '此檔案尚未生成摘要');
    }
}

async function handlePublishToPublic(s3Key) {
    if (!confirm('確認發佈到公共區？')) return;
    
    showToast('⏳', '正在發佈檔案...');
    const s3 = new AWS.S3();
    const bucket = AWS_CONFIG.s3BucketName;
    
    const parts = s3Key.split('/');
    let targetKey;

    if (parts.length >= 3 && parts[0] === 'uploads') {
        const userEmail = parts[1];
        const fileName = parts.slice(2).join('/');
        targetKey = `public/${userEmail}/${fileName}`;
    } else {
        const fileName = s3Key.split('/').pop();
        targetKey = `public/${fileName}`;
    }

    try {
        await s3.copyObject({ 
            Bucket: bucket, 
            CopySource: encodeURIComponent(`${bucket}/${s3Key}`),
            Key: targetKey
        }).promise();

        try {
            await s3.copyObject({ 
                Bucket: bucket, 
                CopySource: encodeURIComponent(`${bucket}/${s3Key}_summary.txt`),
                Key: `${targetKey}_summary.txt`
            }).promise(); 
        } catch (e) {}

        showToast('🌍', '已發佈至公共區');
        refreshPublicRepository();
    } catch (err) {
        console.error(err);
        showToast('❌', '發佈失敗');
    }
}

async function handleDeleteFile(s3Key) {
    if (!confirm('Move this file to Recycle Bin?')) return;
    
    showToast('🗑️', 'Processing...');
    const idToken = localStorage.getItem('idToken');
    if (!idToken) return;

    try {
        // ★ 修改重點：呼叫 /delete API
        const response = await fetch(AWS_CONFIG.deleteApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': idToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fileName: s3Key })
        });

        const resData = await response.json();

        if (response.ok) {
            showToast('✅', 'File moved to Recycle Bin');
            // 延遲 0.5 秒重新整理，等待後端狀態更新
            setTimeout(refreshFileDashboard, 500);
        } else {
            throw new Error(resData.message || 'Delete failed');
        }
    } catch (err) {
        console.error(err);
        showToast('❌', `Error: ${err.message}`);
    }
}

async function handleRestore(s3Key, versionId) {
    if (!confirm('Restore this file?')) return;

    showToast('⏳', 'Restoring file...');
    const idToken = localStorage.getItem('idToken');
    if (!idToken) return;

    try {
        const response = await fetch(AWS_CONFIG.restoreApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': idToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                fileName: s3Key,
                versionId: versionId 
            })
        });

        const resData = await response.json();

        if (response.ok) {
            // ★★★ 新增重點：還原成功後，將此檔案記錄到 localStorage ★★★
            let recoveredFiles = JSON.parse(localStorage.getItem('recovered_files') || '[]');
            if (!recoveredFiles.includes(s3Key)) {
                recoveredFiles.push(s3Key);
                localStorage.setItem('recovered_files', JSON.stringify(recoveredFiles));
            }

            showToast('✅', 'File restored successfully!');
            setTimeout(refreshFileDashboard, 500);
        } else {
            throw new Error(resData.message || 'Restore failed');
        }
    } catch (err) {
        console.error(err);
        showToast('❌', `Error: ${err.message}`);
    }
}

async function handleDownloadFile(s3Key) {
    showToast('Tn', '準備下載...');

    try {
        if (!AWS_CONFIG.downloadApiUrl) {
            throw new Error('尚未設定 downloadApiUrl');
        }

        // 移除 idToken 的讀取，因為我們暫時不帶 Header
        // const idToken = localStorage.getItem('idToken');
        
        const targetUrl = `${AWS_CONFIG.downloadApiUrl}?fileName=${encodeURIComponent(s3Key)}`;
        console.log("Fetching URL:", targetUrl);

        // ★★★ 修改重點：移除 headers 物件 ★★★
        // 這樣瀏覽器就不會發送 OPTIONS 預檢請求，而是直接發送 GET
        const response = await fetch(targetUrl, {
            method: 'GET' 
            // ❌ 刪除下面這段 headers
            // headers: {
            //     'Content-Type': 'application/json',
            //     'Authorization': idToken || ''
            // }
        });

        if (!response.ok) {
            throw new Error(`API 請求失敗: ${response.status}`);
        }

        const data = await response.json();
        const downloadUrl = data.downloadUrl;

        if (!downloadUrl) {
            throw new Error('無法取得下載連結');
        }

        const link = document.createElement('a');
        link.href = downloadUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('✅', '下載已開始');

    } catch (err) {
        console.error("Download Error:", err);
        showToast('❌', '下載失敗，請檢查網路或權限');
    }
}

async function handleSaveToCollection(index) {
    const fileData = window.currentSearchResults[index];
    if (!fileData) return;

    const userEmail = AppState.currentUserEmail || document.getElementById('statusBarEmail')?.innerText;
    if (!userEmail) { showToast('❌', '請先登入'); return; }

    showToast('📥', '正在儲存至我的收藏...');
    
    try {
        let blob = null;
        try {
            const secureUrl = fileData.key.startsWith('http://') ? fileData.key.replace('http://', 'https://') : fileData.key;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(secureUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('Proxy A Failed');
            blob = await response.blob();
        } catch (err) {
            const backupUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fileData.key)}`;
            const resB = await fetch(backupUrl);
            blob = await resB.blob();
        }

        if (!blob) throw new Error('Download failed');

        const s3 = new AWS.S3();
        const safeName = fileData.name.replace(/[^a-zA-Z0-9-_.]/g, '_') + '.pdf';
        const uploadKey = `uploads/${userEmail}/${safeName}`;

        await s3.putObject({
            Bucket: AWS_CONFIG.s3BucketName,
            Key: uploadKey,
            Body: blob,
            ContentType: 'application/pdf'
        }).promise();

        showToast('✅', '已儲存至我的收藏');
        refreshFileDashboard();

    } catch (err) {
        console.error(err);
        showToast('❌', '儲存失敗');
    }
}

async function handlePublicShare(key) {
    if (!key.startsWith('http')) {
        showToast('ℹ️', 'S3 檔案請使用下載功能');
        return;
    }
    await navigator.clipboard.writeText(key);
    showToast('🔗', '連結已複製');
}

/**
 * 處理檔案分享 (發送通知)
 * @param {string} s3Key 檔案的 S3 Key
 */
async function handleFileShare(s3Key) {
    // 檢查 s3Key 是否存在
    if (!s3Key) {
        console.error("Missing s3Key!");
        return;
    }

    const recipientEmail = prompt("請輸入收件者的 Email：");
    if (!recipientEmail) return;

    const customMessage = prompt("輸入分享訊息：", "這是透過 Dropbex 分享給您的檔案。");
    
    // 提取純檔名供顯示
    const fileName = s3Key.split('/').pop();

    showToast('⏳', '正在發送分享通知...');

    try {
        const response = await fetch(AWS_CONFIG.shareFileUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem('idToken') || ''
            },
            body: JSON.stringify({
                fileName: fileName,      // 檔名
                s3Key: s3Key,           // ✨ 關鍵：必須傳送完整的 S3 路徑
                recipientEmail: recipientEmail,
                customMessage: customMessage
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('✅', `分享信件已發送至 ${recipientEmail}`);
        } else {
            throw new Error(data.error || '發送失敗');
        }
    } catch (err) {
        console.error("Share Error:", err);
        showToast('❌', `分享失敗: ${err.message}`);
    }
}

// dashboard.js 中的實作
async function silentSubscribe(email) {
    try {
        await fetch(AWS_CONFIG.subscribeTopicUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        console.log("SNS 訂閱請求已發送至:", email);
    } catch (err) {
        console.error("SNS 自動訂閱失敗:", err);
    }
}
window.silentSubscribe = silentSubscribe; // 綁定到全域

// ==========================================
// 7. 閱讀器功能
// ==========================================

async function handleViewFile(inputKey) {
    if (!ensureAWSCredentials()) return;
    const viewer = document.getElementById('docViewer');
    const placeholder = document.getElementById('viewerPlaceholder');
    const titleDisp = document.getElementById('currentViewingTitle');
    
    let fileName = inputKey.split('/').pop();
    if (inputKey.endsWith('_summary.txt')) fileName = "AI Summary";
    
    if (titleDisp) titleDisp.innerText = `Reading: ${decodeURIComponent(fileName)}`;
    showToast('📖', `載入中...`);

    let url;
    if (inputKey.startsWith('http')) {
        url = inputKey;
    } else {
        const s3 = new AWS.S3();
        const params = { Bucket: AWS_CONFIG.s3BucketName, Key: inputKey, Expires: 3600, ResponseContentDisposition: 'inline' };
        if (fileName.toLowerCase().endsWith('.pdf')) params.ResponseContentType = 'application/pdf';
        else if (fileName.toLowerCase().endsWith('.txt')) params.ResponseContentType = 'text/plain; charset=utf-8';
        
        try { url = await s3.getSignedUrlPromise('getObject', params); } catch (err) { return; }
    }
    
    if (placeholder) placeholder.style.display = 'none';
    if (viewer) { viewer.style.display = 'block'; viewer.src = url; }
}

function handleExternalSummary(index) {
    const fileData = window.currentSearchResults[index];
    if (!fileData || !fileData.abstract) { showToast('ℹ️', '無摘要'); return; }
    
    const viewer = document.getElementById('docViewer');
    const placeholder = document.getElementById('viewerPlaceholder');
    const titleDisp = document.getElementById('currentViewingTitle');

    if (titleDisp) titleDisp.innerText = `Abstract Preview`;
    
    const htmlContent = `
        <div style="padding: 40px; font-family: sans-serif; line-height: 1.6;">
            <h2>${fileData.name}</h2>
            <p style="color: #666; font-size: 0.9em;">Source: arXiv</p>
            <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
            <p>${fileData.abstract}</p>
            <br>
            <button onclick="parent.handleSaveToCollection(${index})" style="background:#10b981; color:white; border:none; padding:10px 20px; border-radius:5px; cursor:pointer;">
                📥 Save to Collection
            </button>
        </div>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    if (placeholder) placeholder.style.display = 'none';
    if (viewer) { viewer.style.display = 'block'; viewer.src = url; }
    
    showToast('✨', '已顯示摘要預覽');
}

function closeViewer() {
    const viewer = document.getElementById('docViewer');
    const placeholder = document.getElementById('viewerPlaceholder');
    if (viewer) { viewer.src = ""; viewer.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
}

// ==========================================
// 8. 全域綁定
// ==========================================

window.refreshAllDashboards = refreshAllDashboards;
window.handleCrawlerSearch = handleCrawlerSearch;
window.handleViewSummary = handleViewSummary;
window.handlePublishToPublic = handlePublishToPublic;
window.handleDeleteFile = handleDeleteFile;
window.handleDownloadFile = handleDownloadFile;
window.handleSaveToCollection = handleSaveToCollection;
window.handlePublicShare = handlePublicShare;
window.handleFileShare = handleFileShare;
window.switchListTab = switchListTab;
window.handleViewFile = handleViewFile;
window.handleRestore = handleRestore;
window.handleExternalSummary = handleExternalSummary;