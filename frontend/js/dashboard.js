/**
 * Dashboard Module - Dropbex
 * 核心功能模組：負責檔案列表管理、外部爬蟲、轉存邏輯與互動功能
 */

// ==========================================
// 1. AWS 初始化與憑證管理 (Auth & Init)
// ==========================================

function ensureAWSCredentials() {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
        // 清除憑證以避免狀態不一致
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
 * [新增功能] 自動初始化 S3 資料夾結構 (僅在不存在時執行)
 * 確保 uploads/, public/, 以及 uploads/{userEmail}/ 存在
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
            // 使用 headObject 檢查該路徑是否存在
            await s3.headObject({
                Bucket: AWS_CONFIG.s3BucketName,
                Key: folderKey
            }).promise();
            // console.log(`✅ 目錄已存在: ${folderKey}`);
        } catch (err) {
            // 404 代表不存在，這時才執行建立動作
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
 * 觸發時機：登入成功、頁面載入、操作完成後
 */
async function refreshAllDashboards() {
    console.log("🔄 同步所有儀表板資料...");
    
    // 檢查憑證，若無效則顯示提示
    if (!ensureAWSCredentials()) {
        console.log("⚠️ 尚未登入，停止同步");
        document.getElementById('fileDashboardList').innerHTML = '<div class="empty-state-gray">請先登入以查看檔案</div>';
        return;
    }

    // --- [修改點] 在同步資料前，先執行自動資料夾初始化 ---
    // 嘗試從 AppState 或介面獲取 Email
    let userEmail = null;
    if (typeof AppState !== 'undefined' && AppState.currentUserEmail) {
        userEmail = AppState.currentUserEmail;
    } else {
        const emailElem = document.getElementById('statusBarEmail');
        if (emailElem) userEmail = emailElem.innerText;
    }

    // 如果成功獲取 Email，執行初始化
    if (userEmail && userEmail.includes('@')) {
        await autoInitializeFolders(userEmail);
    }
    // -----------------------------------------------------

    refreshFileDashboard();    
    refreshPublicRepository(); 
}

// ==========================================
// 2. 資料獲取邏輯 (Data Fetching)
// ==========================================

/**
 * 讀取 My Collection (S3 個人區)
 */
function refreshFileDashboard() {
    const container = document.getElementById('fileDashboardList');
    if (!container) return;

    let userEmail = AppState.currentUserEmail || document.getElementById('statusBarEmail')?.innerText;
    
    // 嚴格檢查 Email 格式
    if (!userEmail || !userEmail.includes('@') || userEmail.includes('user@')) return;

    const s3 = new AWS.S3();
    const userPrefix = `uploads/${userEmail}/`;
    
    container.innerHTML = '<div class="loading-state">⏳ 讀取個人收藏...</div>';

    s3.listObjectsV2({ Bucket: AWS_CONFIG.s3BucketName, Prefix: userPrefix }, (err, data) => {
        if (err) {
            console.error("❌ 個人區讀取失敗:", err);
            // 處理憑證過期錯誤
            if (err.code === 'CredentialsError' || err.statusCode === 400 || err.statusCode === 403) {
                container.innerHTML = `
                    <div class="error-state">
                        ⚠️ 連線逾時<br>
                        <button onclick="window.location.reload()" style="margin-top:10px; padding:5px 10px; cursor:pointer;">重整頁面</button>
                    </div>`;
            } else {
                container.innerHTML = `<div class="error-state">Error: ${err.message}</div>`;
            }
            return;
        }

        // 過濾掉資料夾本身與系統檔案
        const files = data.Contents ? data.Contents.filter(item => 
            item.Key !== userPrefix && !item.Key.endsWith('_summary.txt')
        ) : [];

        if (files.length === 0) {
            container.innerHTML = '<div class="empty-state-gray">目前沒有資料</div>';
            return;
        }
        renderUserFileList(files, userPrefix);
    });
}

/**
 * 讀取 Public Repository (S3 公共區)
 */
function refreshPublicRepository() {
    const publicContainer = document.getElementById('publicFileList');
    if (!publicContainer) return;

    const s3 = new AWS.S3();
    const publicPrefix = 'public/';

    publicContainer.innerHTML = '<div class="loading-state">🔍 讀取公共資源...</div>';

    s3.listObjectsV2({ Bucket: AWS_CONFIG.s3BucketName, Prefix: publicPrefix }, (err, data) => {
        if (err) {
            publicContainer.innerHTML = `<div class="empty-state-gray">無法讀取公共區 (請確認登入狀態)</div>`;
            return;
        }

        const files = data.Contents ? data.Contents.filter(item => 
            item.Key !== publicPrefix && !item.Key.endsWith('_summary.txt')
        ) : [];

        // 格式化資料
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
 * 外部爬蟲 (arXiv API)
 */
async function fetchArxivPapers(query) {
    const targetUrl = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
        
        const str = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(str, "text/xml");
        const entries = xmlDoc.getElementsByTagName("entry");
        
        const papers = [];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const title = entry.getElementsByTagName("title")[0].textContent.replace(/\n/g, "").trim();
            const id = entry.getElementsByTagName("id")[0].textContent;
            const summary = entry.getElementsByTagName("summary")[0].textContent.trim();
            
            // 將 arXiv ID 轉換為 PDF 連結，並強制使用 HTTPS
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
        return [];
    }
}

// ==========================================
// 3. 搜尋邏輯 (Search Logic)
// ==========================================

async function handleCrawlerSearch() {
    if (!ensureAWSCredentials()) {
        showToast('⚠️', '請先登入');
        return;
    }

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

        // 1. 搜尋 S3 內部
        const s3Promise = s3.listObjectsV2({ Bucket: AWS_CONFIG.s3BucketName, Prefix: publicPrefix }).promise()
            .then(data => {
                return (data.Contents || [])
                    .filter(item => item.Key !== publicPrefix && !item.Key.endsWith('_summary.txt'))
                    .filter(item => item.Key.toLowerCase().includes(query.toLowerCase()))
                    .map(file => ({
                        type: 's3',
                        key: file.Key,
                        name: file.Key.replace('public/', ''),
                        size: formatFileSize(file.Size),
                        date: file.LastModified
                    }));
            });

        // 2. 搜尋 arXiv 外部
        const arxivPromise = fetchArxivPapers(query);

        // 3. 合併結果
        const [s3Files, arxivFiles] = await Promise.all([s3Promise, arxivPromise]);
        const allFiles = [...s3Files, ...arxivFiles];

        if (allFiles.length === 0) {
            container.innerHTML = '<div class="empty-state-gray">找不到相關論文</div>';
            return;
        }

        // 儲存搜尋結果供互動使用
        window.currentSearchResults = allFiles;
        renderPublicFileList(allFiles);

    } catch (err) {
        console.error("Search failed:", err);
        container.innerHTML = '<div class="error-state">搜尋發生錯誤</div>';
    }
}

// ==========================================
// 4. 渲染邏輯 (UI Rendering)
// ==========================================

/**
 * 渲染 My Collection 列表
 */
function renderUserFileList(files, prefix) {
    const container = document.getElementById('fileDashboardList');
    container.innerHTML = ''; 
    files.sort((a, b) => b.LastModified - a.LastModified);

    files.forEach(file => {
        const fileName = file.Key.replace(prefix, '');
        const fileSize = formatFileSize(file.Size);
        const safeKey = file.Key.replace(/'/g, "\\'"); 
        const icon = getFileIcon(fileName);

        const html = `
            <div class="file-row" onclick="handleViewFile('${safeKey}')" style="cursor: pointer;">
                <div class="file-content-top">
                    <div class="file-icon">${icon}</div>
                    <div class="file-info">
                        <div class="file-title" title="${fileName}">${fileName}</div>
                        <div class="file-meta">
                            <span class="status-tag status-stored">Stored</span>
                            ${fileSize}
                        </div>
                    </div>
                </div>
                
                <div class="file-actions" onclick="event.stopPropagation();">
                    <button class="action-btn ai-summary" title="AI Summary" style="color: #f59e0b;" onclick="handleViewSummary('${safeKey}')">✨</button>
                    <button class="action-btn publish" title="Publish to Public" style="color: #3b82f6;" onclick="handlePublishToPublic('${safeKey}')">🌍</button>
                    <button class="action-btn share" title="Share (Dev)" onclick="handleTeamShare('${safeKey}')">➦</button>
                    <button class="action-btn delete" title="Delete" onclick="handleDeleteFile('${safeKey}')">✕</button>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

/**
 * 渲染 Public Repository 列表
 */
function renderPublicFileList(files) {
    const container = document.getElementById('publicFileList');
    container.innerHTML = ''; 
    
    files.sort((a, b) => b.date - a.date);

    files.forEach((file, index) => {
        const safeKey = file.key.replace(/'/g, "\\'"); 
        
        let icon, tagHtml, actionHtml;

        if (file.type === 's3') {
            // S3 Public 檔案
            icon = getFileIcon(file.name);
            tagHtml = `<span class="status-tag status-stored" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">Public</span>`;
            actionHtml = `
                <button class="action-btn ai-summary" title="AI Summary" style="color: #f59e0b;" onclick="handleViewSummary('${safeKey}')">✨</button>
                <button class="action-btn share" title="Copy Link" onclick="handlePublicShare('${safeKey}')">➦</button>
                <button class="action-btn download" title="Download" onclick="handleDownloadFile('${safeKey}')">⬇</button>
            `;
        } else {
            // arXiv 外部檔案
            icon = '🌐';
            tagHtml = `<span class="status-tag status-stored" style="background: #fef3c7; color: #d97706; border-color: #fcd34d;">arXiv</span>`;
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
                        <div class="file-title" title="${file.name}">${file.name}</div>
                        <div class="file-meta">
                            ${tagHtml}
                            ${file.size}
                        </div>
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
// 5. 使用者互動功能 (User Actions)
// ==========================================

/**
 * 轉存外部檔案到 My Collection (雙重 Proxy 機制)
 */
async function handleSaveToCollection(index) {
    if (!ensureAWSCredentials()) return;
    
    const fileData = window.currentSearchResults[index];
    if (!fileData) return;
    
    const userEmail = AppState.currentUserEmail || document.getElementById('statusBarEmail')?.innerText;
    if (!userEmail) { showToast('❌', '請先登入'); return; }

    showToast('⏳', '正在下載 PDF...');
    
    try {
        let blob = null;
        try {
            // 策略 A: corsproxy.io
            const secureUrl = fileData.key.startsWith('http://') ? fileData.key.replace('http://', 'https://') : fileData.key;
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(secureUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            blob = await response.blob();
        } catch (errA) {
            console.warn("Proxy A failed, trying Proxy B...");
            try {
                // 策略 B: CodeTabs
                const backupProxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fileData.key)}`;
                const responseB = await fetch(backupProxyUrl);
                if (!responseB.ok) throw new Error(`Status ${responseB.status}`);
                blob = await responseB.blob();
            } catch (errB) { throw new Error("All proxies failed."); }
        }
        if (!blob) throw new Error("Empty file");

        showToast('📤', '上傳至 S3...');
        const s3 = new AWS.S3();
        const safeName = fileData.name.replace(/[^a-zA-Z0-9-_]/g, '_') + '.pdf';
        const uploadKey = `uploads/${userEmail}/${safeName}`;
        
        const params = { Bucket: AWS_CONFIG.s3BucketName, Key: uploadKey, Body: blob, ContentType: 'application/pdf' };
        await s3.putObject(params).promise();

        showToast('✅', '轉存成功！等待 AI 摘要...');
        setTimeout(() => { refreshFileDashboard(); }, 2000);
    } catch (err) { 
        console.error('Save failed', err); 
        showToast('❌', '轉存失敗，請稍後重試'); 
    }
}

/**
 * 發佈到 Public Repository
 */
async function handlePublishToPublic(s3Key) {
    if (!confirm('確認發佈到公共區 (含摘要)？\n這將使檔案對所有人可見。')) return;
    if (!ensureAWSCredentials()) return;
    
    const s3 = new AWS.S3();
    const fileName = s3Key.split('/').pop();
    const bucket = AWS_CONFIG.s3BucketName;
    showToast('⏳', '發佈中...');

    try {
        await s3.copyObject({ Bucket: bucket, CopySource: encodeURIComponent(`${bucket}/${s3Key}`), Key: `public/${fileName}` }).promise();
        // 嘗試複製摘要檔案
        try { await s3.copyObject({ Bucket: bucket, CopySource: encodeURIComponent(`${bucket}/${s3Key}_summary.txt`), Key: `public/${fileName}_summary.txt` }).promise(); } catch (e) {}
        
        showToast('✅', '已發佈到公共區！');
        refreshPublicRepository(); 
    } catch (err) { showToast('❌', '發佈失敗'); }
}

function handleTeamShare(s3Key) {
    showToast('ℹ️', 'Share 功能由其他小組成員開發中');
}

async function handleDeleteFile(s3Key) {
    if (!confirm('永久刪除此檔案？')) return;
    if (!ensureAWSCredentials()) return;
    
    const s3 = new AWS.S3();
    try {
        await s3.deleteObject({ Bucket: AWS_CONFIG.s3BucketName, Key: s3Key }).promise();
        try { await s3.deleteObject({ Bucket: AWS_CONFIG.s3BucketName, Key: s3Key + "_summary.txt" }).promise(); } catch(e){}
        showToast('✅', '刪除成功');
        refreshFileDashboard(); 
    } catch (err) { showToast('❌', '刪除失敗'); }
}

async function handleDownloadFile(s3Key) {
    if (!ensureAWSCredentials()) return;
    const s3 = new AWS.S3();
    try {
        const url = await s3.getSignedUrlPromise('getObject', { Bucket: AWS_CONFIG.s3BucketName, Key: s3Key, Expires: 300 });
        const a = document.createElement('a'); a.href = url; a.download = s3Key.split('/').pop();
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showToast('✅', '下載已開始');
    } catch (err) { showToast('❌', '下載失敗'); }
}

async function handlePublicShare(key) {
    if (!key.startsWith('http')) { showToast('ℹ️', 'S3 檔案請使用下載功能'); return; }
    await navigator.clipboard.writeText(key);
    showToast('🔗', '連結已複製');
}

// ==========================================
// 6. 閱讀器功能 (Document Viewer)
// ==========================================

async function handleViewFile(inputKey) {
    if (!ensureAWSCredentials()) return;
    const viewer = document.getElementById('docViewer');
    const placeholder = document.getElementById('viewerPlaceholder');
    const titleDisp = document.getElementById('currentViewingTitle');
    
    const fileName = inputKey.split('/').pop();
    let displayTitle = `Reading: ${decodeURIComponent(fileName)}`;
    if (inputKey.endsWith('_summary.txt')) displayTitle = `🤖 AI Summary`;
    if (titleDisp) titleDisp.innerText = displayTitle;
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

async function handleViewSummary(originalKey) {
    if (originalKey.startsWith('http')) { showToast('ℹ️', '外部檔案請先轉存'); return; }
    const summaryKey = originalKey + "_summary.txt";
    showToast('✨', `正在讀取摘要...`);
    
    const s3 = new AWS.S3();
    try {
        await s3.headObject({ Bucket: AWS_CONFIG.s3BucketName, Key: summaryKey }).promise();
        handleViewFile(summaryKey);
    } catch (err) { showToast('ℹ️', '此檔案尚未生成摘要'); }
}

function handleExternalSummary(index) {
    const fileData = window.currentSearchResults[index];
    if (!fileData || !fileData.abstract) { showToast('ℹ️', '無摘要'); return; }
    
    const viewer = document.getElementById('docViewer');
    const placeholder = document.getElementById('viewerPlaceholder');
    const titleDisp = document.getElementById('currentViewingTitle');

    if (titleDisp) titleDisp.innerText = `Abstract Preview: ${fileData.name}`;
    
    // 生成臨時預覽頁面
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
}

function closeViewer() {
    const viewer = document.getElementById('docViewer');
    const placeholder = document.getElementById('viewerPlaceholder');
    if (viewer) { viewer.src = ""; viewer.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
}

// ==========================================
// 7. 全域方法綁定 (Exports)
// ==========================================

window.refreshAllDashboards = refreshAllDashboards;
window.handleCrawlerSearch = handleCrawlerSearch; 
window.renderFileDashboard = refreshAllDashboards;
window.handleSaveToCollection = handleSaveToCollection; 
window.handleExternalSummary = handleExternalSummary;
window.handlePublishToPublic = handlePublishToPublic;
window.handleTeamShare = handleTeamShare;