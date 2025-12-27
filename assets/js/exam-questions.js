import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    doc,
    getDoc,
    collection,
    query,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy,
    increment,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('id');

    if (!examId) {
        alert("رابط غير صحيح");
        window.location.href = 'exams.html';
        return;
    }

    let quill;
    let questionsList = [];

    // Elements
    const modal = document.getElementById('question-modal');
    const openBtn = document.getElementById('open-add-modal');
    const closeBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const questionsContainer = document.getElementById('questions-list');
    const loadingEl = document.getElementById('loading-indicator');
    const emptyEl = document.getElementById('empty-state');
    const typeSelect = document.getElementById('question-type');
    const optionsContainer = document.getElementById('options-container');
    const optionsListEditor = document.getElementById('options-list-editor');
    const addOptionBtn = document.getElementById('btn-add-option');

    // Init Quill
    quill = new Quill('#question-editor', {
        theme: 'snow',
        modules: {
            toolbar: [['bold', 'italic', 'underline'], [{ 'header': 1 }, { 'header': 2 }], ['clean']]
        },
        placeholder: 'اكتب نص السؤال هنا...'
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await getEffectiveUserUid(user); // Triggers banner if impersonating
            await loadExamInfo();
            await loadQuestions();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadExamInfo() {
        const d = await getDoc(doc(db, "exams", examId));
        if (d.exists()) {
            document.getElementById('exam-title-header').innerText = `أسئلة: ${d.data().title}`;
            updateStatsObj(d.data());
        }
    }

    function updateStatsObj(data) {
        document.getElementById('exam-stats').innerText = `${data.questionsCount || 0} سؤال | المجموع: ${data.totalScore || 0} درجة`;
    }

    async function loadQuestions() {
        loadingEl.style.display = 'block';
        questionsContainer.innerHTML = '';

        try {
            const q = query(collection(db, `exams/${examId}/questions`), orderBy("createdAt", "asc"));
            const snapshot = await getDocs(q);

            questionsList = [];
            snapshot.forEach(d => questionsList.push({ id: d.id, ...d.data() }));

            loadingEl.style.display = 'none';
            if (questionsList.length === 0) {
                emptyEl.style.display = 'block';
            } else {
                emptyEl.style.display = 'none';
                questionsList.forEach(renderQuestion);
            }
        } catch (e) {
            console.error(e);
            loadingEl.innerText = "خطأ في التحميل";
        }
    }

    function renderQuestion(q) {
        const card = document.createElement('div');
        card.className = 'question-card';

        let typeLabel = q.type === 'mcq' ? 'اختيار من متعدد' : (q.type === 'text' ? 'مقال' : 'صح أم خطأ');
        let optionsHtml = '';

        if (q.type !== 'text' && q.options) {
            optionsHtml = `<ul class="options-list">
                ${q.options.map((opt, idx) => `
                    <li class="option-item ${idx === q.correctIndex ? 'correct' : ''}">
                        ${idx === q.correctIndex ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>'}
                        ${opt}
                    </li>
                `).join('')}
            </ul>`;
        }

        card.innerHTML = `
            <div class="question-header">
                <div>
                    <div class="question-text">${q.text}</div> <!-- HTML Supported -->
                    <div class="question-meta badge badge-purple">${typeLabel} | ${q.grade} درجة</div>
                </div>
                <div class="action-dropdown" style="position:relative;">
                    <button class="btn-icon-menu" onclick="event.stopPropagation(); this.nextElementSibling.classList.toggle('show');"><i class="fas fa-ellipsis-v"></i></button>
                    <div class="dropdown-menu" style="left:0; right:auto;">
                        <button class="dropdown-item delete-btn" style="color:red;"><i class="fas fa-trash"></i> حذف</button>
                    </div>
                </div>
            </div>
            ${optionsHtml}
        `;

        // Delete Handler
        card.querySelector('.delete-btn').onclick = () => deleteQuestion(q.id, q.grade);

        questionsContainer.appendChild(card);
    }

    // Modal Handlers
    openBtn.onclick = () => {
        document.getElementById('question-form').reset();
        document.getElementById('edit-question-id').value = '';
        quill.setText('');
        typeSelect.value = 'mcq';
        handleTypeChange();
        renderOptionInputs(['', '', '', ''], 0); // Default 4 options
        modal.style.display = 'flex';
    };

    closeBtns.forEach(btn => btn.onclick = () => modal.style.display = 'none');

    typeSelect.onchange = handleTypeChange;

    function handleTypeChange() {
        const type = typeSelect.value;
        if (type === 'text') {
            optionsContainer.style.display = 'none';
        } else if (type === 'true_false') {
            optionsContainer.style.display = 'block';
            addOptionBtn.style.display = 'none';
            renderOptionInputs(['صح', 'خطأ'], 0);
        } else {
            // MCQ
            optionsContainer.style.display = 'block';
            addOptionBtn.style.display = 'block';

            // Heuristic check: If we have exactly 2 options 'صح' & 'خطأ', assume it was T/F and reset to MCQ defaults
            const currentInputs = Array.from(optionsListEditor.querySelectorAll('input[type="text"]'));
            const values = currentInputs.map(i => i.value);

            if (values.length === 2 && values[0] === 'صح' && values[1] === 'خطأ') {
                renderOptionInputs(['', '', '', ''], -1);
            } else if (values.length === 0) {
                renderOptionInputs(['', '', '', ''], -1);
            }
        }
    }

    function renderOptionInputs(values = [], correctIndices = 0) {
        optionsListEditor.innerHTML = '';
        values.forEach((val, idx) => addOptionInput(val, idx === correctIndices));
    }

    function addOptionInput(val = '', isCorrect = false) {
        const div = document.createElement('div');
        div.className = 'option-item';
        div.style.gap = '10px';

        // Radio for Correct Answer
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'correctOption';
        radio.required = true;
        if (isCorrect) radio.checked = true;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-input';
        input.value = val;
        input.placeholder = 'نص الخيار';
        input.style.border = 'none';
        input.style.background = 'transparent';
        input.style.flex = '1';
        input.required = true;

        const removeBtn = document.createElement('i');
        removeBtn.className = 'fas fa-times';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.color = 'red';
        removeBtn.onclick = () => {
            if (optionsListEditor.children.length > 2) div.remove();
        };

        div.appendChild(radio);
        div.appendChild(input);
        if (typeSelect.value === 'mcq') div.appendChild(removeBtn);

        optionsListEditor.appendChild(div);
    }

    addOptionBtn.onclick = () => addOptionInput();

    // Submit
    document.getElementById('question-form').onsubmit = async (e) => {
        e.preventDefault();

        const type = typeSelect.value;
        const text = quill.root.innerHTML; // Allow Rich Text
        const grade = parseInt(document.getElementById('question-grade').value) || 1;

        // Gather Options
        let options = [];
        let correctIndex = -1;

        if (type !== 'text') {
            const optDivs = optionsListEditor.querySelectorAll('.option-item');
            optDivs.forEach((div, idx) => {
                const val = div.querySelector('input[type="text"]').value.trim();
                const radio = div.querySelector('input[type="radio"]');
                if (val) options.push(val);
                if (radio.checked) correctIndex = idx;
            });

            if (correctIndex === -1) {
                alert("يرجى تحديد الإجابة الصحيحة");
                return;
            }
        }

        const data = {
            text,
            type,
            grade,
            options: type === 'text' ? [] : options,
            correctIndex,
            createdAt: serverTimestamp()
        };

        try {
            const batch = writeBatch(db);
            const qRef = doc(collection(db, `exams/${examId}/questions`));
            batch.set(qRef, data);

            // Update Exam Totals
            const examRef = doc(db, "exams", examId);
            batch.update(examRef, {
                questionsCount: increment(1),
                totalScore: increment(grade)
            });

            await batch.commit();

            modal.style.display = 'none';
            loadQuestions(); // Reload
            loadExamInfo(); // Update stats

        } catch (err) {
            console.error(err);
            alert("فشل الحفظ");
        }
    };

    async function deleteQuestion(qId, qGrade) {
        if (!confirm("هل أنت متأكد من الحذف؟")) return;
        try {
            const batch = writeBatch(db);
            const qRef = doc(db, `exams/${examId}/questions/${qId}`);
            batch.delete(qRef);

            const examRef = doc(db, "exams", examId);
            batch.update(examRef, {
                questionsCount: increment(-1),
                totalScore: increment(-qGrade)
            });

            await batch.commit();
            loadQuestions();
            loadExamInfo();
        } catch (e) { console.error(e); }
    }

});
