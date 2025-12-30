import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Check Maintenance Mode
// This script should be imported in the head or top of body of all client-facing pages
// NOT on admin pages obviously.

(async function checkMaintenance() {
    // Skip if we are already on maintenance page to avoid loop, OR if we are on admin pages
    if (window.location.pathname.includes('maintenance.html') || window.location.pathname.includes('/admin/')) {
        return;
    }

    try {
        const docRef = doc(db, "config", "general_settings");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            if (data.maintenanceMode) {
                // Check if maintenance period has expired (Auto-open)
                if (data.maintenanceEndTime) {
                    const endTime = new Date(data.maintenanceEndTime).getTime();
                    const now = new Date().getTime();
                    if (now > endTime) return; // Maintenance over
                }

                // Redirect
                window.location.href = '/maintenance.html';
            }
        }
    } catch (e) {
        console.error("Maintenance check failed", e);
    }
})();
