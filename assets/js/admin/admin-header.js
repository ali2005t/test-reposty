import { db, auth } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Toggle Logic (Global)
    const btn = document.getElementById('open-sidebar');
    const sb = document.getElementById('sidebar');
    if (btn && sb) {
        btn.onclick = (e) => {
            e.stopPropagation();
            sb.classList.toggle('active');
        };
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 768 && sb.classList.contains('active') && !sb.contains(e.target) && e.target !== btn) {
                sb.classList.remove('active');
            }
        });
    }

    // 2. Initialize Notification Listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            initAdminNotifications(user.uid);
        }
    });
});

let unsubNotif = null;

function initAdminNotifications(uid) {
    if (unsubNotif) unsubNotif();

    // Listen for notifications where target is 'admin' OR 'my_uid'
    const q = query(
        collection(db, "notifications"),
        where("target", "in", ["admin", uid]),
        orderBy("createdAt", "desc"),
        limit(20)
    );

    // Audio Context for Sound
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

    // Enable audio on first interaction
    document.addEventListener('click', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }, { once: true });


    unsubNotif = onSnapshot(q, (snapshot) => {
        let unreadCount = 0;

        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const data = change.doc.data();
                // Check if genuine new (compare timestamp with load time? Simplification: just count unread bool if we had it, but we don't have read status synced perfectly for badges yet without a 'read' field query).
                // Actually, the docs usually have `read: false`.
                if (data.read === false) {
                    // Sound Alert for recent notifications (< 10 seconds ago)
                    // to prevent spamming on page load
                    const notifTime = data.createdAt ? data.createdAt.toDate() : new Date();
                    const now = new Date();
                    if ((now - notifTime) < 10000) {
                        playNotificationSound();
                    }
                    unreadCount++;
                    // Play sound if very recent? (Skip complex logic for now, just badge)
                }
            }
        });

        // Better Logic: Count all unread in the snapshot
        const totalUnread = snapshot.docs.filter(d => d.data().read === false).length;
        updateNotificationBadge(totalUnread);

    }, (error) => {
        console.warn("Admin Notif Listener Error:", error);
    });
}

function updateNotificationBadge(count) {
    // 1. Sidebar Item
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        if (item.innerHTML.includes('fa-bell')) {
            updateBadgeElement(item, count, 'sidebar');
        }
    });

    // 2. Header Icon
    const headerBells = document.querySelectorAll('.admin-header-bell');
    headerBells.forEach(btn => {
        updateBadgeElement(btn, count, 'header');
    });
}

function updateBadgeElement(container, count, type) {
    let badge = container.querySelector('.badge-count');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge-count';

        if (type === 'sidebar') {
            badge.style.cssText = `
                background: #ef4444; 
                color: white; 
                font-size: 0.7rem; 
                padding: 2px 6px; 
                border-radius: 10px; 
                margin-right: auto; 
                margin-left: 10px;
                display: none;
            `;
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.justifyContent = 'space-between';
        } else {
            // Header
            badge.style.cssText = `
                position: absolute; 
                top: -5px; 
                right: -5px; 
                background: #ef4444; 
                color: white; 
                font-size: 0.6rem; 
                padding: 2px 5px; 
                border-radius: 10px; 
                display: none;
            `;
            container.style.position = 'relative'; // Ensure relative parent
        }
        container.appendChild(badge);
    }

    if (count > 0) {
        badge.innerText = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}
