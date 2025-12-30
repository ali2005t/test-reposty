import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Get Training ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const trainingId = urlParams.get('id');

    if (!trainingId) {
        alert("رابط غير صحيح");
        window.location.href = 'trainings.html';
        return;
    }

    // Set Add Course Link
    document.getElementById('add-course-btn').onclick = () => {
        window.location.href = `create-course.html?trainingId=${trainingId}`;
    };

    const tableBody = document.getElementById('courses-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-courses');
    const searchInput = document.getElementById('search-courses');

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {

            // Teacher Name (Should ideally be fetched once globally)
            let teacherName = "المحاضر";
            const effectiveUid = await getEffectiveUserUid(user);

            if (!effectiveUid) return;

            const userDoc = await getDoc(doc(db, "teachers", effectiveUid));
            if (userDoc.exists()) teacherName = userDoc.data().name || userDoc.data().platformName;

            // 1. Fetch Training Details
            await loadTrainingDetails(trainingId);
            // 2. Fetch Courses
            await loadCourses(trainingId, teacherName);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadTrainingDetails(id) {
        try {
            const docRef = doc(db, "training_programs", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                document.title = `${data.title} - Ta3leemy`;
                document.getElementById('header-training-name').innerText = data.title;
                // document.getElementById('training-title').innerText = data.title;
            } else {
                alert("الدورة غير موجودة");
                window.location.href = 'trainings.html';
            }
        } catch (error) {
            console.error("Error fetching details:", error);
        }
    }

    let coursesData = [];

    async function loadCourses(trainingId, teacherName) {
        try {
            const q = query(
                collection(db, "courses"),
                where("trainingId", "==", trainingId)
                // orderBy("rank", "asc") // Index required later
            );

            const querySnapshot = await getDocs(q);

            tableBody.innerHTML = '';
            coursesData = [];
            loadingIndicator.style.display = 'none';

            if (querySnapshot.empty) {
                emptyState.style.display = 'block';
                return;
            }

            let index = 1;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                data.id = doc.id;
                data.teacherName = teacherName;
                coursesData.push(data);
                renderRow(data, index++);
            });

        } catch (error) {
            console.error("Error loading courses:", error);
            loadingIndicator.innerText = "حدث خطأ: " + error.message;
        }
    }

    function renderRow(data, index) {
        const template = document.getElementById('course-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;
        row.querySelector('.row-instructor').innerText = data.teacherName;

        const price = data.price ? `${data.price} EGP` : 'مجاني';
        row.querySelector('.row-price').innerText = price;

        row.querySelector('.row-days').innerText = data.daysValid || '-';

        const statusBadge = row.querySelector('.row-status');
        if (data.status === 'active') {
            statusBadge.className = 'badge badge-purple';
            statusBadge.innerText = 'منشور';
        } else {
            statusBadge.className = 'badge badge-warning';
            statusBadge.innerText = 'مسودة';
        }

        // Actions
        const dropdownBtn = row.querySelector('.btn-icon-menu');
        const dropdownMenu = row.querySelector('.dropdown-menu');

        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            dropdownMenu.classList.toggle('show');
        };

        row.querySelector('.view-lectures-btn').onclick = () => {
            window.location.href = `course-details.html?id=${data.id}`;
        };

        tableBody.appendChild(row);
    }

    // Simple Search implementation
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            tableBody.innerHTML = '';
            let index = 1;
            const filtered = coursesData.filter(c => c.title.toLowerCase().includes(term));
            if (filtered.length > 0) {
                filtered.forEach(c => renderRow(c, index++));
                emptyState.style.display = 'none';
            } else {
                emptyState.style.display = 'block';
                emptyState.querySelector('p').innerText = "لا توجد نتائج";
            }
        });
    }

});
