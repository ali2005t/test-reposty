import { auth, db } from '../firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const SIDEBAR_HTML = `
<div class="sidebar-header" style="display:flex; justify-content:center; padding: 20px 0;">
    <img src="../assets/images/icon title  and logo .png" alt="Ta3leemy" style="max-height: 50px; max-width: 90%; object-fit:contain;">
</div>
<div class="sidebar-menu">
    <div class="menu-item" data-page="dashboard.html" onclick="window.location.href='dashboard.html'"><i class="fas fa-home"></i> الرئيسية</div>
    <div class="menu-item" data-page="teachers.html" onclick="window.location.href='teachers.html'"><i class="fas fa-chalkboard-teacher"></i> المعلمون</div>
    <div class="menu-item" data-page="students.html" onclick="window.location.href='students.html'"><i class="fas fa-user-graduate"></i> الطلاب</div>
    <div class="menu-item" data-page="courses.html" onclick="window.location.href='courses.html'"><i class="fas fa-book"></i> الكورسات</div>
    <div class="menu-item" data-page="packages.html" onclick="window.location.href='packages.html'"><i class="fas fa-box-open"></i> الباقات</div>
    <div class="menu-item" data-page="subscriptions.html" onclick="window.location.href='subscriptions.html'"><i class="fas fa-file-invoice-dollar"></i> الاشتراكات</div>
    <div class="menu-item" data-page="financials.html" onclick="window.location.href='financials.html'"><i class="fas fa-dollar-sign"></i> المالية</div>
    <div class="menu-item" data-page="app-requests.html" onclick="window.location.href='app-requests.html'"><i class="fas fa-mobile-screen"></i> تجهيز التطبيقات</div>
    <div class="menu-item" data-page="notifications.html" onclick="window.location.href='notifications.html'">
        <i class="fas fa-bell"></i> الإشعارات
        <span class="sidebar-badge badge-count" style="background:#ef4444; color:white; font-size:0.7rem; padding:2px 6px; border-radius:10px; margin-right:auto; display:none;">0</span>
    </div>
    <div class="menu-item" data-page="banners.html" onclick="window.location.href='banners.html'"><i class="fas fa-images"></i> البانرات</div>
    <div class="menu-item" data-page="security.html" onclick="window.location.href='security.html'"><i class="fas fa-shield-alt"></i> الأمان</div>
    <div class="menu-item" data-page="support.html" onclick="window.location.href='support.html'"><i class="fas fa-headset"></i> الدعم الفني</div>
    <div class="menu-item" data-page="settings.html" onclick="window.location.href='settings.html'"><i class="fas fa-cogs"></i> الإعدادات</div>
</div>
<div class="sidebar-footer">
    <div class="menu-item" id="global-logout-btn" style="color:#ef4444;"><i class="fas fa-sign-out-alt"></i> خروج</div>
</div>
`;

const HEADER_HTML = (title) => `
<div style="display:flex; align-items:center; gap:1rem;">
    <button class="btn-icon mobile-only" id="ui-open-sidebar"><i class="fas fa-bars"></i></button>
    <h3>${title}</h3>
</div>
<div class="top-actions" style="display:flex; align-items:center;">
    <div class="admin-header-bell" onclick="window.location.href='notifications.html'" style="cursor:pointer; margin-left:15px; color:white; font-size:1.2rem; position:relative;">
        <i class="fas fa-bell"></i>
        <span class="header-badge badge-count" style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; font-size:0.6rem; padding:2px 5px; border-radius:10px; display:none;">0</span>
    </div>
    <div class="profile-widget">
        <span class="avatar" style="background:#6366f1; width:35px; height:35px; display:flex; align-items:center; justify-content:center; border-radius:50%;">A</span>
    </div>
</div>
`;

export function initAdminUI(pageTitle) {
    // 1. Inject Sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.innerHTML = SIDEBAR_HTML;
        // Set Active Class
        const currentDataPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        const activeItem = sidebar.querySelector(`.menu-item[data-page="${currentDataPage}"]`);
        if (activeItem) activeItem.classList.add('active');

        // Logout Logic
        document.getElementById('global-logout-btn').onclick = () => {
            signOut(auth).then(() => window.location.href = '../auth/login.html');
        };
    }

    // 2. Inject Header
    const header = document.querySelector('header.top-bar');
    if (header) {
        header.innerHTML = HEADER_HTML(pageTitle || document.title.split('-')[0].trim());

        // Mobile Toggle
        const toggle = document.getElementById('ui-open-sidebar');
        if (toggle && sidebar) {
            toggle.onclick = (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('active');
            };
            document.addEventListener('click', (e) => {
                if (window.innerWidth < 768 && sidebar.classList.contains('active') && !sidebar.contains(e.target) && e.target !== toggle) {
                    sidebar.classList.remove('active');
                }
            });
        }
    }

    // 3. Init Notifications (Sound Debounced)
    initNotifications();
}

// Global Sound Context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound() {
    // Debounce: Check localstorage for last sound time (across tabs)
    const now = Date.now();
    const lastSound = localStorage.getItem('last_notif_sound');
    if (lastSound && (now - Number(lastSound) < 2000)) {
        return; // Skip if played < 2s ago
    }

    // Play
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);

    localStorage.setItem('last_notif_sound', now);
}

document.addEventListener('click', () => { if (audioCtx.state === 'suspended') audioCtx.resume(); }, { once: true });

let unsubNotif = null;
function initNotifications() {
    if (unsubNotif) return; // run once

    const user = auth.currentUser;
    if (!user) return;

    const q = query(
        collection(db, "notifications"),
        where("target", "in", ["admin", user.uid]),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    unsubNotif = onSnapshot(q, (snap) => {
        let unread = 0;
        let newArrival = false;

        snap.docChanges().forEach(c => {
            if (c.type === "added") {
                const data = c.doc.data();
                const notifTime = data.createdAt ? data.createdAt.toDate() : new Date();
                // Check latency < 10s for sound
                if (Date.now() - notifTime.getTime() < 10000 && data.read === false) {
                    newArrival = true;
                }
            }
        });

        if (newArrival) playSound();

        // Count Unread
        unread = snap.docs.filter(d => d.data().read === false).length;
        updateBadges(unread);
    }, err => console.log(err));
}

function updateBadges(count) {
    const badges = document.querySelectorAll('.badge-count');
    badges.forEach(b => {
        if (count > 0) {
            b.innerText = count;
            b.style.display = 'inline-block'; // or block for sidebar? CSS handles it? 
            // Inline override needed because I set display:none in HTML string
            b.style.display = b.classList.contains('sidebar-badge') ? 'inline-block' : 'inline-block';
        } else {
            b.style.display = 'none';
        }
    });
}
