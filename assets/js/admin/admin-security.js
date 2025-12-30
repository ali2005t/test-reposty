import { auth, db, firebaseConfig } from '../firebase-config.js';
import { initAdminUI } from './admin-ui.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs, doc, setDoc, deleteDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let allTeachers = {}; // ID -> Name

    // Load Teachers for Dropdowns
    async function loadTeachers() {
        try {
            const snap = await getDocs(collection(db, "teachers"));
            snap.forEach(d => {
                allTeachers[d.id] = d.data().name;
            });
            populateTeacherSelects();
        } catch (e) {
            console.error("Failed to load teachers", e);
        }
    }

    function populateTeacherSelects() {
        const select = document.getElementById('new-admin-teacher');
        if (!select) return;
        select.innerHTML = '<option value="">اختر المعلم...</option>';
        for (const [id, name] of Object.entries(allTeachers)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.innerText = name;
            select.appendChild(opt);
        }
    }

    // Toggle Teacher Select Visibility
    document.getElementById('new-admin-role')?.addEventListener('change', (e) => {
        const teacherDiv = document.getElementById('teacher-select-group');
        if (teacherDiv) {
            teacherDiv.style.display = e.target.value === 'teacher_assistant' ? 'block' : 'none';
        }
    });

    // Auth Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            initAdminUI('الأمان والصلاحيات');
            await loadTeachers(); // Load teachers first
            loadAdmins();
            loadLogs();
        } else {
            window.location.href = '../admin/login.html';
        }
    });

    // --- Manage Admins ---
    async function loadAdmins() {
        const list = document.getElementById('admins-list');
        list.innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري التحميل...</td></tr>';

        try {
            const q = query(collection(db, "admins"));
            const querySnapshot = await getDocs(q);

            list.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const safeName = data.name || data.email.split('@')[0]; // Fix for undefined name
                const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '-';

                let roleBadge = '<span class="badge badge-admin">Admin</span>';
                if (data.role === 'super_admin') roleBadge = '<span class="badge badge-super">Super Admin</span>';
                if (data.role === 'teacher_assistant') {
                    const tName = data.linkedTeacherName || '(غير محدد)';
                    roleBadge = `<span class="badge" style="background:#8b5cf6; color:white;">مساعد: ${tName}</span>`;
                }

                // Status Badge
                const isBlocked = data.isBlocked === true;
                const statusBadge = isBlocked
                    ? '<span class="badge" style="background:#ef4444; color:white; margin-right:5px;">محظور</span>'
                    : '';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight:bold;">${safeName}</div>
                        ${statusBadge}
                    </td>
                    <td>${data.email}</td>
                    <td>${roleBadge}</td>
                    <td>${date}</td>
                    <td>
                        <div style="display:flex; gap:10px;">
                            <button class="btn-icon" onclick="toggleBlockAdmin('${doc.id}', '${data.email}', ${isBlocked})" title="${isBlocked ? 'رفع الحظر' : 'حظر'}" style="color:${isBlocked ? '#10b981' : '#f59e0b'};">
                                <i class="fas ${isBlocked ? 'fa-check' : 'fa-ban'}"></i>
                            </button>
                            <button class="btn-icon" onclick="changeAdminRole('${doc.id}', '${safeName}')" title="تغيير الدور" style="color:#3b82f6;">
                                <i class="fas fa-user-tag"></i>
                            </button>
                            <button class="btn-icon" onclick="deleteAdmin('${doc.id}', '${data.email}')" style="color:#ef4444;" title="حذف">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                list.appendChild(tr);
            });
        } catch (e) {
            console.error("Error loading admins:", e);
            list.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">خطأ في التحميل</td></tr>';
        }
    }

    // Add Admin Form
    document.getElementById('add-admin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;

        const name = document.getElementById('new-admin-name').value;
        const email = document.getElementById('new-admin-email').value;
        const password = document.getElementById('new-admin-password').value;
        const role = document.getElementById('new-admin-role').value;

        try {
            // 1. Create Auth User (Using Secondary App to avoid logging out current user)
            const secondaryApp = initializeApp(firebaseConfig, "Secondary");
            const secondaryAuth = getAuth(secondaryApp);
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const newUser = userCredential.user;

            // 2. Create Firestore Doc
            await setDoc(doc(db, "admins", newUser.uid), {
                name: name,
                email: email,
                role: role,
                isBlocked: false,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.email
            });

            // 3. Log Action
            await logAction('إنشاء مسؤول', `تم إنشاء مسؤول جديد: ${email} بصلاحية ${role}`);

            // Cleanup
            await signOut(secondaryAuth);

            UIManager.showToast("تم إضافة المسؤول بنجاح");
            document.getElementById('addAdminModal').style.display = 'none';
            e.target.reset();
            loadAdmins();

        } catch (error) {
            console.error("Error creating admin:", error);
            UIManager.showToast("فشل إضافة المسؤول: " + error.message, "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    // --- Global Actions (Attached to window) ---

    // 1. Delete
    window.deleteAdmin = async (uid, email) => {
        const confirmed = await UIManager.showConfirm(
            'حذف مسؤول',
            `هل أنت متأكد من حذف المسؤول ${email}؟ (لن يتم حذف حساب الدخول، فقط الصلاحية)`,
            'نعم، احذف',
            'إلغاء'
        );

        if (!confirmed) return;

        try {
            await deleteDoc(doc(db, "admins", uid));
            await logAction('حذف مسؤول', `تم حذف صلاحية المسؤول: ${email}`);
            UIManager.showToast("تم حذف الصلاحية بنجاح");
            loadAdmins();
        } catch (e) {
            console.error("Error deleting admin:", e);
            UIManager.showToast("حدث خطأ أثناء الحذف", "error");
        }
    };

    // 2. Toggle Block
    window.toggleBlockAdmin = async (uid, email, isCurrentlyBlocked) => {
        const actionName = isCurrentlyBlocked ? "Unblock" : "Block";
        const confirmMsg = isCurrentlyBlocked
            ? `هل تريد رفع الحظر عن ${email}؟`
            : `هل تريد حظر ${email} تماماً من لوحة التحكم؟`;

        const confirmed = await UIManager.showConfirm(
            actionName === 'Block' ? 'حظر مسؤول' : 'رفع الحظر',
            confirmMsg,
            'نعم، نفذ',
            'إلغاء'
        );

        if (!confirmed) return;

        try {
            await setDoc(doc(db, "admins", uid), { isBlocked: !isCurrentlyBlocked }, { merge: true });
            const actionDesc = isCurrentlyBlocked ? "رفع الحظر عن" : "حظر";
            await logAction(`${actionDesc} مسؤول`, `تم ${actionDesc} المسؤول: ${email}`);
            UIManager.showToast(isCurrentlyBlocked ? "تم رفع الحظر" : "تم حظر المسؤول");
            loadAdmins();
        } catch (e) {
            console.error("Error blocking admin:", e);
            UIManager.showToast("حدث خطأ", "error");
        }
    };

    // 3. Change Role
    window.changeAdminRole = async (uid, currentName) => {
        // Step 1: Select Role
        const { value: newRole } = await Swal.fire({
            title: 'تغيير الدور',
            input: 'select',
            inputOptions: {
                'admin': 'Admin',
                'super_admin': 'Super Admin',
                'teacher_assistant': 'مساعد معلم'
            },
            inputPlaceholder: 'اختر الدور الجديد',
            showCancelButton: true,
            confirmButtonText: 'التالي',
            cancelButtonText: 'إلغاء'
        });

        if (!newRole) return;

        let linkedTeacherId = null;
        let linkedTeacherName = null;

        // Step 2: If Teacher Assistant, Select Teacher
        if (newRole === 'teacher_assistant') {
            const { value: teacherId } = await Swal.fire({
                title: 'اختر المعلم',
                input: 'select',
                inputOptions: allTeachers,
                inputPlaceholder: 'اختر المعلم...',
                showCancelButton: true,
                confirmButtonText: 'حفظ',
                inputValidator: (value) => {
                    return !value && 'يجب اختيار معلم!';
                }
            });

            if (!teacherId) return; // Cancelled
            linkedTeacherId = teacherId;
            linkedTeacherName = allTeachers[teacherId];
        }

        try {
            await setDoc(doc(db, "admins", uid), {
                role: newRole,
                linkedTeacherId: linkedTeacherId,
                linkedTeacherName: linkedTeacherName
            }, { merge: true });

            await logAction('Update Role', `Updated role for ${currentName} to ${newRole} ${linkedTeacherName ? 'for ' + linkedTeacherName : ''}`);
            UIManager.showToast("تم تغيير الدور بنجاح");
            loadAdmins();
        } catch (e) {
            console.error("Error updating role:", e);
            UIManager.showToast("فشل تحديث الدور", "error");
        }
    };

    // --- Audit Logs ---
    async function loadLogs() {
        const list = document.getElementById('logs-list');
        try {
            const q = query(collection(db, "audit_logs"), orderBy("timestamp", "desc"), limit(50));
            const querySnapshot = await getDocs(q);

            list.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const date = data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleString('ar-EG') : '-';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${data.adminEmail || 'Unknown'}</td>
                    <td>${data.action}</td>
                    <td style="font-size:0.9rem; color:#94a3b8;">${data.details}</td>
                    <td style="font-size:0.8rem;">${date}</td>
                `;
                list.appendChild(tr);
            });
        } catch (e) {
            console.error("Error loading logs:", e);
        }
    }

    async function logAction(action, details) {
        try {
            const user = auth.currentUser;
            if (!user) return; // safety

            await addDoc(collection(db, "audit_logs"), {
                adminEmail: user.email,
                adminUid: user.uid,
                action: action,
                details: details,
                timestamp: serverTimestamp()
            });
            // Refresh logs immediately if visible
            loadLogs();
        } catch (e) {
            console.error("Failed to log action:", e);
        }
    }

});
