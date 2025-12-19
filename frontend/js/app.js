/**
 * Main Application Initialization
 * Initializes the application and sets up event listeners
 */

/**
 * Initialize the application
 */
function initApp() {
    // Initialize restore modal
    initRestoreModal();
    
    // Any other initialization code can go here
    console.log('Dropbex application initialized');
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

