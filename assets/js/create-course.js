import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const trainingId = urlParams.get('trainingId');

    if (!trainingId) {
        alert("خطأ: لم يتم تحديد الدورة التدريبية");
        window.history.back();
        return;
    }

    document.getElementById('training-id').value = trainingId;

    let currentUserId = null;
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = await getEffectiveUserUid(user);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    const form = document.getElementById('create-course-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const loader = document.getElementById('btn-loader');

            btn.disabled = true;
            loader.style.display = 'inline-block';

            // Gather Data
            const title = document.getElementById('course-title').value;
            const price = parseFloat(document.getElementById('course-price').value) || 0;
            const days = parseInt(document.getElementById('course-days').value) || 365;
            const rank = parseInt(document.getElementById('course-rank').value) || 1;
            const status = document.getElementById('course-status').value;
            const desc = document.getElementById('course-desc').value;

            try {
                // 1. Create Course Doc
                await addDoc(collection(db, "courses"), {
                    teacherId: currentUserId,
                    trainingId: trainingId,
                    title: title,
                    description: desc,
                    price: price,
                    daysValid: days,
                    rank: rank,
                    status: status,
                    lecturesCount: 0,
                    createdAt: serverTimestamp()
                });

                // 2. Increment Course Count
                const trainingRef = doc(db, "training_programs", trainingId);
                await updateDoc(trainingRef, {
                    courseCount: increment(1)
                });

                window.location.href = `course-content.html?id=${trainingId}`;

            } catch (error) {
                console.error("Error creating course:", error);
                alert("حدث خطأ: " + error.message);
                btn.disabled = false;
                loader.style.display = 'none';
            }
        });
    }
});
