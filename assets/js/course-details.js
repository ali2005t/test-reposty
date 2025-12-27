import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

    // Get Course ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');

    if (!courseId) {
        alert("رابط غير صحيح");
        window.location.href = 'courses.html';
        return;
    }

    // Set Add Lecture Link
    document.getElementById('add-lecture-btn').onclick = () => {
        window.location.href = `create-lecture.html?unitId=${courseId}`;
    };

    // Set Generate Codes Link
    document.getElementById('generate-codes-btn').onclick = () => {
        window.location.href = `generate-codes.html?courseId=${courseId}`;
    };

    const tableBody = document.getElementById('lectures-table-body');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-lectures');
    const searchInput = document.getElementById('search-lectures');

    // Close dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
        }
    });


    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Teacher Name
            let teacherName = "المحاضر";
            const userDoc = await getDoc(doc(db, "teachers", user.uid));
            if (userDoc.exists()) teacherName = userDoc.data().name || userDoc.data().platformName;

            await loadCourseDetails(courseId);
            await loadLectures(courseId, teacherName);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadCourseDetails(id) {
        try {
            const docRef = doc(db, "courses", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                document.title = `${data.title} - Ta3leemy`;
                document.getElementById('header-course-name').innerText = data.title;

                // Back Link Logic
                const backLink = document.getElementById('back-training-link');
                if (data.trainingId) {
                    backLink.href = `training-details.html?id=${data.trainingId}`;
                    backLink.innerText = "تفاصيل الدورة";
                } else {
                    backLink.style.display = 'none';
                }

            } else {
                alert("الكورس غير موجود");
                window.location.href = 'courses.html';
            }
        } catch (error) {
            console.error("Error fetching details:", error);
        }
    }

    let lecturesData = [];

    async function loadLectures(courseId, teacherName) {
        try {
            const q = query(
                collection(db, "course_content"),
                where("unitId", "==", courseId),
                where("type", "==", "lecture")
                // orderBy("order", "asc")
            );

            const querySnapshot = await getDocs(q);

            tableBody.innerHTML = '';
            lecturesData = [];
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
                lecturesData.push(data);
                renderRow(data, index++);
            });

        } catch (error) {
            console.error("Error loading lectures:", error);
            loadingIndicator.innerText = "حدث خطأ: " + error.message;
        }
    }

    function renderRow(data, index) {
        const template = document.getElementById('lecture-row-template');
        const row = template.content.cloneNode(true);

        row.querySelector('.row-index').innerText = index;
        row.querySelector('.row-title').innerText = data.title;
        row.querySelector('.row-instructor').innerText = data.teacherName;

        let typeBadge = row.querySelector('.badge');
        if (data.type === 'video') {
            typeBadge.innerText = 'فيديو';
            typeBadge.style.background = 'rgba(59, 130, 246, 0.15)';
            typeBadge.style.color = '#60a5fa';
        } else if (data.type === 'pdf') {
            typeBadge.innerText = 'ملف PDF';
            typeBadge.style.background = 'rgba(239, 68, 68, 0.15)';
            typeBadge.style.color = '#f87171';
        }

        // Date
        let dateStr = '-';
        if (data.createdAt) dateStr = data.createdAt.toDate().toLocaleDateString('en-GB');
        row.querySelector('.row-date').innerText = dateStr;

        // Actions
        const dropdownBtn = row.querySelector('.btn-icon-menu');
        const dropdownMenu = row.querySelector('.dropdown-menu');

        dropdownBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('show'));
            dropdownMenu.classList.toggle('show');
        };

        const editBtn = row.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.onclick = () => {
                window.location.href = `create-lecture.html?id=${data.id}&unitId=${courseId}`;
            };
        }

        const deleteBtn = row.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = async () => {
                if (confirm("هل أنت متأكد من حذف هذه المحاضرة؟")) {
                    try {
                        const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        // Need to match correct collection 'course_content'
                        await deleteDoc(doc(db, "course_content", data.id));
                        await loadLectures(courseId, data.teacherName);
                    } catch (e) { alert("حدث خطأ " + e.message); }
                }
            };
        }

        tableBody.appendChild(row);
    }

    // Search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            tableBody.innerHTML = '';
            let index = 1;
            const filtered = lecturesData.filter(l => l.title.toLowerCase().includes(term));
            if (filtered.length > 0) {
                filtered.forEach(l => renderRow(l, index++));
                emptyState.style.display = 'none';
            } else {
                emptyState.style.display = 'block';
            }
        });
    }

});
