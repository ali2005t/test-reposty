import { db } from './firebase-config.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function initBannerSystem(targetAudience, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const bannersColl = collection(db, "banners");
        // احنا عايزين البانرات اللي موجهة للكل أو نفس الفئة المستهدفة
        // عشان الفلترة بنستخدم OR وده صعب في فايربيز مباشرة
        // فهنجيب كل البانرات ونفلترها هنا في الكود (بما ان عددهم قليل)

        // الأفضل نجيب بالأحدث
        const q = query(bannersColl, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        let hasBanners = false;
        container.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();

            // فلترة اللي مش شغال
            if (data.isActive === false) return;

            // فلترة حسب الفئة (معلم/طالب)
            if (data.target !== 'all' && data.target !== targetAudience) return;

            hasBanners = true;
            renderBanner(data, container);
        });

        if (hasBanners) {
            container.style.display = 'block'; // نظهر الكونتينر لو فيه بانرات
        }

    } catch (e) {
        console.error("Banner Error:", e);
    }
}

function renderBanner(data, container) {
    const banner = document.createElement('div');
    banner.className = `app-banner banner-style-${data.style || 'blue'}`;

    // خريطة الألوان (لازم تكون نفس اللي في الأدمن)
    const styles = {
        'blue': 'background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%); color: white;',
        'red': 'background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%); color: white;',
        'green': 'background: linear-gradient(90deg, #10b981 0%, #059669 100%); color: white;',
        'yellow': 'background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%); color: black;',
        'purple': 'background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%); color: white;',
    };

    const styleCss = styles[data.style] || styles['blue'];

    banner.style.cssText = `
        ${styleCss}
        padding: 15px;
        border-radius: 12px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        animation: fadeIn 0.5s ease-out;
        flex-wrap: wrap;
        gap: 10px;
    `;

    banner.innerHTML = `
        <div style="flex:1;">
            <h4 style="margin:0 0 5px 0; font-size:1.1rem; font-weight:bold;">${data.title}</h4>
            <div style="font-size:0.9rem; opacity:0.95; line-height:1.4;">${data.body}</div>
        </div>
        ${data.btnText ? `
            <a href="${data.link || '#'}" target="_blank" 
               style="background:rgba(255,255,255,0.2); color:inherit; text-decoration:none; padding:8px 16px; border-radius:6px; font-weight:bold; white-space:nowrap; transition:background 0.2s;">
               ${data.btnText}
            </a>
        ` : ''}
    `;

    // Button Hover Effect
    const btn = banner.querySelector('a');
    if (btn) {
        btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.3)';
        btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.2)';
    }

    container.appendChild(banner);
}
