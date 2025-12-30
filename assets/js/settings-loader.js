/* assets/js/settings-loader.js */
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Load immediately if cached
const cachedName = localStorage.getItem('platform_name');
if (cachedName) {
    applySettings({ platformName: cachedName });
}

export async function initGlobalSettings() {
    try {
        // Fetch fresh
        const docRef = doc(db, "config", "general_settings");
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const data = snapshot.data();
            applySettings(data);

            // Cache
            if (data.platformName) localStorage.setItem('platform_name', data.platformName);
        }
    } catch (e) {
        console.error("Settings Load Error", e);
    }
}

function applySettings(data) {
    if (data.platformName) {
        // 1. Update Title if it contains defaults
        if (document.title.includes('Ta3leemy') || document.title.includes('Edu Live')) {
            document.title = document.title.replace(/Ta3leemy|Edu Live/g, data.platformName);
        }

        // 2. Update Sidebar Logo
        const logo = document.querySelector('.logo');
        if (logo) logo.innerText = data.platformName;
    }
}

// Auto-init if imported as side-effect
document.addEventListener('DOMContentLoaded', initGlobalSettings);
