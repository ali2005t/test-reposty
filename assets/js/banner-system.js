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
    const type = data.type || 'simple';

    const bannerWrapper = document.createElement('div');
    bannerWrapper.className = `app-banner-wrapper`;
    bannerWrapper.style.marginBottom = '20px';

    if (type === 'image') {
        bannerWrapper.innerHTML = `
            <a href="${data.link || '#'}" target="${data.link ? '_blank' : '_self'}" style="display:block;">
                <img src="${data.url}" style="width:100%; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.1); display:block;">
            </a>
        `;

    } else if (type === 'html') {
        bannerWrapper.innerHTML = `<div style="border-radius:12px; overflow:hidden;">${data.html}</div>`;

    } else if (type === 'video') {
        // --- Protected YouTube Player ---
        // Constraint: Unlisted, No Controls, Mute Toggle Only
        // We use Iframe API or simple embed with parameters

        let videoId = '';
        try {
            const urlObj = new URL(data.url);
            if (urlObj.hostname.includes('youtube.com')) videoId = urlObj.searchParams.get('v');
            else if (urlObj.hostname.includes('youtu.be')) videoId = urlObj.pathname.substring(1);
        } catch (e) { console.error("Invalid Video URL"); }

        if (videoId) {
            const embedId = `yt-player-${Math.random().toString(36).substr(2, 9)}`;

            // 1. Container relative
            const vidContainer = document.createElement('div');
            vidContainer.style.cssText = "position:relative; width:100%; aspect-ratio:16/9; border-radius:12px; overflow:hidden; background:black;";

            // 2. Iframe (Behind everything)
            // controls=0, disablekb=1, fs=0, modestbranding=1, rel=0, autoplay=1, mute=1, loop=1
            const iframeSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&loop=1&playlist=${videoId}&playsinline=1`;

            vidContainer.innerHTML = `
                <iframe id="${embedId}" src="${iframeSrc}" 
                    style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                </iframe>
                
                <!-- Transparent Overlay (Blocks all interaction) -->
                <div style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; cursor:default;"></div>

                <!-- Mute Control Button (On top of overlay) -->
                <button id="btn-${embedId}" onclick="toggleMute('${embedId}')" 
                    style="position:absolute; bottom:15px; left:15px; z-index:20; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">
                    <i class="fas fa-volume-mute"></i>
                </button>
            `;

            bannerWrapper.appendChild(vidContainer);

            // Allow global function to find iframe and postMessage
            if (!window.toggleMute) {
                window.toggleMute = (id) => {
                    const iframe = document.getElementById(id);
                    const btn = document.getElementById('btn-' + id);
                    if (!iframe || !btn) return;

                    // We can't access iframe state directly due to cross-origin same-origin policy if simple iframe.
                    // But we can blindly toggle by tracking local state if we started muted.
                    // Or standard postMessage command.

                    const isMuted = btn.innerHTML.includes('mute');

                    // Note: This needs 'enablejsapi=1' in URL if we want postMessage, let's fix URL above if needed? 
                    // Actually, re-rendering src specifically is cleaner without API loading complexity for just mute.
                    // BUT flashing is bad.
                    // Let's rely on standard 'postMessage' for YouTube Iframe API.

                    // Fix src above to include enablejsapi=1
                    if (!iframe.src.includes('enablejsapi')) {
                        iframe.src += "&enablejsapi=1"; // This reloads, bad for runtime toggle.
                        // We will add enablejsapi=1 in the initial render string below.
                    }

                    if (isMuted) {
                        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
                        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
                    } else {
                        iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
                        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
                    }
                };
            }

            // Add enablejsapi manually to string construction above in next edit or just rely on correct string.
            // I'll update the string in the block above.
            const apiSrc = iframeSrc + "&enablejsapi=1";
            vidContainer.querySelector('iframe').src = apiSrc;

        }

    } else {
        // --- Default Simple ---
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
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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

        bannerWrapper.appendChild(banner);
    }

    container.appendChild(bannerWrapper);
}
