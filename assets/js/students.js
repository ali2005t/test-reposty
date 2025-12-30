import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initHeader } from './header-manager.js';
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// import { UIManager } from './ui-manager.js';
const UIManager = window.UIManager;

document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('students-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-students');
    let currentUser = null;

    // Close dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            initHeader(user);
            const uid = await getEffectiveUserUid(user);
            await loadStudents(uid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    let studentsData = [];

    async function loadStudents(teacherId) {
        try {
            // Updated Logic: Query students directly using enrolledTeachers array
            const q = query(
                collection(db, "students"),
                where("enrolledTeachers", "array-contains", teacherId)
            );

            const snapshot = await getDocs(q);

            studentsData = []; // Reset global data

            if (snapshot.empty) {
                loadingIndicator.style.display = 'none';
                emptyState.style.display = 'block';
                renderTable([]); // Clear table
                return;
            }

            snapshot.forEach(doc => {
                studentsData.push({ id: doc.id, ...doc.data() });
            });

            renderTable(studentsData);
            loadingIndicator.style.display = 'none';

        } catch (error) {
            console.error("Error loading students:", error);
            loadingIndicator.innerText = "حدث خطأ في تحميل البيانات: " + error.message;
            // Often requires index: https://console.firebase.google.com/...
            if (error.code === 'failed-precondition') {
                console.warn("Please create the required index in Firebase Console.");
            }
        }
    }

    function renderTable(dataArray) {
        tableBody.innerHTML = '';

        if (dataArray.length === 0) {
            emptyState.style.display = 'block';
            return;
        } else {
            emptyState.style.display = 'none';
        }

        let index = 1;
        dataArray.forEach(data => {
            const template = document.getElementById('student-row-template');
            const row = template.content.cloneNode(true);

            row.querySelector('.row-index').innerText = index++;
            row.querySelector('.row-name').innerText = data.name || data.fullName || "طالب";
            row.querySelector('.row-phone').innerText = data.phone || "-";
            row.querySelector('.row-email').innerText = data.email || "-";

            // Date
            let dateStr = '-';
            if (data.createdAt) dateStr = data.createdAt.toDate().toLocaleDateString('en-GB');
            row.querySelector('.row-date').innerText = dateStr;

            // Actions
            const btnMenu = row.querySelector('.btn-icon-menu');
            const menu = row.querySelector('.dropdown-menu');

            btnMenu.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-menu').forEach(m => m !== menu ? m.classList.remove('show') : null);
                menu.classList.toggle('show');
            };

            // 1. Reset Device
            const resetBtn = row.querySelector('.btn-reset-device');
            resetBtn.onclick = () => resetDevice(data.id);

            // 2. Ban / Unban
            const banBtn = row.querySelector('.btn-ban');
            if (data.isBanned) {
                banBtn.innerHTML = '<i class="fas fa-check-circle"></i> إلغاء الحظر';
                banBtn.classList.remove('danger');
                banBtn.style.color = '#10b981';
            } else {
                banBtn.innerHTML = '<i class="fas fa-ban"></i> حظر الحساب';
                banBtn.classList.add('danger');
                banBtn.style.color = ''; // reset
            }
            banBtn.onclick = () => toggleBan(data.id, data.isBanned);

            // 3. Profile
            row.querySelector('.btn-profile').onclick = () => {
                // Future: Open Profile Modal or Page
                UIManager.showToast('سيتم تفعيل صفحة الطالب قريباً', 'info');
            };

            // 4. Grant Access Shortcut
            const grantBtn = row.querySelector('.btn-grant-access');
            if (grantBtn) {
                grantBtn.onclick = () => {
                    // Redirect to manual-access with student info
                    const params = new URLSearchParams();
                    params.set('sid', data.id);
                    params.set('sname', data.name || data.fullName);
                    params.set('semail', data.email);
                    window.location.href = `manual-access.html?${params.toString()}`;
                };
            }

            tableBody.appendChild(row);
        });
    }

    async function toggleBan(studentId, currentStatus) {
        const action = currentStatus ? "إلغاء حظر" : "حظر";
        const confirmed = await UIManager.showConfirm(
            action + ' طالب',
            `هل أنت متأكد من ${action} هذا الطالب؟`,
            action,
            'إلغاء'
        );

        if (!confirmed) return;

        try {
            await updateDoc(doc(db, "students", studentId), {
                isBanned: !currentStatus
            });
            UIManager.showToast(`تم ${action} الطالب بنجاح`);
            // Reload
            if (currentUser) loadStudents(currentUser.uid);
        } catch (e) {
            console.error(e);
            UIManager.showToast("حدث خطأ أثناء تنفيذ الأمر", "error");
        }
    }

    async function resetDevice(studentId) {
        const confirmed = await UIManager.showConfirm(
            'إعادة ضبط الجهاز',
            "هل أنت متأكد من إعادة تعيين الجهاز (Device Reset) لهذا الطالب؟\nسيتمكن الطالب من الدخول من جهاز جديد.",
            'نعم، أعد التعيين',
            'إلغاء'
        );

        if (!confirmed) return;

        try {
            await updateDoc(doc(db, "students", studentId), {
                deviceId: null // Clear device ID
            });
            UIManager.showToast("تم إعادة تعيين الجهاز بنجاح");
            // Reload not strictly needed but good for sync
            if (currentUser) loadStudents(currentUser.uid);
        } catch (e) {
            console.error(e);
            UIManager.showToast("حدث خطأ أثناء إعادة التعيين", "error");
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = studentsData.filter(s =>
                ((s.name || s.fullName || '').toLowerCase().includes(term)) ||
                ((s.phone || '').includes(term))
            );
            renderTable(filtered);
        });
    }

});
