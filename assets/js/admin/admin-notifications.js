import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, addDoc, query, orderBy, getDocs, serverTimestamp, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('send-notif-form');
    const historyBody = document.getElementById('notif-history-body');
    const loading = document.getElementById('loading-indicator');
    const sendBtn = document.getElementById('send-btn');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Check Admin Role (Simplified: Assume Admin Page Access Control)
            loadHistory();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const target = document.getElementById('target-audience').value;
        const title = document.getElementById('notif-title').value;
        const body = document.getElementById('notif-body').value;

        if (!title || !body) return;

        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
        sendBtn.disabled = true;

        try {
            await addDoc(collection(db, "notifications"), {
                target: target,
                title: title,
                body: body,
                createdAt: serverTimestamp(),
                sender: "admin"
            });

            alert("تم إرسال الإشعار بنجاح");
            form.reset();
            loadHistory(); // Refresh table

        } catch (e) {
            console.error("Error sending notification", e);
            alert("حدث خطأ أثناء الإرسال");
        } finally {
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الآن';
            sendBtn.disabled = false;
        }
    });

    async function loadHistory() {
        try {
            const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);

            historyBody.innerHTML = '';
            loading.style.display = 'none';

            if (snapshot.empty) {
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">لا توجد إشعارات مرسلة</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const data = doc.data();
                const tr = document.createElement('tr');

                let targetText = data.target;
                if (targetText === 'all') targetText = 'الكل';
                if (targetText === 'all_teachers') targetText = 'المعلمين';
                if (targetText === 'all_students') targetText = 'الطلاب';

                const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('ar-EG') : '-';

                tr.innerHTML = `
                    <td>${data.title}</td>
                    <td>${(data.body || '').substring(0, 50)}${(data.body?.length > 50) ? '...' : ''}</td>
                    <td><span class="badge badge-info">${targetText}</span></td>
                    <td>${date}</td>
                `;
                historyBody.appendChild(tr);
            });

        } catch (e) {
            console.error("Load history error", e);
            loading.innerText = "خطأ في تحميل السجل";
        }
    }

});
