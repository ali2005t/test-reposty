
// student-common.js
// Shared logic for all student pages (OneSignal, Branding, Theme)

// 1. OneSignal Initialization with Localhost Protection
window.OneSignalDeferred = window.OneSignalDeferred || [];
window.OneSignalDeferred.push(async function (OneSignal) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.warn('OneSignal disabled on localhost to prevent errors.');
        return;
    }
    // Only init if not already initialized
    if (!OneSignal.initialized) {
        await OneSignal.init({
            appId: "3dd814ae-df51-4396-8aca-0877931b7b5f", // Replace with your App ID
            safari_web_id: "web.onesignal.auto.xxxxx",
            notifyButton: { enable: true }
        });
    }
});

// 2. Apply Branding from Session Storage
// This ensures sub-pages (Profile, Courses) still look like the Teacher's App
// 2. Apply Visual Branding (Colors/Title)
function applyBranding() {
    try {
        // Color Branding
        const cachedColor = sessionStorage.getItem('platformColor');
        if (cachedColor) {
            document.documentElement.style.setProperty('--app-primary', cachedColor);
        }

        const platformName = sessionStorage.getItem('platformName');
        if (platformName) {
            // Update Title if not already set
            if (!document.title.includes(platformName)) {
                document.title = platformName + ' - ' + document.title;
            }

            // If page has a generic header title, update it
            const headerTitle = document.getElementById('header-platform-title');
            if (headerTitle) {
                headerTitle.innerText = platformName;
            }
        }

    } catch (e) {
        console.error("Branding Error", e);
    }
}

// 3. Desktop Menu Toggle Logic
function initDesktopMenu() {
    // Check if we are on desktop (simple check, or just run it and let CSS hide it)
    if (!document.getElementById('desktop-menu-btn')) {

        // Create Toggle Button
        const btn = document.createElement('button');
        btn.id = 'desktop-menu-btn';
        btn.innerHTML = '<i class="fas fa-bars"></i>';
        btn.style.display = 'none'; // CSS will show it on desktop
        // Note: Styles are in student-desktop.css

        // Create Overlay
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        // Ensure z-index is correct via JS or rely on CSS
        // The CSS handles z-index: 1900.


        document.body.appendChild(btn);
        document.body.appendChild(overlay);

        // Event Listeners
        const nav = document.querySelector('.bottom-nav');

        function toggleMenu() {
            if (!nav) return;
            nav.classList.toggle('sidebar-open');
            overlay.classList.toggle('active');

            // Icon Toggle
            const isOpen = nav.classList.contains('sidebar-open');
            btn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        }

        btn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyBranding();
    initDesktopMenu();
});
