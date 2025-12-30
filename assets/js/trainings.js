import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initHeader } from './header-manager.js';
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    orderBy,
    serverTimestamp,
    getDoc,
    doc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // ... (unchanged setup) ...
    const tableBody = document.getElementById('trainings-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const searchInput = document.getElementById('search-trainings');

    // ... (unchanged listeners) ...
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            initHeader(user);
            const uid = await getEffectiveUserUid(user);

            let teacherName = "المحاضر";
            const userDoc = await getDoc(doc(db, "teachers", uid));
            if (userDoc.exists()) {
                teacherName = userDoc.data().name || userDoc.data().platformName || "المحاضر";
            }
            await loadTrainings(uid, teacherName);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    let trainingsData = [];

    async function loadTrainings(uid, teacherName) {
        try {
            const q = query(
                collection(db, "training_programs"),
                where("teacherId", "==", uid)
            );

            const querySnapshot = await getDocs(q);

            tableBody.innerHTML = '';
            trainingsData = [];

            loadingIndicator.style.display = 'none';

            if (querySnapshot.empty) {
                emptyState.style.display = 'block';
                return;
            }

            let index = 1;
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                data.id = docSnap.id;
                data.teacherName = teacherName;
                trainingsData.push(data);
                renderRow(data, index++);
            });

        } catch (error) {
            console.error("Error loading trainings:", error);
            loadingIndicator.innerText = "حدث خطأ في تحميل البيانات";
        }
    }

    function renderRow(data, index) {
        const template = document.getElementById('training-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;
        row.querySelector('.row-instructor').innerText = data.teacherName;

        const statusBadge = row.querySelector('.row-status');
        if (data.status === 'active') {
            statusBadge.className = 'badge badge-purple';
            statusBadge.innerText = 'منشور';
        } else {
            statusBadge.className = 'badge badge-warning';
            statusBadge.innerText = 'معلق';
        }

        let dateStr = '-';
        if (data.createdAt) {
            const date = data.createdAt.toDate();
            dateStr = date.toLocaleDateString('en-GB');
        }
        row.querySelector('.row-date').innerText = dateStr;

        // Actions
        const dropdownBtn = row.querySelector('.btn-icon-menu');
        const dropdownMenu = row.querySelector('.dropdown-menu'); // This selects the template's dropdown menu in the clone

        // Important: In cloneNode, elements are new.
        // We must select them from 'row'

        const btn = row.querySelector('.btn-icon-menu');
        const menu = row.querySelector('.dropdown-menu');

        btn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m !== menu ? m.classList.remove('show') : null);
            menu.classList.toggle('show');
        };

        // View Content
        const viewBtn = row.querySelector('.view-btn');
        if (viewBtn) {
            viewBtn.onclick = () => window.location.href = `course-content.html?id=${data.id}`;
        }

        // Edit
        const items = row.querySelectorAll('.dropdown-item');
        // Items[0] is View, Items[1] is Edit (usually), Items[2] is Delete (danger)
        // Check text or class to be safe? 
        // Template has: View, Edit, Danger(Delete)

        // Edit Button
        const editBtn = row.querySelectorAll('.dropdown-item')[1];
        if (editBtn) editBtn.onclick = () => window.location.href = `create-training.html?id=${data.id}`; // using create page for edit usually

        // Delete Button
        const deleteBtn = row.querySelector('.dropdown-item.danger');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (confirm(`هل أنت متأكد من حذف الدورة التدريبية "${data.title}"؟ سيتم حذف جميع المحتويات المرتبطة بها.`)) {
                    try {
                        await deleteDoc(doc(db, "training_programs", data.id));
                        showToast("تم الحذف بنجاح", "success");
                        // Remove from UI
                        const tr = btn.closest('tr');
                        tr.remove();
                    } catch (e) {
                        console.error(e);
                        showToast("خطأ في الحذف: " + e.message, "error");
                    }
                }
            };
        }

        tableBody.appendChild(row);
    }

    // Search Filter
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            tableBody.innerHTML = '';
            let index = 1;

            const filtered = trainingsData.filter(t => t.title.toLowerCase().includes(term));

            if (filtered.length > 0) {
                filtered.forEach(data => renderRow(data, index++));
                emptyState.style.display = 'none';
            } else {
                emptyState.style.display = 'block';
                emptyState.innerText = "لا توجد نتائج مطابقة";
            }
        });
    }

});
