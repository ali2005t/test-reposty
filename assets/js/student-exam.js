import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    doc,
    getDoc,
    getDocs,
    collection,
    setDoc,
    serverTimestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Params
    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('id');

    if (!examId) {
        alert("معرف الامتحان غير موجود");
        window.location.href = 'home.html' + (window.location.hash || '');
        return;
    }

    let currentUser = null;
    let examData = null;
    let questions = [];
    let userAnswers = {}; // { qId: answerVal }
    let currentQIndex = 0;
    let timerInterval = null;
    let timeLeft = 0;

    // Elements
    const titleEl = document.getElementById('exam-title');
    const qContainer = document.getElementById('question-container');
    const timerDisplay = document.getElementById('timer-display');
    const currentQNum = document.getElementById('current-q-num');
    const totalQNum = document.getElementById('total-q-num');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const progressBar = document.getElementById('progress-bar');
    const warningOverlay = document.getElementById('warning-overlay');

    // Prevent Exit Logic
    window.addEventListener('beforeunload', (e) => {
        e.preventDefault();
        e.returnValue = ''; // Standard browser warning
    });

    // Detect Visibility Change (Tab Switch)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            warningOverlay.style.display = 'flex';
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadExam(examId);
        } else {
            window.location.href = 'login.html' + (window.location.hash || '');
        }
    });

    async function loadExam(id) {
        try {
            // 1. Fetch Exam Meta
            const docRef = doc(db, "exams", id);
            const snap = await getDoc(docRef);

            if (!snap.exists()) {
                alert("الامتحان غير موجود");
                window.location.href = 'home.html' + (window.location.hash || '');
                return;
            }
            examData = snap.data();
            titleEl.innerText = examData.title;

            // 2. Fetch Questions
            const qQuery = query(collection(db, "exams", id, "questions"), orderBy("createdAt")); // Or orderBy order if exists
            const qSnap = await getDocs(qQuery);

            questions = [];
            qSnap.forEach(d => {
                questions.push({ id: d.id, ...d.data() });
            });

            if (examData.randomize) {
                questions.sort(() => Math.random() - 0.5);
            }

            if (questions.length === 0) {
                qContainer.innerHTML = '<p class="text-center">لا توجد أسئلة في هذا الامتحان</p>';
                return;
            }

            totalQNum.innerText = questions.length;

            // 3. Start Timer (examData.duration in minutes)
            const duration = parseFloat(examData.duration);
            if (duration && duration > 0) {
                timeLeft = Math.round(duration * 60);
                startTimer();
            } else {
                timerDisplay.innerText = "∞";
            }

            // 4. Render First Question
            renderQuestion(0);

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء تحميل الامتحان");
        }
    }

    function startTimer() {
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                submitExam(true); // Auto submit
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerDisplay.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        if (timeLeft < 60) {
            timerDisplay.parentElement.style.background = '#fecaca';
            timerDisplay.parentElement.style.color = 'red';
            timerDisplay.parentElement.classList.add('pulse'); // If css exists
        }
    }

    function renderQuestion(index) {
        currentQIndex = index;
        const q = questions[index];
        currentQNum.innerText = index + 1;

        // Progress
        const percent = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${percent}%`;

        // Render HTML
        let answersHtml = '';

        if (q.type === 'mcq' || q.type === 'true_false') {
            const opts = q.options || [];
            answersHtml = `<div class="options-list">`;
            opts.forEach((opt, i) => {
                const isSelected = userAnswers[q.id] === opt;
                answersHtml += `
                    <div class="option-item ${isSelected ? 'selected' : ''}" onclick="selectOption('${q.id}', '${opt}', this)">
                        <input type="radio" name="q_${q.id}" class="option-radio" ${isSelected ? 'checked' : ''}>
                        <span>${opt}</span>
                    </div>
                `;
            });
            answersHtml += `</div>`;
        } else if (q.type === 'text') {
            const val = userAnswers[q.id] || '';
            answersHtml = `
                <textarea class="form-input" rows="5" placeholder="اكتب إجابتك هنا..." oninput="saveTextAnswer('${q.id}', this.value)">${val}</textarea>
            `;
        }

        qContainer.innerHTML = `
            <div class="question-card">
                <div class="question-text">${q.text}</div>
                ${q.imageUrl ? `<img src="${q.imageUrl}" style="max-width:100%; border-radius:10px; margin-bottom:15px;">` : ''}
                ${answersHtml}
            </div>
        `;

        // Buttons
        prevBtn.disabled = (index === 0);
        if (index === questions.length - 1) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'flex';
        } else {
            nextBtn.style.display = 'flex';
            submitBtn.style.display = 'none';
        }
    }

    // Global Functions for Interaction
    window.selectOption = (qId, val, el) => {
        userAnswers[qId] = val;
        // Visual
        const all = el.parentElement.querySelectorAll('.option-item');
        all.forEach(x => {
            x.classList.remove('selected');
            x.querySelector('input').checked = false;
        });
        el.classList.add('selected');
        el.querySelector('input').checked = true;
    };

    window.saveTextAnswer = (qId, val) => {
        userAnswers[qId] = val;
    };

    // Navigation
    nextBtn.onclick = () => {
        if (currentQIndex < questions.length - 1) {
            renderQuestion(currentQIndex + 1);
        }
    };

    prevBtn.onclick = () => {
        if (currentQIndex > 0) {
            renderQuestion(currentQIndex - 1);
        }
    };

    submitBtn.onclick = async () => {
        if (confirm("هل أنت متأكد من إنهاء الامتحان؟")) {
            await submitExam(false);
        }
    };

    async function submitExam(auto = false) {
        clearInterval(timerInterval);

        // Disable interaction
        document.body.style.pointerEvents = 'none';
        const btn = document.getElementById('submit-btn');
        if (btn) btn.innerText = "جاري التسليم...";

        // Scoring
        let score = 0;
        let totalPoints = 0;
        let details = [];
        let hasManualQuestions = false;

        questions.forEach(q => {
            let isCorrect = false; // Default for manual
            let userAnswer = userAnswers[q.id] || null;
            let questionPoints = parseFloat(q.points) || 1;
            totalPoints += questionPoints;

            if (q.type === 'mcq' || q.type === 'true_false') {
                if (userAnswer === q.correctAnswer) {
                    score += questionPoints;
                    isCorrect = true;
                }
            } else if (q.type === 'text') {
                hasManualQuestions = true;
                // Score remains 0 for now until teacher grades
            }

            details.push({
                questionId: q.id,
                questionText: q.text,
                questionType: q.type,
                userAnswer: userAnswer,
                correctAnswer: q.correctAnswer || null,
                isCorrect: (q.type === 'text') ? null : isCorrect, // Null for manual
                points: (q.type === 'text') ? 0 : (isCorrect ? questionPoints : 0),
                maxPoints: questionPoints
            });
        });

        const percent = Math.round((score / totalPoints) * 100);
        const status = hasManualQuestions ? 'pending_review' : 'graded';

        try {
            await setDoc(doc(db, "exam_submissions", `${currentUser.uid}_${examId}`), {
                studentId: currentUser.uid,
                studentName: currentUser.displayName || 'طالب',
                examId: examId,
                examTitle: examData.title || 'امتحان',
                answers: userAnswers,
                score: score, // Current score (MCQ only)
                totalPoints: totalPoints,
                percentage: percent, // Tentative percentage
                submittedAt: serverTimestamp(),
                details: details,
                autoSubmitted: auto,
                status: status,
                hasManualQuestions: hasManualQuestions
            });

            // Redirect to Result or Home
            if (hasManualQuestions) {
                alert(`تم تسليم الإجابات بنجاح! \nسيقوم المعلم بتصحيح الأسئلة المقالية وإعلامك بالنتيجة النهائية.`);
            } else {
                // Motivational Message Logic
                let msg = "";
                if (percent >= 90) msg = "ممتاز! 🌟";
                else if (percent >= 75) msg = "جيد جداً! 👍";
                else if (percent >= 50) msg = "أحسنت، ولكن تحتاج للمزيد من المذاكرة. 💪";
                else msg = "للأسف، حظاً أوفر في المرة القادمة. 📚";

                alert(`تم انتهاء الامتحان!\nنتيجتك: ${score} من ${totalPoints} (${percent}%)\n${msg}`);
            }
            window.location.href = 'home.html' + (window.location.hash || '');

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء التسليم. حاول مرة أخرى.");
            document.body.style.pointerEvents = 'auto';
        }
    }

});
