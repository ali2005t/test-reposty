import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initHeader } from './header-manager.js';
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    getDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('exams-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-exams');

    let currentUser = null;
    let examsData = [];

    // Close Dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        }
    });

    let currentTeacherName = "مدرس";

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            initHeader(user);
            const uid = await getEffectiveUserUid(user);
            await loadExams(uid);

            // Fetch teacher name for local usage (optional, if needed for rows)
            try {
                const d = await getDoc(doc(db, "teachers", uid));
                if (d.exists()) {
                    const data = d.data();
                    currentTeacherName = data.name || data.platformName || "مدرس";
                }
            } catch (e) { }

        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadExams(uid) {
        try {
            // Using 'exams' collection
            const q = query(
                collection(db, "exams"),
                where("teacherId", "==", uid)
            );
            const snapshot = await getDocs(q);

            tableBody.innerHTML = '';
            loadingIndicator.style.display = 'none';
            examsData = [];

            if (snapshot.empty) {
                emptyState.style.display = 'block';
                return;
            }

            snapshot.forEach(doc => {
                examsData.push({ id: doc.id, ...doc.data() });
            });

            // Fetch Training Titles... (Existing logic)
            const trainingIds = [...new Set(examsData.map(e => e.trainingId).filter(Boolean))];
            const trainingMap = {};
            if (trainingIds.length > 0) {
                await Promise.all(trainingIds.map(async (tid) => {
                    try {
                        const tSnap = await getDoc(doc(db, "training_programs", tid));
                        if (tSnap.exists()) trainingMap[tid] = tSnap.data().title;
                    } catch (e) { }
                }));
            }

            // Client Sort Descending CreatedAt
            examsData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            let index = 1;
            for (const data of examsData) {
                data.trainingTitle = trainingMap[data.trainingId] || data.trainingId;
                // Use fetched currentTeacherName if data.teacherName is default or missing
                // Or just always use currentTeacherName since this is Teacher Panel
                data.displayTeacherName = currentTeacherName;
                await renderRow(data, index++);
            }

        } catch (e) {
            console.error(e);
            loadingIndicator.innerText = "خطأ في التحميل: " + e.message;
        }
    }

    async function renderRow(data, index) {
        const template = document.getElementById('exam-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;
        row.querySelector('.row-teacher').innerText = data.displayTeacherName || data.teacherName || 'مدرس';

        const formatDate = (ts) => ts ? new Date(ts.seconds * 1000).toLocaleDateString('ar-EG') : '-';
        row.querySelector('.row-created').innerText = formatDate(data.createdAt);

        // Start/End Dates (Strings or ISO?)
        row.querySelector('.row-start').innerText = data.startDate || '-';
        row.querySelector('.row-end').innerText = data.endDate || '-';

        row.querySelector('.row-training').innerText = data.trainingTitle || data.trainingId || '-';
        row.querySelector('.row-score').innerText = data.totalScore || 0;
        row.querySelector('.row-pass').innerText = data.passScore || 0;
        row.querySelector('.row-questions').innerText = data.questionsCount || 0;

        // Publish Toggle
        const toggle = row.querySelector('.row-publish');
        toggle.checked = data.published;
        toggle.onchange = async () => {
            try {
                await updateDoc(doc(db, "exams", data.id), { published: toggle.checked });
                UIManager.showToast("تم تحديث الحالة");
            } catch (e) {
                toggle.checked = !toggle.checked;
                UIManager.showToast("خطأ: " + e.message, "error");
            }
        };

        // Actions
        const dropdownBtn = row.querySelector('.btn-icon-menu');
        const dropdownMenu = row.querySelector('.dropdown-menu');

        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m !== dropdownMenu ? m.classList.remove('show') : null);
            dropdownMenu.classList.toggle('show');
        };

        row.querySelector('.edit-btn').onclick = () => {
            window.location.href = `create-exam.html?id=${data.id}`;
        };

        // Questions button -> Navigate to questions builder (TODO)
        row.querySelector('.questions-btn').onclick = () => {
            window.location.href = `exam-questions.html?id=${data.id}`;
        };

        row.querySelector('.delete-btn').onclick = async () => {
            const confirmed = await UIManager.showConfirm(
                'حذف التقييم',
                "هل أنت متأكد من حذف هذا التقييم؟",
                'حذف',
                'إلغاء'
            );

            if (confirmed) {
                try {
                    await deleteDoc(doc(db, "exams", data.id));
                    await loadExams(currentUser.uid);
                    UIManager.showToast("تم الحذف بنجاح");
                } catch (e) { UIManager.showToast("خطأ: " + e.message, "error"); }
            }
        };

        tableBody.appendChild(row);
    }

    // Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const rows = tableBody.querySelectorAll('tr');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }

});
