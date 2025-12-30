import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const params = new URLSearchParams(window.location.search);
    const trainingId = params.get('id');

    if (!trainingId) {
        window.location.href = 'trainings.html';
        return;
    }

    const unitsTable = document.getElementById('units-table-body');
    const loadingUnits = document.getElementById('loading-units');
    const emptyUnits = document.getElementById('empty-units');
    let currentUser = null;

    // Close Dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadTrainingInfo(trainingId);
            await loadUnits(trainingId);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadTrainingInfo(id) {
        try {
            const docRef = doc(db, "training_programs", id);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                document.getElementById('page-title').innerText = `محتوى: ${snap.data().title}`;
            }
        } catch (e) { console.error(e); }
    }

    async function loadUnits(tId) {
        try {
            // Client-side sort to avoid Index Issues
            const q = query(collection(db, "courses"), where("trainingId", "==", tId));
            const snapshot = await getDocs(q);

            unitsTable.innerHTML = '';
            loadingUnits.style.display = 'none';

            if (snapshot.empty) {
                emptyUnits.style.display = 'block';
                return;
            }

            emptyUnits.style.display = 'none';

            const docs = [];
            snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));

            // Sort Descending by CreatedAt
            docs.sort((a, b) => {
                const ta = a.createdAt?.seconds || 0;
                const tb = b.createdAt?.seconds || 0;
                return tb - ta;
            });

            let index = 1;
            docs.forEach(data => {
                renderUnitRow({ data: () => data, id: data.id }, index++);
            });

        } catch (e) {
            console.error(e);
            loadingUnits.style.display = 'none';
            unitsTable.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">خطأ: ${e.message}</td></tr>`;
        }
    }

    function renderUnitRow(docData, index) {
        const data = docData.data();
        const id = docData.id;

        const template = document.getElementById('unit-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;
        row.querySelector('.row-count').innerText = data.lecturesCount || 0; // Using count from doc
        row.querySelector('.row-date').innerText = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '-';

        // Actions
        const dropdownBtn = row.querySelector('.btn-icon-menu');
        const dropdownMenu = row.querySelector('.dropdown-menu');

        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m !== dropdownMenu ? m.classList.remove('show') : null);
            dropdownMenu.classList.toggle('show');
        };

        // View Lectures -> details page
        row.querySelector('.view-lectures-btn').onclick = () => {
            // Go to course details (where lectures are listed)
            window.location.href = `course-details.html?id=${id}`;
        };

        // Edit
        row.querySelector('.edit-btn').onclick = () => {
            // Future: Implement Edit Form
            window.location.href = `edit-course.html?id=${id}`;
        };

        // Delete
        row.querySelector('.delete-btn').onclick = async () => {
            if (confirm(`هل أنت متأكد من حذف الكورس "${data.title}"؟`)) {
                try {
                    await deleteDoc(doc(db, "courses", id));
                    if (window.showToast) window.showToast("تم الحذف بنجاح", "success");
                    loadUnits(trainingId);
                } catch (e) { alert("خطأ في الحذف: " + e.message); }
            }
        };

        unitsTable.appendChild(row);
    }

    // Add Unit Button -> Redirect to Form
    const addBtn = document.getElementById('btn-add-unit');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            window.location.href = `create-course.html?trainingId=${trainingId}`;
        });
    }

});
