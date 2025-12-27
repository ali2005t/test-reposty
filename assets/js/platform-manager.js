/**
 * Platform Manager
 * Detects if the user is in "App Mode" (TWA/PWA/WebView) or "Web Mode" (Browser).
 * Applies distinct styling variables accordingly.
 */

export function detectPlatform() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAppMode = urlParams.get('mode') === 'app' ||
        window.matchMedia('(display-mode: standalone)').matches || // PWA
        window.navigator.userAgent.includes('wv'); // WebView (Android)

    // Store matching result in session to persist across navigation if needed
    if (isAppMode) {
        sessionStorage.setItem('platform_mode', 'app');
    } else if (sessionStorage.getItem('platform_mode') === 'app') {
        // Keep it if already set
    } else {
        sessionStorage.setItem('platform_mode', 'web');
    }

    applyPlatformStyles(isAppMode);
}

function applyPlatformStyles(isApp) {
    const root = document.documentElement;

    if (isApp) {
        // APP MODE: Use Teacher's Brand Colors (which are likely already set by theme-loader, 
        // but we ensure status bars etc are handled if possible)
        console.log("Running in App Mode");
        document.body.classList.add('platform-app');
        document.body.classList.remove('platform-web');

        // In App Mode, we might want to hide the footer or specific detailed headers
        // that are redundant with the app shell.
    } else {
        // WEB MODE: Use Platform Standard Colors (Blue/Dark)
        // We override the variables set by theme-loader if we want "Platform Look" 
        // regardless of teacher brand.
        // User requested: "When student uses site color it has a color, and app has a color."
        // "Meaning I know I will use the same link but want it to change automatically."

        console.log("Running in Web Mode");
        document.body.classList.add('platform-web');
        document.body.classList.remove('platform-app');

        // FORCE Platform standard colors for Web Mode
        // Define these standard colors
        const platformPrimary = '#4f46e5'; // Indigo-600 (Example Platform Color)
        const platformDark = '#0f172a';

        // Override CSS variables
        // We use !important priority by setting them on the style tag directly again 
        // but typically theme-loader runs fast. We should coordinate.

        // Option A: Just set them.
        root.style.setProperty('--primary-color', platformPrimary);
        root.style.setProperty('--app-primary', platformPrimary);
        root.style.setProperty('--app-primary-hover', '#4338ca');
    }
}
