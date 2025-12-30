import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Constants
const params = new URLSearchParams(window.location.search);
const teacherId = params.get('t');
// Splash might not exist in all pages, safe check later
const splash = document.getElementById('splash-screen');

async function init() {
    let tid = params.get('t');
    const hash = window.location.hash.substring(2);

    // 1. Resolve ID
    if (!tid) {
        if (localStorage.getItem('lastTeacherId')) {
            tid = localStorage.getItem('lastTeacherId');
        } else if (hash) {
            try {
                const nameQuery = decodeURIComponent(hash).replace(/-/g, ' ');
                let q = query(collection(db, "teachers"), where("platformName", "==", nameQuery));
                let snapshot = await getDocs(q);
                if (snapshot.empty) {
                    q = query(collection(db, "teachers"), where("appSettings.appName", "==", nameQuery));
                    snapshot = await getDocs(q);
                }
                if (!snapshot.empty) tid = snapshot.docs[0].id;
            } catch (e) {
                console.error("Hash lookup failed", e);
            }
        }
    }

    // 404
    if (!tid) {
        if (splash) splash.innerHTML = '<h1>404</h1><p style="color:white;">رابط غير صحيح</p>';
        return;
    }

    // Persistence
    sessionStorage.setItem('currentTeacherId', tid);
    localStorage.setItem('lastTeacherId', tid);

    // Clean URL
    if (params.get('t')) {
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
    }

    // Links
    document.querySelectorAll('a[href="login.html"]').forEach(a => a.href = `login.html?t=${tid}`);
    const regBtn = document.querySelector('a[href="register.html"]');
    if (regBtn) regBtn.href = `register.html?t=${tid}`;

    try {
        const teacherDoc = await getDoc(doc(db, "teachers", tid));
        if (teacherDoc.exists()) {
            const data = teacherDoc.data();
            const platformName = data.platformName || data.name || "منصتي";

            // Cache for sub-pages
            sessionStorage.setItem('platformName', platformName);
            if (data.platformColor) sessionStorage.setItem('platformColor', data.platformColor);

            // Update UI
            document.title = platformName;
            // Update UI - Safe Checks
            document.title = platformName;

            const splashNameEl = document.getElementById('splash-name');
            if (splashNameEl) splashNameEl.innerText = platformName;

            const platformNameEl = document.getElementById('platform-name'); // In header?
            if (platformNameEl) platformNameEl.innerText = platformName;

            const heroNameEl = document.getElementById('platform-name-hero') || document.getElementById('hero-platform-name');
            if (heroNameEl) heroNameEl.innerText = platformName;

            const footerNameEl = document.getElementById('footer-platform-name');
            if (footerNameEl) footerNameEl.innerText = platformName;

            // Set Hash
            const cleanName = platformName.replace(/\s+/g, '-');
            if (window.location.hash !== `#/${cleanName}`) {
                window.history.replaceState(null, null, `#/${cleanName}`);
            }

            // Branding
            if (data.profileImage) {
                const img = document.getElementById('platform-logo-img');
                if (img) {
                    img.src = data.profileImage;
                    img.style.display = 'block';
                    // Hide the default icon if image exists
                    const icon = document.getElementById('platform-logo-icon');
                    if (icon) icon.style.display = 'none';
                }
            }
            if (data.platformColor) {
                document.documentElement.style.setProperty('--app-primary', data.platformColor);
            }

            // Render Sections (Ordered)
            const sectionOrder = data.sectionOrder || ['gallery', 'location', 'bio', 'counter'];
            const mainContainer = document.querySelector('main');
            const idMap = { 'gallery': 'gallery', 'location': 'location', 'bio': 'about', 'counter': 'student-counter' };

            sectionOrder.forEach(secKey => {
                const elId = idMap[secKey];
                if (!elId) return;
                const el = document.getElementById(elId);
                if (!el) return;

                if (secKey === 'gallery') {
                    if (data.galleryImages?.length > 0 && data.showGallery) {
                        el.style.display = 'block';
                        renderGallery(data.galleryImages);
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
                else if (secKey === 'location') {
                    if (data.location && data.showLocation) {
                        el.style.display = 'block';
                        document.getElementById('location-content').innerHTML = `
                            <p style="font-size:1.2rem; margin-bottom:1rem;"><i class="fas fa-map-marker-alt" style="color:var(--primary);"></i> ${data.location.address || data.location}</p>
                            ${data.location.mapUrl ? `<iframe src="${data.location.mapUrl}" width="100%" height="400" style="border:0; border-radius:20px;" allowfullscreen="" loading="lazy"></iframe>` : ''}
                        `;
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
                else if (secKey === 'bio') {
                    if (data.bio) {
                        el.style.display = 'block';
                        document.getElementById('about-content').innerText = data.bio;
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
                else if (secKey === 'counter') { // New Counter Support
                    if (data.studentCounter) {
                        el.style.display = 'block';
                        document.getElementById('counter-number').innerText = data.studentCounter;
                        mainContainer.appendChild(el);
                    } else { el.style.display = 'none'; }
                }
            });

            // Fallback: If counter is not in order list but exists
            if (data.studentCounter && !sectionOrder.includes('counter')) {
                const el = document.getElementById('student-counter');
                if (el) {
                    el.style.display = 'block';
                    document.getElementById('counter-number').innerText = data.studentCounter;
                }
            }
        }
    } catch (error) {
        console.error(error);
    }

    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 600);
        }, 1000);
    }
}

function renderGallery(images) {
    const wrapper = document.getElementById('gallery-wrapper');
    wrapper.innerHTML = images.map(img => `
        <div class="swiper-slide">
            <img src="${img}" style="width:100%; height:300px; object-fit:cover; border-radius:15px; box-shadow:0 10px 20px rgba(0,0,0,0.1);">
        </div>
    `).join('');

    new Swiper('.gallery-slider', {
        slidesPerView: 1,
        spaceBetween: 30,
        centeredSlides: true,
        loop: true,
        autoplay: {
            delay: 2500,
            disableOnInteraction: false,
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        breakpoints: {
            640: {
                slidesPerView: 1,
            },
            768: {
                slidesPerView: 2,
            },
            1024: {
                slidesPerView: 3,
            },
        }
    });
}

init();
