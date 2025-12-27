import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, updateDoc, orderBy, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadRequests();
        } else {
            window.location.href = 'login.html';
        }
    });

    async function loadRequests() {
        const tbody = document.getElementById('requests-table-body');
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">جاري التحميل...</td></tr>';

        try {
            // Fetch teachers who have 'appSettings' or 'appRequestStatus'
            // Since we can't easily query deep fields or non-existing fields efficiently without index,
            // we will query teachers where `appRequestStatus` is existing.
            // Assumption: `appRequestStatus` field exists for requested ones.
            // We can query for 'pending' and 'completed'.

            const q = query(collection(db, "teachers"), where("appRequestStatus", "!=", ""));
            // Note: "!=" empty string might not work if field missing. 
            // Better: where("appRequestStatus", ">", "") to get all non-empty strings.
            // Or if we only want 'pending', let's just fetch 'pending' first, then others if needed.
            // But user wants history? Start with pending.

            const qPending = query(collection(db, "teachers"), where("appRequestStatus", "==", "pending"));
            const qCompleted = query(collection(db, "teachers"), where("appRequestStatus", "==", "completed"));

            const [snapPending, snapCompleted] = await Promise.all([
                getDocs(qPending),
                getDocs(qCompleted)
            ]);

            const requests = [];
            snapPending.forEach(doc => requests.push({ id: doc.id, ...doc.data(), isPending: true }));
            snapCompleted.forEach(doc => requests.push({ id: doc.id, ...doc.data(), isPending: false }));

            // Sort by date (local sort as we merged queries)
            requests.sort((a, b) => {
                const tA = a.appRequestDate ? a.appRequestDate.toMillis() : 0;
                const tB = b.appRequestDate ? b.appRequestDate.toMillis() : 0;
                return tB - tA;
            });

            if (requests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">لا توجد طلبات حالياً</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            requests.forEach(req => {
                const tr = document.createElement('tr');

                const settings = req.appSettings || {};
                const date = req.appRequestDate ? new Date(req.appRequestDate.toDate()).toLocaleDateString('ar-EG') : '-';
                const statusBadge = req.isPending
                    ? '<span class="status-badge status-pending">قيد المراجعة</span>'
                    : '<span class="status-badge status-completed">مكتمل</span>';

                const appLink = req.appDownloadLink ? `<a href="${req.appDownloadLink}" target="_blank">تحميل</a>` : '-';

                // Platform Link
                const platformUrl = `../student-app/index.html?t=${req.id}`;
                const platformLinkHtml = `<a href="${platformUrl}" target="_blank" style="color:#6366f1; text-decoration:none;"><i class="fas fa-external-link-alt"></i> فتح</a>`;

                tr.innerHTML = `
                    <td>${req.name || req.email}</td>
                    <td>${settings.appName || '-'}</td>
                    <td>${platformLinkHtml}</td>
                    <td><span class="color-preview" style="background:${settings.brandColor || '#ccc'}"></span></td>
                    <td>${date}</td>
                    <td>${statusBadge}</td>
                    <td>${appLink}</td>
                    <td>
                        ${req.isPending ? `
                            <button class="btn-icon" onclick="openCompleteModal('${req.id}')" title="إتمام التجهيز">
                                <i class="fas fa-check-circle" style="color:#10b981;"></i>
                            </button>
                        ` : '<i class="fas fa-check" style="color:#cbd5e1;"></i>'}
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">حدث خطأ في جلب البيانات</td></tr>';
        }
    }

    // Attach to window for global access from HTML onclick
    window.openCompleteModal = (teacherId) => {
        document.getElementById('target-teacher-id').value = teacherId;
        document.getElementById('complete-modal').style.display = 'flex';
    };

    window.saveCompletion = async () => {
        const teacherId = document.getElementById('target-teacher-id').value;
        const link = document.getElementById('app-link').value;

        if (!link) {
            alert("يرجى إدخال رابط التحميل");
            return;
        }

        const btn = document.getElementById('save-complete-btn');
        btn.innerText = 'جاري الحفظ...';
        btn.disabled = true;

        try {
            // Update Teacher Doc
            await updateDoc(doc(db, "teachers", teacherId), {
                appRequestStatus: 'completed',
                appDownloadLink: link,
                appCompletedDate: serverTimestamp()
            });

            // Notify Teacher
            await addDoc(collection(db, "notifications"), {
                target: 'teacher',
                targetId: teacherId, // Specific teacher
                type: 'app_ready',
                title: 'تطبيقك جاهز!',
                message: 'تم تجهيز تطبيق الخاص بك. يمكنك تحميله الآن من الإعدادات.',
                createdAt: serverTimestamp(),
                read: false
            });

            alert("تم إتمام الطلب بنجاح");
            document.getElementById('complete-modal').style.display = 'none';
            loadRequests();

        } catch (e) {
            console.error(e);
            alert("حدث خطأ: " + e.message);
        } finally {
            btn.innerText = 'إرسال وإتمام';
            btn.disabled = false;
        }
    };

    // Filter Logic
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#requests-table-body tr');
        rows.forEach(row => {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    });
});
