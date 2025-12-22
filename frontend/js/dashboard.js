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
    console.log(`cognito-idp.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.userPoolId}`);
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

/**
 * 讀取 My Collection (S3 個人區)
 */
async function refreshFileDashboard() {
  console.log('Refreshing dashboard...', 'API:', AWS_CONFIG.ApiUrl);
  
  const container = document.getElementById('fileDashboardList');
  if (!container) return;

  if (!AppState.isLoggedIn) {
    container.innerHTML = '<div class="empty-state">請先登入</div>';
    return;
  }
  // 1. 取得使用者 Email 並建立 prefix
  const userEmail = AppState.currentUserEmail || document.getElementById('statusBarEmail')?.innerText;
  if (!userEmail || !userEmail.includes('@')) {
      container.innerHTML = '<div class="empty-state">無法識別使用者 Email</div>';
      return;
  }
  const prefix = `uploads/${userEmail}/`;

  container.innerHTML = '<div class="loading-state">載入中...</div>';

  try {
    // ✅ 修正點：API 請求加上 ?prefix=
    const response = await fetch(`${AWS_CONFIG.ApiUrl}/files?prefix=${encodeURIComponent(prefix)}`, {
      method: 'GET',
      headers: {
        'Authorization': localStorage.getItem('idToken')
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', data);
    const files = data.files;

    if (files.length === 0) {
      container.innerHTML = '<div class="empty-state">無檔案</div>';
      return;
    }

    // ✅ 使用正確的渲染函數
    renderUserFileList(files, prefix);

  } catch (err) {
    console.error('List files failed:', err);
    container.innerHTML = `<div class="error-state">載入失敗: ${err.message}</div>`;
  }
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

function renderUserFileList(files, prefix) {
    const container = document.getElementById('fileDashboardList');
    if(!container) return;
    container.innerHTML = ''; 
    files.sort((a, b) => b.LastModified - a.LastModified);

    files
        .filter(file => !file.Key.endsWith('/')) // ✅ 過濾掉資料夾本身
        .forEach(file => {
        // ✅ 支援 isDeleted
        const isDeleted = file.isDeleted || false;
        const fileName = file.Key.replace(prefix, '');
        const fileSize = formatFileSize(file.Size);
        const safeKey = file.Key.replace(/'/g, "\\'"); 
        const icon = getFileIcon(fileName);

        // ✅ 動態生成狀態標籤
        const statusTag = isDeleted 
            ? `<span class="status-tag status-deleted" style="background:#fee2e2; color:#dc2626;">Deleted</span>`
            : `<span class="status-tag status-stored">Stored</span>`;

        // ✅ 動態生成按鈕：刪除 vs 恢復
        // 注意：恢復需要 versionId
        const actionBtn = isDeleted
            ? `<button class="action-btn restore" title="Restore" style="color: green;" onclick="handleRestore('${safeKey}', '${file.VersionId}')">↩</button>`
            : `<button class="action-btn delete" title="Delete" onclick="handleDeleteFile('${safeKey}')">✕</button>`;

        // ✅ 樣式調整：已刪除則半透明 + 刪除線
        const rowStyle = isDeleted ? 'opacity: 0.7; background: #f9fafb;' : 'cursor: pointer;';
        const titleStyle = isDeleted ? 'text-decoration: line-through; color: #888;' : '';

        const html = `
            <div class="file-row" style="${rowStyle}" ${isDeleted ? '' : `onclick="handleViewFile('${safeKey}')"`}>
                <div class="file-content-top">
                    <div class="file-icon">${icon}</div>
                    <div class="file-info">
                        <div class="file-title" style="${titleStyle}" title="${fileName}">${fileName}</div>
                        <div class="file-meta">
                            ${statusTag}
                            ${fileSize}
                        </div>
                    </div>
                </div>
                
                <div class="file-actions" onclick="event.stopPropagation();">
                    ${!isDeleted ? `<button class="action-btn ai-summary" title="AI Summary" style="color: #f59e0b;" onclick="handleViewSummary('${safeKey}')">✨</button>` : ''}
                    ${!isDeleted ? `<button class="action-btn publish" title="Publish to Public" style="color: #3b82f6;" onclick="handlePublishToPublic('${safeKey}')">🌍</button>` : ''}
                    ${!isDeleted ? `<button class="action-btn share" title="Share (Dev)" onclick="handleTeamShare('${safeKey}')">➦</button>` : ''}
                    ${actionBtn}
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
    
    // 注意：搜尋時若需要維持 S3 在上的順序，則不應在此依日期全局重新排序
    // 除非檔案類型相同時才比對日期。

    files.forEach((file, index) => {
        const safeKey = file.key.replace(/'/g, "\\'"); 
        
        let icon, tagHtml, actionHtml;
        let displayName = file.name;
        let contributorHtml = '';

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
            actionHtml = `
                <button class="action-btn ai-summary" title="AI Summary" style="color: #f59e0b;" onclick="handleViewSummary('${safeKey}')">✨</button>
                <button class="action-btn share" title="Copy Link" onclick="handlePublicShare('${safeKey}')">➦</button>
                <button class="action-btn download" title="Download" onclick="handleDownloadFile('${safeKey}')">⬇</button>
            `;
        } else {
            icon = '🌐';
            tagHtml = `<span class="status-tag status-stored" style="background: #fef3c7; color: #d97706; border-color: #fcd34d;">arXiv</span>`;
            contributorHtml = `<div style="font-size: 11px; color: #6b7280; margin-top: 2px;">🏫 Source: Cornell University</div>`;
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


// ✅ 修正為（調用 API）
async function handleDeleteFile(s3Key) {
  const fileName = s3Key.split('/').pop(); 
    // ✅ 修改確認提示
  if (!confirm(`確定要刪除 "${fileName}" 嗎？\n\n注意：檔案將移至回收區，並在 30 天後自動永久刪除。`)) return;
  showToast('🗑️', '正在移至回收區...');
  try {
    const response = await fetch(`${AWS_CONFIG.ApiUrl}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: s3Key })
    });
    
    if (response.ok) {
      showToast('✅', '檔案已移至回收區 (30天保留期)');
      refreshFileDashboard();  // 重新載入，顯示 Delete Marker
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || '刪除失敗');
    }
  } catch (error) {
    showToast('❌','刪除錯誤: ' + error.message);
  }
}

async function handleRestore(key, versionId) {
if (!confirm('確定要還原此檔案嗎？')) return;
  if (!versionId) {
    showToast('缺少版本 ID');
    return;
  }
  showToast('⏳', '正在還原檔案...');
  try {
    const response = await fetch(`${AWS_CONFIG.ApiUrl}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        key: key, 
        versionId: versionId 
      })
    });
    
    if (response.ok) {
       showToast('✅', '檔案已成功還原');
      refreshFileDashboard();
    } else {
      throw new Error('還原失敗');
    }
  } catch (error) {
    showToast('❌', '還原錯誤: ' + error.message);
  }
}


async function handleDownloadFile(s3Key) {
    showToast('⬇️', '下載已開始');
    const s3 = new AWS.S3();
    try {
        const url = await s3.getSignedUrlPromise('getObject', { 
            Bucket: AWS_CONFIG.s3BucketName,
            Key: s3Key, 
            Expires: 300 
        });
        const a = document.createElement('a'); a.href = url;
        a.download = s3Key.split('/').pop();
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) {
        showToast('❌', '下載失敗');
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

function handleTeamShare(s3Key) {
    showToast('ℹ️', '此功能開發中 (Team Share)');
}

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
window.handleTeamShare = handleTeamShare;
window.switchListTab = switchListTab;
window.handleViewFile = handleViewFile;
window.handleExternalSummary = handleExternalSummary;