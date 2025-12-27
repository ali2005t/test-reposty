import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const trainingId = urlParams.get('id');

    if (!trainingId) {
        alert("رابط خطأ");
        window.history.back();
        return;
    }

    document.getElementById('training-id').value = trainingId;

    let currentUser = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadData(trainingId);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadData(id) {
        try {
            const docRef = doc(db, "training_programs", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                // Verify Owner
                if (data.teacherId !== currentUser.uid) {
                    alert("غير مصرح لك بتعديل هذا المحتوى");
                    window.location.href = 'trainings.html';
                    return;
                }

                document.getElementById('title').value = data.title;
                document.getElementById('description').value = data.description || '';
                document.getElementById('cover-image').value = data.coverImage || '';

                if (data.status === 'active') {
                    document.getElementById('public-toggle').checked = true;
                }

            } else {
                alert("المحتوى غير موجود");
                window.location.href = 'trainings.html';
            }
        } catch (error) {
            console.error(error);
        }
    }

    const form = document.getElementById('edit-training-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const loader = document.getElementById('btn-loader');

            btn.disabled = true;
            loader.style.display = 'inline-block';

            const title = document.getElementById('title').value;
            const desc = document.getElementById('description').value;
            const cover = document.getElementById('cover-image').value;
            const isPublic = document.getElementById('public-toggle').checked;

            try {
                await updateDoc(doc(db, "training_programs", trainingId), {
                    title: title,
                    description: desc,
                    coverImage: cover,
                    status: isPublic ? 'active' : 'draft',
                    updatedAt: serverTimestamp()
                });

                alert("تم التعديل بنجاح");
                window.location.href = 'trainings.html';

            } catch (error) {
                console.error("Error updating:", error);
                alert("حدث خطأ: " + error.message);
                btn.disabled = false;
                loader.style.display = 'none';
            }
        });
    }

});
