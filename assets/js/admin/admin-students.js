import { db, auth } from '../firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    setDoc,
    serverTimestamp,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loadData();
    } else {
        window.location.href = 'login.html';
    }
});

let allStudents = [];

async function loadData() {
    try {
        // 1. Fetch Teachers for Mapping
        const teacherSnap = await getDocs(collection(db, "teachers"));
        const teacherMap = {};
        const teacherSelect = document.getElementById('teacher-filter');

        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="all">كل المعلمين</option>';
            teacherSnap.forEach(t => {
                const d = t.data();
                teacherMap[t.id] = d.name;
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.innerText = d.name;
                teacherSelect.appendChild(opt);
            });
        }

        // 2. Fetch Students
        const snapVal = await getDocs(collection(db, "students"));
        const tbody = document.getElementById('students-list');

        allStudents = [];
        snapVal.forEach(d => {
            const s = d.data();
            // Filter only students
            if (s.role === 'teacher' || s.role === 'admin') return;

            s.id = d.id;
            // Resolve Teacher Name
            if (s.currentPlatform && teacherMap[s.currentPlatform]) {
                s.teacherName = teacherMap[s.currentPlatform];
            } else if (s.enrolledTeachers && s.enrolledTeachers.length > 0) {
                const tName = teacherMap[s.enrolledTeachers[0]];
                s.teacherName = tName || 'غير معروف';
                if (s.enrolledTeachers.length > 1) s.teacherName += ` (+${s.enrolledTeachers.length - 1})`;
            } else {
                s.teacherName = '-';
            }
            allStudents.push(s);
        });

        renderStudents();

    } catch (e) {
        console.error(e);
        const tbody = document.getElementById('students-list');
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">خطأ في التحميل</td></tr>';
    }
}

