import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('id');

    if (!courseId) {
        alert("رابط خطأ");
        window.history.back();
        return;
    }

    document.getElementById('course-id').value = courseId;

    let currentUserId = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = await getEffectiveUserUid(user);
            await loadData(courseId);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadData(id) {
        try {
            const docRef = doc(db, "courses", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                if (data.teacherId !== currentUserId) {
                    alert("غير مصرح");
                    window.location.href = 'courses.html';
                    return;
                }

                document.getElementById('course-title').value = data.title;
                document.getElementById('course-desc').value = data.description || '';
                document.getElementById('course-price').value = data.price || 0;
                document.getElementById('course-days').value = data.daysValid || 365;
                document.getElementById('course-rank').value = data.rank || 1;
                document.getElementById('course-status').value = data.status || 'draft';

            } else {
                alert("الكورس غير موجود");
                window.location.href = 'courses.html';
            }
        } catch (error) {
            console.error(error);
        }
    }

    const form = document.getElementById('edit-course-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const loader = document.getElementById('btn-loader');

            btn.disabled = true;
            loader.style.display = 'inline-block';

            const title = document.getElementById('course-title').value;
            const desc = document.getElementById('course-desc').value;
            const price = parseFloat(document.getElementById('course-price').value);
            const days = parseInt(document.getElementById('course-days').value);
            const rank = parseInt(document.getElementById('course-rank').value);
            const status = document.getElementById('course-status').value;

            try {
                await updateDoc(doc(db, "courses", courseId), {
                    title: title,
                    description: desc,
                    price: price,
                    daysValid: days,
                    rank: rank,
                    status: status,
                    updatedAt: serverTimestamp()
                });

                alert("تم التعديل بنجاح");

                // Return to details OR list
                window.location.href = `courses.html`;

            } catch (error) {
                console.error("Error updating:", error);
                alert("حدث خطأ: " + error.message);
                btn.disabled = false;
                loader.style.display = 'none';
            }
        });
    }

});
