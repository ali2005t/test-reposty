import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('notifications-list');
    const teacherId = new URLSearchParams(window.location.search).get('t') || sessionStorage.getItem('currentTeacherId');
    let teacherLogo = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadTeacherInfo();
            loadNotifications(user.uid);
        } else {
            window.location.href = 'login.html';
        }
    });

    async function loadTeacherInfo() {
        if (!teacherId) return;
        try {
            const snap = await getDoc(doc(db, "teachers", teacherId));
            if (snap.exists()) {
                const data = snap.data();
                teacherLogo = data.platformLogo || data.logo || data.profileImage;
            }
        } catch (e) { console.error("Teacher Info Error", e); }
    }

    async function loadNotifications(uid) {
        container.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-spin"></i></div>';

        try {
            const notifs = [];

            // 1. Broadcasts
            let qConstraints = [where("target", "==", "all_students"), orderBy("createdAt", "desc"), limit(20)];
            if (teacherId) qConstraints.push(where("teacherId", "==", teacherId));

            // Firestore requires composite index for this. If missing, it fails.
            // Safe fallback: Order by client side if index missing error?
            // Let's try to query.

            const q1 = query(collection(db, "notifications"), ...qConstraints);

            try {
                const snap1 = await getDocs(q1);
                snap1.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }));
            } catch (err) {
                if (err.code === 'failed-precondition') {
                    console.warn("Index missing, falling back to client sort");
                    // Remove orderBy
                    let qConstraints2 = [where("target", "==", "all_students")];
                    if (teacherId) qConstraints2.push(where("teacherId", "==", teacherId));
                    const q2 = query(collection(db, "notifications"), ...qConstraints2);
                    const snap2 = await getDocs(q2);
                    snap2.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }));
                } else { throw err; }
            }

            // 2. Direct Messages (Optional, if needed later)
            // ...

            // Sort Descending
            notifs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            renderList(notifs);

        } catch (e) {
            console.error(e);
            container.innerHTML = '<p class="text-center error">فشل تحميل الإشعارات</p>';
        }
    }

    function renderList(items) {
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:3rem; color:#aaa;">
                    <i class="far fa-bell" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <p>لا توجد إشعارات جديدة</p>
                </div>
            `;
            return;
        }

        items.forEach(item => {
            const date = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '';

            const iconHtml = teacherLogo
                ? `<img src="${teacherLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
                : `<i class="fas fa-bullhorn"></i>`;

            const el = document.createElement('div');
            el.className = 'notification-card';
            el.innerHTML = `
                <div class="notif-icon" style="${teacherLogo ? 'background:transparent; padding:0;' : ''}">
                    ${iconHtml}
                </div>
                <div class="notif-content">
                    <div class="notif-header">
                        <span class="notif-title">${item.title}</span>
                        <span class="notif-date">${date}</span>
                    </div>
                    <p class="notif-body">${item.body}</p>
                </div>
            `;
            // Add click to view resource?
            if (item.resourceId) {
                el.style.cursor = 'pointer';
                el.onclick = () => {
                    // Redirect Logic based on resourceType?
                    // For now just notification reading.
                };
            }
            container.appendChild(el);
        });
    }

});
