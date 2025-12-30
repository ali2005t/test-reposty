import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import { UIManager } from './ui-manager.js';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const trainingSelect = document.getElementById('exam-training');
    const form = document.getElementById('create-exam-form');
    const loader = document.getElementById('full-loader');

    let currentUser = null;
    let editMode = false;
    let examId = null;

    // Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    if (idParam) {
        editMode = true;
        examId = idParam;
        document.getElementById('page-title').innerText = "تعديل التقييم";
    }

    let currentTeacherId = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // initHeader(user); // Attempt to init header if imported, otherwise skipped as per original file structure checking
            // Actually, original file didn't import initHeader. I should check if I need to import it.
            // The user wants "Impersonation", passing the right UID is critical. 
            // Header is secondary but nice.

            const uid = await getEffectiveUserUid(user);
            currentTeacherId = uid;

            if (uid) {
                await loadTrainingPrograms(uid);
                if (editMode) {
                    await loadExamData(examId);
                }
            }
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadTrainingPrograms(uid) {
        try {
            const q = query(collection(db, "training_programs"), where("teacherId", "==", uid));
            const snapshot = await getDocs(q);

            trainingSelect.innerHTML = '<option value="">-- اختر الدورة التدريبية --</option>';

            snapshot.forEach(doc => {
                const data = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.innerText = data.title;
                trainingSelect.appendChild(option);
            });
        } catch (e) {
            console.error("Training Load Error", e);
        }
    }

    async function loadExamData(id) {
        loader.style.display = 'flex';
        try {
            const docSnap = await getDoc(doc(db, "exams", id));
            if (docSnap.exists()) {
                const data = docSnap.data();

                document.getElementById('exam-title').value = data.title || '';
                document.getElementById('exam-training').value = data.trainingId || '';

                // Dates: Convert Timestamp to datetime-local string
                // Format: YYYY-MM-DDTHH:mm
                const toInputFormat = (ts) => {
                    if (!ts) return '';
                    const d = ts.toDate();
                    // Manual format because toISOString is UTC
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };

                if (data.startDate) document.getElementById('exam-start').value = toInputFormat(data.startDate); // String or Timestamp? Usually logic saves Timestamp
                if (data.endDate) document.getElementById('exam-end').value = toInputFormat(data.endDate);

                document.getElementById('exam-duration').value = data.duration || '';
                document.getElementById('exam-pass-score').value = data.passScore || 50;
                document.getElementById('exam-desc').value = data.description || '';

                document.getElementById('exam-published').checked = !!data.published;
                document.getElementById('exam-show-results').checked = data.showResults !== false; // Default true

            } else {
                UIManager.showToast("التقييم غير موجود", "error");
                setTimeout(() => window.location.href = 'exams.html', 1500);
            }
        } catch (e) {
            console.error(e);
            UIManager.showToast("خطأ في تحميل البيانات", "error");
        } finally {
            loader.style.display = 'none';
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('exam-title').value;
        const trainingId = document.getElementById('exam-training').value;
        const startStr = document.getElementById('exam-start').value;
        const endStr = document.getElementById('exam-end').value;
        const duration = Number(document.getElementById('exam-duration').value);
        const passScore = Number(document.getElementById('exam-pass-score').value);
        const desc = document.getElementById('exam-desc').value;
        const published = document.getElementById('exam-published').checked;
        const showResults = document.getElementById('exam-show-results').checked;

        if (!title || !trainingId) {
            UIManager.showToast("يرجى ملء الحقول الإلزامية", "error");
            return;
        }

        loader.style.display = 'flex';

        try {
            const examData = {
                title,
                trainingId,
                duration,
                passScore,
                description: desc,
                published,
                showResults,
                teacherId: currentTeacherId,
                updatedAt: serverTimestamp()
            };

            // Dates Logic
            if (startStr) examData.startDate = Timestamp.fromDate(new Date(startStr));
            else examData.startDate = null;

            if (endStr) examData.endDate = Timestamp.fromDate(new Date(endStr));
            else examData.endDate = null;

            if (editMode && examId) {
                await updateDoc(doc(db, "exams", examId), examData);
                window.location.href = `exam-questions.html?id=${examId}`; // Next step
            } else {
                examData.createdAt = serverTimestamp();
                examData.questionsCount = 0;
                examData.totalScore = 0;

                const ref = await addDoc(collection(db, "exams"), examData);
                window.location.href = `exam-questions.html?id=${ref.id}`; // Next step
            }

        } catch (e) {
            console.error(e);
            UIManager.showAlert("خطأ", "حدث خطأ أثناء الحفظ: " + e.message, "error");
            loader.style.display = 'none';
        }
    });

});
