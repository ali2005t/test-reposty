import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Checks for impersonation session and returns effective UID.
 * Auto-injects the Admin View banner if impersonating.
 * @param {Object} authUser - The actual authenticated user object
 * @returns {Promise<string>} The effective UID (authUser.uid or impersonated ID)
 */
export async function getEffectiveUserUid(authUser) {
    if (!authUser) return null;

    // 1. Check URL param first (entry point)
    const urlParams = new URLSearchParams(window.location.search);
    const viewAsId = urlParams.get('viewAs');

    if (viewAsId) {
        // Validation: Verify current USER is actually an admin
        // This prevents users from just adding ?viewAs=...
        try {
            const adminDoc = await getDoc(doc(db, "admins", authUser.uid));
            if (adminDoc.exists()) {
                console.log("Admin Impersonation Started:", viewAsId);
                sessionStorage.setItem('impersonatedTeacherId', viewAsId);
                showImpersonationBanner();
                return viewAsId;
            } else {
                console.warn("Unauthorized Impersonation Attempt");
            }
        } catch (e) {
            console.error("Impersonation Check Error", e);
        }
    }

    // 2. Check Session Storage (persistence)
    const storedImp = sessionStorage.getItem('impersonatedTeacherId');
    if (storedImp) {
        showImpersonationBanner();
        return storedImp;
    }

    // 3. Normal User
    return authUser.uid;
}

/**
 * Displays the red "Admin View" banner at the bottom of the screen.
 */
function showImpersonationBanner() {
    if (document.getElementById('impersonation-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'impersonation-banner';
    banner.style.cssText = "position:fixed; bottom:20px; right:20px; background:#ef4444; color:white; padding:10px 20px; border-radius:30px; z-index:99999; box-shadow:0 4px 15px rgba(0,0,0,0.3); font-weight:bold; display:flex; align-items:center; gap:10px; animation: slideIn 0.5s; font-family: 'Cairo', sans-serif;";

    banner.innerHTML = `
        <i class="fas fa-user-secret"></i> 
        <span>وضع المسؤول (Admin View)</span>
        <button id="exit-impersonation" style="background:rgba(255,255,255,0.2); color:white; border:none; padding:4px 12px; border-radius:15px; cursor:pointer; font-size:0.8rem; margin-right:5px;">
            إنهاء <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(banner);

    document.getElementById('exit-impersonation').addEventListener('click', () => {
        sessionStorage.removeItem('impersonatedTeacherId');
        // Remove viewAs param if present to prevent loop
        const url = new URL(window.location);
        url.searchParams.delete('viewAs');
        window.history.replaceState({}, '', url);
        window.location.reload();
    });
}
