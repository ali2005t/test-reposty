import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { UIManager } from './ui-manager.js';
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    addDoc,
    doc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let currentUserId = null;
    const gradeSelect = document.getElementById('training-grade');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = await getEffectiveUserUid(user);
            await loadTeacherSettings(currentUserId);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadTeacherSettings(uid) {
        try {
            const docRef = doc(db, "teachers", uid);
            const snap = await getDoc(docRef);

            gradeSelect.innerHTML = '<option value="">عام (الكل)</option>'; // Default

            if (snap.exists()) {
                const data = snap.data();
                const grades = data.academicYears || data.grades || []; // Support both just in case
                if (Array.isArray(grades) && grades.length > 0) {
                    grades.forEach(g => {
                        const val = typeof g === 'object' ? g.id : g;
                        const label = typeof g === 'object' ? g.name : g;
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.innerText = label;
                        gradeSelect.appendChild(opt);
                    });
                } else {
                    // If empty, user sees General
                }
            }
        } catch (e) { console.error("Settings Load Error", e); }
    }

    const form = document.getElementById('create-training-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-btn');
        const loader = document.getElementById('btn-loader');

        btn.disabled = true;
        loader.style.display = 'inline-block';

        const title = document.getElementById('training-title').value;
        const desc = document.getElementById('training-desc').value;
        const image = document.getElementById('training-image').value || 'https://via.placeholder.com/400x200?text=Training';
        // Price removed from UI, default to 0
        const price = 0;
        const status = document.getElementById('training-status').value;
        const grade = document.getElementById('training-grade').value;

        try {
            await addDoc(collection(db, "training_programs"), {
                teacherId: currentUserId,
                title: title,
                description: desc,
                coverImage: image,
                price: parseFloat(price),
                status: status,
                grade: grade,
                createdAt: serverTimestamp()
            });

            window.location.href = 'trainings.html';

        } catch (error) {
            console.error("Error creating training:", error);
            UIManager.showToast("حدث خطأ في إنشاء الدورة", "error");
            btn.disabled = false;
            loader.style.display = 'none';
        }
    });

});
