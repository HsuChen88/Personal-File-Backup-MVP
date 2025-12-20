/**
 * Authentication Module
 * Handles login, registration, logout, and layout switching
 * 身分驗證模組：處理登入、註冊、登出及介面切換
 */

/**
 * Switch between login and register tabs
 * 切換登入與註冊分頁
 * @param {string} tab - 'login' or 'register'
 */
function switchTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const confirmSection = document.getElementById('confirmSection');

    // 如果正在顯示驗證區塊，鎖定分頁標籤，不切換內容以防找不到輸入框
    if (confirmSection && confirmSection.style.display === 'block') {
        tabs.forEach(t => t.classList.remove('active'));
        if (tab === 'login') tabs[0].classList.add('active');
        else tabs[1].classList.add('active');
        return; 
    }

    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    // 確保切換時隱藏所有區塊
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (confirmSection) confirmSection.style.display = 'none';

    if (tab === 'login') {
        tabs[0].classList.add('active');
        if (loginForm) {
            loginForm.classList.add('active');
            loginForm.style.display = 'block';
        }
    } else {
        tabs[1].classList.add('active');
        if (registerForm) {
            registerForm.classList.add('active');
            registerForm.style.display = 'block';
        }
    }
}

/**
 * Handle Login Form Submission
 * 處理登入表單提交
 */
function handleLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const btn = document.getElementById('loginSubmitBtn');

    if (!email || !password) {
        showToast('⚠️', 'Please fill in all fields');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.appClientId };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: email,
        Password: password
    });

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: email,
        Pool: userPool
    });

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
            // 獲取 ID Token 並儲存，供後續 API 調用使用
            const idToken = result.getIdToken().getJwtToken();
            localStorage.setItem('idToken', idToken);
            
            showToast('✅', 'Successfully logged in!');
            switchToLoggedInLayout(email);
            btn.disabled = false;
            btn.textContent = 'Login';
        },
        onFailure: function (err) {
            showToast('❌', err.message || 'Login failed');
            btn.disabled = false;
            btn.textContent = 'Login';
        }
    });
}

/**
 * Handle Register Form Submission
 * 處理註冊表單提交
 */
function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value.trim(); 
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const btn = document.getElementById('registerSubmitBtn');

    // 1. 基本前端驗證
    if (password !== confirmPassword) {
        showToast('❌', 'Passwords do not match');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Processing...';

    // 2. 初始化 Cognito UserPool
    const poolData = {
        UserPoolId: AWS_CONFIG.userPoolId,
        ClientId: AWS_CONFIG.appClientId
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    // 3. 設定必要屬性 (Email)
    const attributeList = [new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email })];

    // 4. 執行註冊
    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            // --- 關鍵修正：偵測帳號已存在錯誤 ---
            if (err.code === 'UsernameExistsException') {
                showToast('ℹ️', 'Account exists. Redirecting to verification...');
                // 直接調用顯示驗證畫面的函數
                showConfirmSection(email);
            } else {
                showToast('❌', err.message || 'Registration failed'); 
            }
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }
        
        // 正常註冊成功流程
        showToast('📧', 'Code sent to your email!');
        showConfirmSection(email);

        btn.disabled = false;
        btn.textContent = 'Create Account';
    });
}

/**
 * Handle Account Verification (Confirm Registration)
 * 處理驗證碼確認
 */
function handleConfirmRegistration() {
    const email = document.getElementById('registerEmail').value.trim();
    const code = document.getElementById('confirmCode').value.trim();
    const btn = document.getElementById('confirmSubmitBtn');

    if (!code) {
        showToast('⚠️', 'Please enter the code');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Verifying...';

    const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.appClientId };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: email,
        Pool: userPool
    });

    cognitoUser.confirmRegistration(code, true, function(err, result) {
        if (err) {
            showToast('❌', err.message || 'Invalid verification code');
            btn.disabled = false;
            btn.textContent = 'Confirm Account';
            return;
        }
        
        showToast('✅', 'Account confirmed! You can now login.');
        // 驗證成功，隱藏驗證區塊並切換回登入分頁
        document.getElementById('confirmSection').style.display = 'none';
        switchTab('login');
        
        btn.disabled = false;
        btn.textContent = 'Confirm Account';
    });
}

/**
 * Resend Verification Code
 * 重發驗證碼
 */
function resendCode() {
    const email = document.getElementById('registerEmail').value.trim();
    if (!email) {
        showToast('❌', 'Email is required to resend code');
        return;
    }

    const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.appClientId };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: email,
        Pool: userPool
    });

    cognitoUser.resendConfirmationCode(function(err, result) {
        if (err) {
            showToast('❌', err.message || 'Resend failed');
            return;
        }
        showToast('📧', 'A new verification code has been sent.');
    });
}

/**
 * Back to Registration Form
 * 從驗證畫面返回註冊表單
 */
function handleBackToRegistration() {
    document.getElementById('confirmSection').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    switchTab('register');
}

/**
 * Handle Logout
 * 處理登出
 */
function handleLogout() {
    const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.appClientId };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const cognitoUser = userPool.getCurrentUser();

    if (cognitoUser) {
        cognitoUser.signOut();
    }

    localStorage.removeItem('idToken'); // 清除 Token

    // 切換回登入佈局
    switchToLoginLayout();

    // 重置表單內容
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();

    showToast('✅', 'Logged out successfully');
}

/**
 * Switch to logged in layout
 * 切換至登入後佈局
 * @param {string} email - User email
 */
function switchToLoggedInLayout(email) {
    // 隱藏身分驗證卡片與登入前之上傳卡片
    const authCard = document.getElementById('authCard');
    if (authCard) authCard.style.display = 'none';
    
    const beforeLoginCard = document.getElementById('uploadCardBeforeLogin');
    if (beforeLoginCard) beforeLoginCard.style.display = 'none';
    
    // 顯示狀態列
    const statusBar = document.getElementById('statusBar');
    if (statusBar) statusBar.classList.add('visible');
    document.getElementById('statusBarEmail').textContent = email;
    
    // 顯示登入後的功能區 (上傳 + 儀表板)
    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) loggedInGrid.classList.add('visible');
    
    // 渲染儀表板檔案列表 (假設此函數定義在 dashboard.js)
    if (typeof renderFileDashboard === 'function') {
        renderFileDashboard();
    }
}

/**
 * Switch back to login layout
 * 切換回登入前佈局
 */
function switchToLoginLayout() {
    // 顯示身分驗證卡片與登入前之上傳卡片
    const authCard = document.getElementById('authCard');
    if (authCard) authCard.style.display = 'block';
    
    const beforeLoginCard = document.getElementById('uploadCardBeforeLogin');
    if (beforeLoginCard) beforeLoginCard.style.display = 'block';
    
    // 隱藏狀態列
    const statusBar = document.getElementById('statusBar');
    if (statusBar) statusBar.classList.remove('visible');
    
    // 隱藏登入後的功能區
    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) loggedInGrid.classList.remove('visible');
}