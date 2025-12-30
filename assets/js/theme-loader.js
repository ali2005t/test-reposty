import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Loads teacher app settings (branding) and applies them to the document.
 * @param {string|null} forcedTeacherId - Optional teacher ID to override session/url.
 */
export async function applyTheme(forcedTeacherId = null) {
    let teacherId = forcedTeacherId;

    if (!teacherId) {
        const params = new URLSearchParams(window.location.search);
        teacherId = params.get('t') || sessionStorage.getItem('currentTeacherId');
    }

    if (!teacherId) return;

    try {
        // Try to get from sessionStorage cache first to avoid flicker? 
        // No, Firestore cache is fast enough usually.

        const docRef = doc(db, "teachers", teacherId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();

            // 1. Determine Brand Color
            // Priority:
            //   - URL/PWA App Mode -> appSettings.brandColor
            //   - Web Mode -> platformColor
            //   - Default

            // Detect Platform Mode from URL or Display Mode
            const urlParams = new URLSearchParams(window.location.search);
            const isAppMode = urlParams.get('mode') === 'app' ||
                window.matchMedia('(display-mode: standalone)').matches || // PWA
                window.navigator.userAgent.includes('wv'); // WebView

            let brandColor = null;

            if (isAppMode) {
                console.log("Platform Detection: APP MODE");
                // Use App Settings Color, fallback to Platform Color
                brandColor = (data.appSettings && data.appSettings.brandColor) ? data.appSettings.brandColor : data.platformColor;
                document.body.classList.add('platform-app');
                document.body.classList.remove('platform-web');
            } else {
                console.log("Platform Detection: WEB MODE");
                // Use Platform Color, fallback to App Settings
                brandColor = data.platformColor || (data.appSettings ? data.appSettings.brandColor : null);
                document.body.classList.add('platform-web');
                document.body.classList.remove('platform-app');
            }

            if (brandColor) {
                // Apply variables to :root (html)
                document.documentElement.style.setProperty('--primary-color', brandColor);
                document.documentElement.style.setProperty('--primary', brandColor); // Some CSS uses --primary
                document.documentElement.style.setProperty('--app-primary', brandColor);
                document.documentElement.style.setProperty('--app-primary-hover', brandColor);

                // Extra overrides for common UI frameworks or specific elements
                // Handle "btn-primary" if they exist and aren't using vars
                const btns = document.querySelectorAll('.btn-primary, .animated-join-btn');
                btns.forEach(b => b.style.backgroundColor = brandColor);
            }

            // 2. Determine App Title & Logo
            const title = data.platformName || data.name;
            if (title) {
                const appTitles = document.querySelectorAll('.app-title, h1.title, .auth-header h2');
                appTitles.forEach(t => t.innerText = t.classList.contains('auth-header') ? `مرحباً بك في ${title}` : title);
                document.title = title;
            }

            // 3. Logo Image
            // If there's a specific container for logo (like in home.html)
            const logoDiv = document.querySelector('.training-logo-large, #center-card > div');
            if (logoDiv && (data.logo || data.profileImage || data.image)) {
                const src = data.logo || data.profileImage || data.image;
                // If it's a div expecting background image or img tag
                if (logoDiv.tagName === 'IMG') logoDiv.src = src;
                else {
                    logoDiv.innerHTML = `<img src="${src}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
                    logoDiv.style.background = 'transparent';
                }
            }

        }
    } catch (e) {
        console.error("Theme Load Error:", e);
    }
}
