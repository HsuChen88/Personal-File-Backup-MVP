/**
 * Authentication Module
 * Handles login, registration, logout, and layout switching
 * 身分驗證模組：處理登入、註冊、登出及介面切換
 */

/**
 * [新增] 檢查當前 Session (網頁載入時執行)
 * 這會讓 F5 重新整理後，依然保持登入狀態
 */
function checkCurrentSession() {
    console.log("🔍 Checking session...");
    const idToken = localStorage.getItem('idToken');
    
    if (idToken) {
        try {
            // 解析 JWT 取得使用者 Email (Payload 是 Base64 編碼的 JSON)
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            const email = payload.email;

            // 恢復全域狀態
            if (typeof AppState !== 'undefined') {
                // 呼叫 state.js 的方法設定狀態
                if (typeof AppState.setLoggedIn === 'function') {
                    AppState.setLoggedIn(true, email);
                } else {
                    // 相容舊版寫法
                    AppState.isLoggedIn = true;
                    AppState.currentUserEmail = email;
                }
                console.log("✅ Session restored for:", email);
            }

            // 更新 UI 顯示為已登入狀態
            switchToLoggedInLayout(email);
        } catch (e) {
            console.error("Session restore failed (Token invalid):", e);
            handleLogout(); // Token 有問題，強制登出
        }
    } else {
        console.log("ℹ️ No active session found.");
    }
}

/**
 * Handle Login Form Submission
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
            const idToken = result.getIdToken().getJwtToken();
            localStorage.setItem('idToken', idToken);
            
            // 登入成功，立即更新全域狀態
            if (typeof AppState !== 'undefined') {
                if (typeof AppState.setLoggedIn === 'function') {
                    AppState.setLoggedIn(true, email);
                } else {
                    AppState.isLoggedIn = true;
                    AppState.currentUserEmail = email;
                }
            }

            showToast('✅', 'Successfully logged in!');
            switchToLoggedInLayout(email);
            btn.disabled = false;
            btn.textContent = 'Login';
        },
        onFailure: function (err) {
            console.error("Login failed:", err);
            showToast('❌', err.message || 'Login failed');
            btn.disabled = false;
            btn.textContent = 'Login';
        }
    });
}

/**
 * Handle Register Form Submission
 */
function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value.trim(); 
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const btn = document.getElementById('registerSubmitBtn');

    if (password !== confirmPassword) {
        showToast('❌', 'Passwords do not match');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Processing...';

    const poolData = {
        UserPoolId: AWS_CONFIG.userPoolId,
        ClientId: AWS_CONFIG.appClientId
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const attributeList = [new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email })];

    userPool.signUp(email, password, attributeList, null, function(err, result) {
        if (err) {
            if (err.code === 'UsernameExistsException') {
                showToast('ℹ️', 'Account exists. Redirecting to verification...');
                showConfirmSection(email);
            } else {
                showToast('❌', err.message || 'Registration failed'); 
            }
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }
        
        showToast('📧', 'Code sent to your email!');
        showConfirmSection(email);

        btn.disabled = false;
        btn.textContent = 'Create Account';
    });
}

/**
 * Handle Account Verification
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
        document.getElementById('confirmSection').style.display = 'none';
        switchTab('login');
        
        btn.disabled = false;
        btn.textContent = 'Confirm Account';
    });
}

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

function handleBackToRegistration() {
    document.getElementById('confirmSection').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    switchTab('register');
}

/**
 * Handle Logout
 */
function handleLogout() {
    // 1. 清除 LocalStorage
    localStorage.removeItem('idToken'); 

    // 2. 清除 Cognito SDK 狀態
    const poolData = { UserPoolId: AWS_CONFIG.userPoolId, ClientId: AWS_CONFIG.appClientId };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const cognitoUser = userPool.getCurrentUser();

    if (cognitoUser) {
        cognitoUser.signOut();
    }

    // 3. 重置 AppState
    if (typeof AppState !== 'undefined') {
        if (typeof AppState.setLoggedIn === 'function') {
            AppState.setLoggedIn(false, null);
        } else {
            AppState.isLoggedIn = false;
            AppState.currentUserEmail = null;
        }
        console.log("✅ AppState Reset: User Logged Out");
    }

    // 4. 重置 UI
    switchToLoginLayout();
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();

    showToast('✅', 'Logged out successfully');
}

/**
 * UI Switching Logic
 */

function switchTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const confirmSection = document.getElementById('confirmSection');

    // 如果正在顯示驗證區塊，鎖定分頁標籤
    if (confirmSection && confirmSection.style.display === 'block') {
        tabs.forEach(t => t.classList.remove('active'));
        if (tab === 'login') tabs[0].classList.add('active');
        else tabs[1].classList.add('active');
        return; 
    }

    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (confirmSection) confirmSection.style.display = 'none';

    if (tab === 'login') {
        if(tabs[0]) tabs[0].classList.add('active');
        if (loginForm) {
            loginForm.classList.add('active');
            loginForm.style.display = 'block';
        }
    } else {
        if(tabs[1]) tabs[1].classList.add('active');
        if (registerForm) {
            registerForm.classList.add('active');
            registerForm.style.display = 'block';
        }
    }
}

function switchToLoggedInLayout(email) {
    const authCard = document.getElementById('authCard');
    if (authCard) authCard.style.display = 'none';
    
    const beforeLoginCard = document.getElementById('uploadCardBeforeLogin');
    if (beforeLoginCard) beforeLoginCard.style.display = 'none';
    
    const statusBar = document.getElementById('statusBar');
    if (statusBar) {
        statusBar.classList.add('visible');
    }
    const emailSpan = document.getElementById('statusBarEmail');
    if (emailSpan) emailSpan.textContent = email;
    
    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) loggedInGrid.classList.add('visible');
    
    // 雙重保險：切換介面時再次確認狀態正確
    if (typeof AppState !== 'undefined') {
        if (typeof AppState.setLoggedIn === 'function') {
            if (!AppState.isLoggedIn) AppState.setLoggedIn(true, email);
        } else {
            AppState.isLoggedIn = true;
            AppState.currentUserEmail = email;
        }
    }

    if (typeof renderFileDashboard === 'function') {
        renderFileDashboard();
    }
}

function switchToLoginLayout() {
    const authCard = document.getElementById('authCard');
    if (authCard) authCard.style.display = 'block';
    
    const beforeLoginCard = document.getElementById('uploadCardBeforeLogin');
    if (beforeLoginCard) beforeLoginCard.style.display = 'block';
    
    const statusBar = document.getElementById('statusBar');
    if (statusBar) statusBar.classList.remove('visible');
    
    const loggedInGrid = document.getElementById('loggedInGrid');
    if (loggedInGrid) loggedInGrid.classList.remove('visible');
}

function showConfirmSection(email) {
    const forms = document.querySelectorAll('.auth-form');
    forms.forEach(f => f.style.display = 'none');
    
    const confirmSection = document.getElementById('confirmSection');
    if (confirmSection) {
        confirmSection.style.display = 'block';
        confirmSection.classList.add('active');
    }
    const emailInput = document.getElementById('registerEmail');
    if (emailInput) emailInput.value = email;
}