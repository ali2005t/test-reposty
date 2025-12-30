import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const tableBody = document.getElementById('users-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadStaff(user.uid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadStaff(uid) {
        try {
            // Fetch invites/staff related to this owner
            const q = query(collection(db, "staff_invites"), where("ownerId", "==", uid));
            const snapshot = await getDocs(q);

            loadingIndicator.style.display = 'none';
            tableBody.innerHTML = '';

            if (snapshot.empty) {
                emptyState.style.display = 'block';
                return;
            }

            let index = 1;
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                data.id = docSnap.id;
                renderRow(data, index++);
            });

        } catch (error) {
            console.error(error);
            loadingIndicator.innerText = "Error loading staff";
        }
    }

    function renderRow(data, index) {
        const template = document.getElementById('user-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-name').innerText = data.name;
        row.querySelector('.row-role').innerText = data.role.toUpperCase();
        row.querySelector('.row-email').innerText = data.email;

        // Actions
        const btn = row.querySelector('.btn-icon-menu');
        const menu = row.querySelector('.dropdown-menu');

        btn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            menu.classList.toggle('show');
        };

        // Delete Logic
        const deleteBtn = row.querySelector('.dropdown-item.danger');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
                    await deleteDoc(doc(db, "staff_invites", data.id));
                    window.location.reload();
                }
            };
        }

        tableBody.appendChild(row);
    }

});
