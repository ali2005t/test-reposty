import { db, auth } from './firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import { initHeader } from './header-manager.js'; // Use the new central manager

let currentUser = null; // This variable is no longer strictly needed for UID, but kept for potential other user properties if `user` object is passed around.
const examSelect = document.getElementById('exam-select');
const tbody = document.getElementById('results-table-body');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user; // Keep currentUser for other properties if needed by initHeader or other functions
        initHeader(user); // Initialize full header
        await loadExams();
    } else {
        window.location.href = '../auth/login.html'; // Correct path if needed
    }
});

async function loadExams() {
    try {
        let snapshot;
        try {
            const q = query(
                collection(db, "exams"),
                where("teacherId", "==", currentUser.uid),
                orderBy("createdAt", "desc")
            );
            snapshot = await getDocs(q);
        } catch (err) {
            if (err.code === 'failed-precondition') {
                console.warn("Firestore Index missing. Falling back to client-side sort.");
                // Fallback: Query without orderBy
                const qFallback = query(
                    collection(db, "exams"),
                    where("teacherId", "==", currentUser.uid)
                );
                snapshot = await getDocs(qFallback);
                // Sort manually
                const docs = [];
                snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
                docs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                // Re-mock snapshot for below loop (or refactor)
                // Let's just render here to save complex mocking
                renderExamOptions(docs);
                return;
            } else {
                throw err;
            }
        }

        const docs = [];
        snapshot.forEach(d => docs.push({ id: d.id, ...d.data() }));
        renderExamOptions(docs);

    } catch (e) {
        console.error("Error loading exams:", e);
        examSelect.innerHTML = '<option>خطأ في التحميل</option>';
    }
}

function renderExamOptions(exams) {
    examSelect.innerHTML = '<option value="">-- اختر الامتحان --</option>';
    if (exams.length === 0) {
        examSelect.innerHTML += '<option disabled>لا توجد امتحانات</option>';
        return;
    }
    exams.forEach(data => {
        const opt = document.createElement('option');
        opt.value = data.id;
        opt.textContent = data.title;
        examSelect.appendChild(opt);
    });
    examSelect.addEventListener('change', () => loadSubmissions(examSelect.value));
}

async function loadSubmissions(examId) {
    if (!examId) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري تحميل النتائج...</td></tr>';

    try {
        const q = query(
            collection(db, "exam_submissions"),
            where("examId", "==", examId),
            orderBy("submittedAt", "desc")
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد نتائج لهذا الامتحان بعد</td></tr>';
            return;
        }

        // We might need student names. Stored in submission? 
        // In student-exam.js, we save `studentId` and `studentName`.

        tbody.innerHTML = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');

            // Date Format
            let dateStr = 'Unknown';
            if (data.submittedAt && data.submittedAt.toDate) {
                dateStr = data.submittedAt.toDate().toLocaleString('ar-EG');
            }

            // Status Logic
            const status = data.status || (data.pendingGrading ? 'pending_review' : 'graded');
            const isPending = status === 'pending_review';

            const statusBadge = isPending
                ? '<span class="status-badge status-draft" style="background:#fef3c7; color:#d97706;">يحتاج تصحيح</span>'
                : '<span class="status-badge status-active" style="background:#d1fae5; color:#059669;">تم التصحيح</span>';

            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${data.studentName || 'غير معروف'}</div>
                    <div style="font-size:0.8rem; opacity:0.7;">${data.studentEmail || ''}</div>
                </td>
                <td>${dateStr}</td>
                <td>${data.autoScore || 0}</td>
                <td style="font-weight:bold; color:var(--primary-color);">${data.totalScore || 0} / ${data.examTotalScore || '?'}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn-icon" onclick="window.open('grade-submission.html?subId=${docSnap.id}', '_blank')" title="تصحيح / عرض">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Error loading submissions:", e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">خطأ: ${e.message}</td></tr>`;
    }
}
