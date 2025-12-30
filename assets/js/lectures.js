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
    deleteDoc,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('lectures-table-body');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');
    const pageTitle = document.querySelector('h3');
    const addBtn = document.querySelector('.top-bar .btn-primary');

    const params = new URLSearchParams(window.location.search);
    const filterUnitId = params.get('unitId');
    const filterTrainingId = params.get('trainingId');

    // Dropdown close logic
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            initHeader(user);
            const uid = await getEffectiveUserUid(user);
            await loadLectures(uid);
            setupAddButton();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    function setupAddButton() {
        if (addBtn && filterUnitId && filterTrainingId) {
            addBtn.onclick = () => {
                window.location.href = `create-lecture.html?trainingId=${filterTrainingId}&unitId=${filterUnitId}`;
            };
        }
    }

    async function loadLectures(uid) {
        try {
            // Build Query
            let constraints = [
                where("teacherId", "==", uid),
                where("type", "==", "lecture")
            ];

            if (filterUnitId) {
                constraints.push(where("unitId", "==", filterUnitId));
                const unitSnap = await getDoc(doc(db, "units", filterUnitId));
                if (unitSnap.exists()) {
                    if (pageTitle) pageTitle.innerText = `محاضرات: ${unitSnap.data().title}`;
                }
            }

            const q = query(collection(db, "course_content"), ...constraints);
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                loading.style.display = 'none';
                empty.style.display = 'block';
                return;
            }

            const lectures = [];
            snapshot.forEach(doc => lectures.push({ id: doc.id, ...doc.data() }));

            // Resolve Names
            const trainingMap = {};
            const unitMap = {};

            const tQ = query(collection(db, "training_programs"), where("teacherId", "==", uid));
            const tSnap = await getDocs(tQ);
            tSnap.forEach(d => trainingMap[d.id] = d.data().title);

            const uQ = query(collection(db, "units"), where("teacherId", "==", uid));
            const uSnap = await getDocs(uQ);
            uSnap.forEach(d => unitMap[d.id] = d.data().title);

            // Render
            loading.style.display = 'none';
            tableBody.innerHTML = '';

            lectures.forEach((lect, index) => {
                renderRow(lect, index + 1, trainingMap, unitMap);
            });

        } catch (e) {
            console.error(e);
            loading.innerText = "خطأ في التحميل";
        }
    }

    function renderRow(data, index, tMap, uMap) {
        const template = document.getElementById('lecture-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;

        let typeText = "";
        if (data.hasVideo) typeText += '<i class="fas fa-video"></i> ';
        if (data.hasDrive) typeText += '<i class="fas fa-file-pdf"></i> ';
        if (data.isLive) typeText += '<span style="color:red; font-weight:bold;">LIVE</span> ';

        row.querySelector('.row-type').innerHTML = typeText || "محاضرة";

        row.querySelector('.row-training').innerText = tMap[data.trainingId] || '---';
        row.querySelector('.row-unit').innerText = uMap[data.unitId] || '---';

        const price = data.price > 0 ? `${data.price} ج.م` : 'مجاني';
        row.querySelector('.row-price').innerText = price;

        row.querySelector('.row-limits').innerText = `${data.viewsLimit || '∞'} / ${data.daysLimit || '∞'} يوم`;

        const dropdownBtn = row.querySelector('.btn-icon-menu');
        const dropdownMenu = row.querySelector('.dropdown-menu');

        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m !== dropdownMenu ? m.classList.remove('show') : null);
            dropdownMenu.classList.toggle('show');
        };

        const editBtn = row.querySelector('.edit-btn');
        editBtn.onclick = () => {
            window.location.href = `create-lecture.html?id=${data.id}`;
        };

        const deleteBtn = row.querySelector('.delete-btn');
        deleteBtn.onclick = async () => {
            if (confirm(`هل أنت متأكد من حذف ${data.title}؟`)) {
                try {
                    await deleteDoc(doc(db, "course_content", data.id));
                    if (window.showToast) window.showToast("تم الحذف بنجاح", "success");
                    location.reload();
                } catch (e) {
                    alert("خطأ في الحذف");
                }
            }
        };

        tableBody.appendChild(row);
    }

});
