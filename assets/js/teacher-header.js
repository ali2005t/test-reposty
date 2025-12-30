import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function loadHeaderProfile(uid) {
    try {
        const d = await getDoc(doc(db, "teachers", uid));
        if (d.exists()) {
            const data = d.data();
            const name = data.platformName || data.name || "المعلم";

            const nameEl = document.getElementById('header-user-name');
            if (nameEl) nameEl.innerText = name;

            const linkEl = document.getElementById('site-link');
            if (linkEl && data.platformDomain) {
                if (data.platformDomain.includes('http')) linkEl.href = data.platformDomain;
                else linkEl.href = `https://${data.platformDomain}.ta3leemy.com`;
            }
        }
    } catch (e) { console.error("Profile load error", e); }
}
