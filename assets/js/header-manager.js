import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initSupportWidget } from './support-widget.js';

// Sound Logic
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playNotificationSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
}

document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });


export async function initHeader(user) {
    if (!user) return;

    initSupportWidget();

    // 1. Setup Dropdown Toggles
    setupDropdowns();

    // 2. Load User Profile Data into Header
    await loadHeaderProfile(user.uid);

    // 3. Load Notifications (Real-time)
    loadNotifications(user.uid);

    // 4. Update Site Link for Student View
    updateSiteLink(user.uid);
}

function setupDropdowns() {
    const trigger = document.getElementById('profile-widget-trigger');
    const menu = document.getElementById('profile-dropdown-menu');
    const notifTrigger = document.getElementById('notif-bell-trigger');
    const notifMenu = document.getElementById('notif-dropdown');
    const logoutBtn = document.getElementById('logout-link-dropdown');
    const openSidebarBtn = document.getElementById('open-sidebar');
    const sidebar = document.getElementById('sidebar');

    function closeAll() {
        if (menu) menu.style.display = 'none';
        if (notifMenu) notifMenu.style.display = 'none';
    }

    if (trigger && menu) {
        trigger.onclick = (e) => {
            e.stopPropagation();
            const v = menu.style.display === 'block';
            closeAll();
            if (!v) menu.style.display = 'block';
        }
    }

    if (notifTrigger && notifMenu) {
        notifTrigger.onclick = (e) => {
            e.stopPropagation();
            const v = notifMenu.style.display === 'block';
            closeAll();
            if (!v) notifMenu.style.display = 'block';
        }
    }

    document.onclick = () => closeAll();

    if (logoutBtn) {
        logoutBtn.onclick = () => auth.signOut();
    }

    if (openSidebarBtn && sidebar) {
        openSidebarBtn.onclick = (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('active');
        }
    }
}

async function loadHeaderProfile(uid) {
    try {
        const docRef = doc(db, "teachers", uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            const nameEl = document.getElementById('user-name');
            const avatarChar = document.getElementById('user-avatar-char');
            const platformName = document.getElementById('platform-name');
            // Dropdown internal
            const dropName = document.getElementById('dropdown-name');
            const dropCode = document.getElementById('dropdown-code');

            if (nameEl) nameEl.innerText = data.name || "المعلم";
            if (platformName) platformName.innerText = data.platformName || "منصتي";
            if (dropName) dropName.innerText = data.name || "المعلم";
            if (dropCode) dropCode.innerText = data.code || uid.substring(0, 6);

            // Update Site Link with Slug if available
            const siteLink = document.getElementById('site-link');
            if (siteLink) {
                if (data.slug) {
                    siteLink.href = `../student-app/index.html#/${data.slug}`;
                } else {
                    siteLink.href = `../student-app/index.html?t=${uid}`;
                }
            }


            if (data.profileImage) {
                // Find all avatar containers in header
                const avatars = document.querySelectorAll('.avatar, .profile-avatar');
                avatars.forEach(av => {
                    // Check if it's the specific container with ID or class
                    if (av.id === 'user-avatar-char') {
                        av.parentElement.innerHTML = `<img src="${data.profileImage}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                    } else if (av.classList.contains('avatar')) {
                        av.innerHTML = `<img src="${data.profileImage}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                        av.style.background = 'transparent';
                        av.style.boxShadow = 'none';
                    }
                });
            } else {
                if (avatarChar) avatarChar.innerText = (data.name || 'T').charAt(0).toUpperCase();
            }
        }
    } catch (e) { console.error("Header Profile Error", e); }
}

let notifUnsub = null;
async function loadNotifications(uid) {
    const list = document.querySelector('.notif-list');
    const badge = document.querySelector('.badge-count');
    if (!list) return;

    if (notifUnsub) notifUnsub();

    try {
        const q = query(
            collection(db, "notifications"),
            where("target", "in", ["all", "all_teachers", uid]),
            orderBy("createdAt", "desc"),
            limit(15)
        );

        notifUnsub = onSnapshot(q, (snap) => {
            list.innerHTML = '';
            let count = 0;

            // Check new arrivals for sound
            snap.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    const notifTime = data.createdAt ? data.createdAt.toDate() : new Date();
                    const now = new Date();
                    // Play sound if recent (<10s)
                    if ((now - notifTime) < 10000) {
                        playNotificationSound();
                    }
                }
            });

            if (snap.empty) {
                list.innerHTML = '<div style="padding:15px; text-align:center; color:#64748b;">لا توجد إشعارات جديدة</div>';
            } else {
                snap.forEach(doc => {
                    const n = doc.data();
                    if (n.read === false) count++;

                    const time = n.createdAt ? new Date(n.createdAt.seconds * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

                    list.innerHTML += `
                    <div class="notif-item" onclick="window.location.href='notifications.html'" style="padding:15px; border-bottom:1px solid #334155; color:#cbd5e1; font-size:0.9rem; cursor:pointer;">
                        <div style="font-weight:bold; color:#f1f5f9; margin-bottom:5px;">
                            ${n.sender === 'admin' ? '<i class="fas fa-crown" style="color:#f59e0b; margin-left:5px;"></i>' : ''}
                            ${n.title || 'إشعار'}
                        </div>
                        <p style="margin:0; font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${n.body || ''}</p>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:5px;">${time}</div>
                    </div>
                `;
                });

                // Badge Logic
                if (badge) {
                    if (count > 0) {
                        badge.innerText = count;
                        badge.style.display = 'block';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        });

    } catch (e) {
        console.log("Notifs load error:", e);
    }
}

function updateSiteLink(uid) {
    const link = document.getElementById('site-link');
    if (link) {
        link.href = `../student-app/index.html?t=${uid}`;
    }
}
