/**
 * Authentication Module
 * Handles login, registration, logout, and layout switching
 */

/**
 * Switch between login and register tabs
 * @param {string} tab - 'login' or 'register'
 */
function switchTab(tab) {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
        tabs[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

/**
 * Handle login form submission
 * @param {Event} e - Form submit event
 */
function handleLoginSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginSubmitBtn');

    // Basic validation
    if (!email || !password) {
        showToast('❌', 'Please fill in all fields');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    // Simulate API call to AWS Cognito
    setTimeout(() => {
        AppState.setLoggedIn(true);
        AppState.setCurrentUser(email);

        // Switch to logged in layout
        switchToLoggedInLayout(email);

        showToast('✅', 'Successfully logged in!');
        
        btn.disabled = false;
        btn.textContent = 'Login';
    }, 1200);
}

/**
 * Handle register form submission
 * @param {Event} e - Form submit event
 */
function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const btn = document.getElementById('registerSubmitBtn');

    // Validation
    if (!email || !password || !confirmPassword) {
        showToast('❌', 'Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        document.getElementById('registerConfirmPasswordError').classList.add('visible');
        showToast('❌', 'Passwords do not match');
        return;
    }

    if (password.length < 8) {
        document.getElementById('registerPasswordError').classList.add('visible');
        showToast('❌', 'Password must be at least 8 characters');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    // Simulate API call to AWS Cognito
    setTimeout(() => {
        AppState.setLoggedIn(true);
        AppState.setCurrentUser(email);

        // Switch to logged in layout
        switchToLoggedInLayout(email);

        showToast('✅', 'Account created successfully!');
        
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }, 1500);
}

/**
 * Handle logout
 */
function handleLogout() {
    AppState.setLoggedIn(false);
    AppState.setCurrentUser(null);

    // Switch back to login layout
    switchToLoginLayout();

    // Clear forms
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();

    showToast('✅', 'Logged out successfully');
}

/**
 * Switch to logged in layout
 * @param {string} email - User email
 */
function switchToLoggedInLayout(email) {
    // Hide auth card and before-login upload card
    document.getElementById('authCard').classList.add('hidden');
    document.getElementById('uploadCardBeforeLogin').style.display = 'none';
    
    // Show status bar
    document.getElementById('statusBar').classList.add('visible');
    document.getElementById('statusBarEmail').textContent = email;
    
    // Show logged in grid (upload + dashboard)
    document.getElementById('loggedInGrid').classList.add('visible');
    
    // Render dashboard
    renderFileDashboard();
}

/**
 * Switch back to login layout
 */
function switchToLoginLayout() {
    // Show auth card and before-login upload card
    document.getElementById('authCard').classList.remove('hidden');
    document.getElementById('uploadCardBeforeLogin').style.display = 'block';
    
    // Hide status bar
    document.getElementById('statusBar').classList.remove('visible');
    
    // Hide logged in grid
    document.getElementById('loggedInGrid').classList.remove('visible');
}

