
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Main function to resolve context (Teacher ID) from Hash or Storage
export async function resolveContext() {
    let tid = sessionStorage.getItem('currentTeacherId');
    const hash = window.location.hash.startsWith('#/') ? window.location.hash.substring(2) : null;

    // 1. If we have a hash but no ID (e.g. direct link or refresh), find the ID
    if (hash && (!tid || sessionStorage.getItem('platformName') !== decodeURIComponent(hash).replace(/-/g, ' '))) {
        try {
            const nameQuery = decodeURIComponent(hash).replace(/-/g, ' ');
            console.log("Resolving Context for:", nameQuery);

            let q = query(collection(db, "teachers"), where("platformName", "==", nameQuery));
            let snapshot = await getDocs(q);

            if (snapshot.empty) {
                // Fallback to appName if platformName not found
                q = query(collection(db, "teachers"), where("appSettings.appName", "==", nameQuery));
                snapshot = await getDocs(q);
            }

            if (!snapshot.empty) {
                tid = snapshot.docs[0].id;
                const data = snapshot.docs[0].data();
                sessionStorage.setItem('currentTeacherId', tid);
                sessionStorage.setItem('platformName', data.platformName || data.name);
                if (data.platformColor) sessionStorage.setItem('platformColor', data.platformColor);
            } else {
                console.warn("Context not found for hash:", hash);
            }
        } catch (e) {
            console.error("Context Resolution Error:", e);
        }
    }

    // 2. Update Link Hrefs to include the hash
    if (tid) {
        // Ensure standard ?t= param is maintained for safety, but also Hash
        // User explicitly wants Hash-based navigation. 
        // We need to ensure we don't duplicate hashes or params.

        const platformName = sessionStorage.getItem('platformName') || 'platform';
        const cleanHash = `#/${platformName.replace(/\s+/g, '-')}`;

        // Update URL if hash is missing
        if (window.location.hash !== cleanHash) {
            window.history.replaceState(null, null, cleanHash);
        }

        updateLinks(cleanHash);
    }
}

function updateLinks(hash) {
    document.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        // Ignore external links, anchors, javascript:, or if already hashed
        if (!href || href.startsWith('http') || href.startsWith('#') || href.includes('javascript:')) return;

        // If link already has a hash, leave it? Or replace it? 
        // Usually internal links don't have hashes unless intended.
        if (href.includes('#/')) return;

        // Strip existing hash/params if we are completely replacing logic? 
        // User wants `page.html#/sero`. 

        // Remove .html from view? No, keep it simple.

        // Check if query param exists, maybe clear it to be cleaner as requested?
        // But for now, just appending hash is safest.

        // Logic: href="my-courses.html" -> "my-courses.html#/sero"
        const cleanHref = href.split('#')[0].split('?')[0]; // Strip existing
        a.href = `${cleanHref}${hash}`;
    });
}

// Auto-run logic if imported
resolveContext();
