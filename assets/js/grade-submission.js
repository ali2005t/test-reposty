import { db } from './firebase-config.js';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const subId = params.get('subId');

const container = document.getElementById('questions-container');
const totalScoreDisplay = document.getElementById('total-score-display');
const saveBtn = document.getElementById('save-grades-btn');

let submissionData = null;
let examData = null;
let questions = [];

// Initialize
if (!subId) {
    alert("رقم عملية التسليم غير موجود");
    window.close();
} else {
    loadData();
}

async function loadData() {
    try {
        // 1. Fetch Submission
        const subSnap = await getDoc(doc(db, "exam_submissions", subId));
        if (!subSnap.exists()) throw new Error("التسليم غير موجود");
        submissionData = subSnap.data();

        // Header Info
        document.getElementById('student-name-header').innerText = submissionData.studentName;

        // 2. Fetch Exam
        const examSnap = await getDoc(doc(db, "exams", submissionData.examId));
        if (!examSnap.exists()) throw new Error("الامتحان الأصلي محذوف");
        examData = examSnap.data();

        document.getElementById('exam-title-header').innerText = examData.title;
        questions = examData.questions || [];

        renderGrading();

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="color:red; text-align:center;">خطأ: ${e.message}</div>`;
    }
}

function renderGrading() {
    container.innerHTML = '';
    let runningTotal = 0;

    questions.forEach((q, idx) => {
        const studentAns = submissionData.answers ? submissionData.answers[q.id] : undefined; // Fix: use 'answers' map from submission
        const maxPoints = parseFloat(q.points) || 1;

        let currentScore = 0;

        // Check if previously graded (Manual override or Auto)
        if (submissionData.scores && submissionData.scores[q.id] !== undefined) {
            currentScore = submissionData.scores[q.id];
        } else {
            // Default Auto Calculation
            if (q.type !== 'text') {
                if (studentAns === q.correctAnswer) currentScore = maxPoints;
            }
        }

        runningTotal += parseFloat(currentScore);

        const card = document.createElement('div');
        card.className = 'question-grade-card';
        // Highlight if manual attention needed
        if (q.type === 'text' && !submissionData.scores) {
            card.style.border = "2px solid #fbbf24";
        }

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span style="font-weight:bold; color:#64748b;">سؤال ${idx + 1} (${q.type === 'text' ? 'مقال' : 'اختياري'})</span>
                <span style="font-size:0.9rem;">الدرجة القصوى: ${maxPoints}</span>
            </div>
            <div class="q-text">${q.text}</div>
            
            <div style="margin:15px 0;">
                <div style="font-size:0.9rem; margin-bottom:5px;">إجابة الطالب:</div>
                <div class="student-ans">${studentAns !== undefined ? studentAns : '<span style="color:red;">لم يجب</span>'}</div>
                
                ${q.type !== 'text' ? `
                    <div style="font-size:0.9rem; margin-bottom:5px; margin-top:10px;">الإجابة الصحيحة:</div>
                    <div class="correct-ans">${q.correctAnswer}</div>
                ` : ''}
            </div>

            <div style="display:flex; align-items:center; justify-content:flex-end; gap:10px; border-top:1px solid #f1f5f9; padding-top:15px;">
                <label>الدرجة المستحقة:</label>
                <input type="number" class="grade-input" 
                    data-qid="${q.id}" 
                    max="${maxPoints}" 
                    min="0" 
                    step="0.5"
                    value="${currentScore}" 
                    onchange="updateTotalDisplay()">
            </div>
        `;
        container.appendChild(card);
    });

    totalScoreDisplay.innerText = runningTotal;
}

window.updateTotalDisplay = function () {
    let total = 0;
    document.querySelectorAll('.grade-input').forEach(inp => {
        total += parseFloat(inp.value) || 0;
    });
    totalScoreDisplay.innerText = total;
}

saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.innerText = "جاري الحفظ...";

    try {
        const scoresMap = {};
        let finalTotal = 0;

        document.querySelectorAll('.grade-input').forEach(inp => {
            const qId = inp.dataset.qid;
            const val = parseFloat(inp.value) || 0;
            scoresMap[qId] = val;
            finalTotal += val;
        });

        // Calculate total possible points from questions
        const totalPossible = questions.reduce((acc, q) => acc + (parseFloat(q.points) || 1), 0);
        const percentage = Math.round((finalTotal / totalPossible) * 100);

        await updateDoc(doc(db, "exam_submissions", subId), {
            scores: scoresMap,
            score: finalTotal, // Update main score
            totalScore: finalTotal, // Legacy field if used elsewhere
            percentage: percentage,
            status: 'graded', // Standard status
            pendingGrading: false, // For backward compatibility
            gradedAt: serverTimestamp()
        });

        alert("تم حفظ التصحيح بنجاح");

        // Try to refresh parent if opener exists
        if (window.opener && !window.opener.closed) {
            window.opener.location.reload();
        }
        window.close();

    } catch (e) {
        console.error(e);
        alert("حدث خطأ أثناء الحفظ");
        saveBtn.disabled = false;
        saveBtn.innerText = "حفظ التصحيح";
    }
};