function renderStudents() {
    const tbody = document.getElementById('students-list');
    if (!tbody) return;

    const search = document.getElementById('search-input')?.value.toLowerCase() || '';
    const teacherId = document.getElementById('teacher-filter')?.value || 'all';

    tbody.innerHTML = '';

    const filtered = allStudents.filter(s => {
        const name = s.name || s.fullName || '';
        const phone = s.phone || '';
        const email = s.email || '';

        const searchMatch = name.toLowerCase().includes(search) ||
            phone.includes(search) ||
            email.toLowerCase().includes(search);

        const teacherMatch = teacherId === 'all' ||
            s.currentPlatform === teacherId ||
            (s.enrolledTeachers && s.enrolledTeachers.includes(teacherId));

        return searchMatch && teacherMatch;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد نتائج</td></tr>';
        return;
    }

    filtered.forEach(s => {
        const row = document.createElement('tr');
        const dateStr = s.createdAt ? new Date(s.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '-';

        row.innerHTML = `
            <td style="font-weight:bold;">${s.name || s.fullName || 'بدون اسم'}</td>
            <td>${s.email}</td>
            <td>${s.phone || '-'}</td>
            <td>${s.teacherName}</td>
            <td>${dateStr}</td>
            <td style="overflow:visible;">${getActionMenu(s)}</td>
        `;
        tbody.appendChild(row);
    });
}

function getActionMenu(student) {
    const banText = student.isBanned ? 'إلغاء الحظر' : 'حظر الطالب';
    const banColor = student.isBanned ? '#10b981' : '#ef4444';
    const banIcon = student.isBanned ? 'fa-check-circle' : 'fa-ban';

    return `
        <div class="action-dropdown" style="position:relative;">
            <button class="btn-icon" onclick="toggleDropdown('${student.id}')" style="background:none; border:none; color:white; cursor:pointer; font-size:1.1rem;">
                <i class="fas fa-ellipsis-v"></i>
            </button>
            <div id="dropdown-${student.id}" class="dropdown-menu" style="display:none; position:absolute; left:0; top:100%; background:#1e293b; border:1px solid #334155; z-index:100; min-width:180px; border-radius:6px; overflow:hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);">
                <button onclick="openGrantModal('${student.id}')" style="display:block; width:100%; text-align:right; padding:10px 12px; background:none; border:none; color:#cbd5e1; cursor:pointer; border-bottom:1px solid #334155; transition:background 0.2s; font-family:inherit;">
                    <i class="fas fa-key" style="margin-left:8px; color:#3b82f6; width:15px; text-align:center;"></i> منح صلاحية
                </button>
                <button onclick="resetDevice('${student.id}')" style="display:block; width:100%; text-align:right; padding:10px 12px; background:none; border:none; color:#cbd5e1; cursor:pointer; border-bottom:1px solid #334155; transition:background 0.2s; font-family:inherit;">
                    <i class="fas fa-mobile-alt" style="margin-left:8px; color:#f59e0b; width:15px; text-align:center;"></i> إعادة ضبط الجهاز
                </button>
                <button onclick="toggleBan('${student.id}', ${student.isBanned || false})" style="display:block; width:100%; text-align:right; padding:10px 12px; background:none; border:none; color:${banColor}; cursor:pointer; transition:background 0.2s; font-family:inherit;">
                    <i class="fas ${banIcon}" style="margin-left:8px; width:15px; text-align:center;"></i> ${banText}
                </button>
            </div>
        </div>
    `;
}

// Global Exports for HTML inline calls
window.toggleDropdown = (id) => {
    document.querySelectorAll('.dropdown-menu').forEach(d => {
        if (d.id !== `dropdown-${id}`) d.style.display = 'none';
    });
    const d = document.getElementById(`dropdown-${id}`);
    if (d) d.style.display = d.style.display === 'block' ? 'none' : 'block';
};

window.addEventListener('click', (e) => {
    if (!e.target.closest('.action-dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(d => d.style.display = 'none');
    }
});

window.toggleBan = async (uid, currentStatus) => {
    const action = currentStatus ? "إلغاء حظر" : "حظر";
    // Check if UIManager is available globally
    const uim = window.UIManager || UIManager;

    if (uim) {
        const confirmed = await uim.showConfirm(
            action + ' طالب',
            `هل أنت متأكد من ${action} هذا الطالب؟`,
            action,
            'إلغاء'
        );
        if (!confirmed) return;
    } else {
        if (!confirm(`هل أنت متأكد من ${action} هذا الطالب؟`)) return;
    }

    try {
        await updateDoc(doc(db, "students", uid), { isBanned: !currentStatus });
        if (uim) uim.showToast(`تم ${action} الطالب بنجاح`);
        loadData();
    } catch (e) {
        console.error(e);
        if (uim) uim.showToast("حدث خطأ", "error");
    }
};

window.resetDevice = async (uid) => {
    const uim = window.UIManager || UIManager;
    if (uim) {
        const confirmed = await uim.showConfirm(
            'إعادة ضبط الجهاز',
            "هل أنت متأكد من إعادة تعيين الجهاز لهذا الطالب؟",
            'نعم، أعد التعيين',
            'إلغاء'
        );
        if (!confirmed) return;
    } else if (!confirm("إعادة ضبط الجهاز؟")) return;

    try {
        await updateDoc(doc(db, "students", uid), { deviceId: null });
        if (uim) uim.showToast("تم إعادة تعيين الجهاز");
    } catch (e) {
        console.error(e);
        if (uim) uim.showToast("حدث خطأ", "error");
    }
};

// --- Grant Modal Logic ---
const grantModal = document.getElementById('grantAccessModal');
const teacherSelect = document.getElementById('grant-teacher-select');
const programSelect = document.getElementById('grant-program-select');
let currentGrantStudent = null;

// Ensure elements exist before adding listeners
if (document.querySelector('.close-grant-modal')) {
    document.querySelector('.close-grant-modal').addEventListener('click', () => {
        grantModal.style.display = 'none';
    });
}
window.onclick = function (event) {
    if (event.target == grantModal) {
        grantModal.style.display = "none";
    }
};

window.openGrantModal = (uid) => {
    const student = allStudents.find(s => s.id === uid);
    if (!student) return;

    currentGrantStudent = student;
    const infoDiv = document.getElementById('grant-student-info');
    if (infoDiv) {
        infoDiv.innerHTML = `
            <strong>الطالب:</strong> ${student.name || 'بدون اسم'}<br>
            <strong>البريد:</strong> ${student.email}
        `;
    }

    populateGrantTeachers();
    grantModal.style.display = 'block';
};

async function populateGrantTeachers() {
    if (!teacherSelect) return;
    teacherSelect.innerHTML = '<option value="">جاري التحميل...</option>';
    try {
        const snap = await getDocs(collection(db, "teachers"));
        teacherSelect.innerHTML = '<option value="">اختر المعلم...</option>';
        snap.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = t.data().name;
            teacherSelect.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
        teacherSelect.innerHTML = '<option value="">خطأ في التحميل</option>';
    }
}

if (teacherSelect) {
    teacherSelect.addEventListener('change', async (e) => {
        const tid = e.target.value;
        const programSelect = document.getElementById('grant-program-select');
        if (!programSelect) return;

        programSelect.innerHTML = '<option value="">جاري التحميل...</option>';
        programSelect.disabled = true;

        if (!tid) return;

        try {
            const q = query(collection(db, "training_programs"), where("teacherId", "==", tid));
            const snap = await getDocs(q);

            programSelect.innerHTML = '<option value="">اختر البرنامج...</option>';
            snap.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.innerText = p.data().title;
                programSelect.appendChild(opt);
            });
            programSelect.disabled = false;
        } catch (e) {
            console.error(e);
            programSelect.innerHTML = '<option value="">خطأ</option>';
        }
    });
}

const grantForm = document.getElementById('grant-access-form');
if (grantForm) {
    grantForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const teacherSelect = document.getElementById('grant-teacher-select');
        const programSelect = document.getElementById('grant-program-select');

        const tid = teacherSelect.value;
        const pid = programSelect.value;
        const uim = window.UIManager || UIManager;

        if (!tid || !pid || !currentGrantStudent) return;

        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = 'جاري التنفيذ...';

        try {
            const enrollRef = doc(db, "enrollments", `${currentGrantStudent.id}_${pid}`);

            // Log action for verification
            console.log(`Granting full access: Student ${currentGrantStudent.email} -> Program ${pid}`);

            await setDoc(enrollRef, {
                studentId: currentGrantStudent.id,
                trainingId: pid,
                type: 'full',
                accessType: 'full',
                unlockedUnits: [],
                unlockedLectures: [],
                grantedBy: auth.currentUser ? auth.currentUser.uid : 'admin_override',
                grantedAt: serverTimestamp()
            }, { merge: true });

            if (uim) uim.showToast("تم منح الصلاحية الكاملة بنجاح");
            grantModal.style.display = 'none';

        } catch (e) {
            console.error(e);
            if (uim) uim.showToast("حدث خطأ أثناء المنح: " + e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerText = 'منح الصلاحية';
        }
    });
}

document.getElementById('search-input')?.addEventListener('keyup', renderStudents);
document.getElementById('teacher-filter')?.addEventListener('change', renderStudents);
