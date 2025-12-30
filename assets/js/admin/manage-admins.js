import { auth, db, app } from '../firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Secondary Auth for creating users without logging out ---
// We re-use the config from the main app but create a new instance
import { firebaseConfig } from '../firebase-config.js';

let secondaryApp;
let secondaryAuth;

try {
    secondaryApp = initializeApp(firebaseConfig, "Secondary");
    secondaryAuth = getAuth(secondaryApp);
} catch (e) {
    // If already exists
    console.log("Secondary app already initialized");
}

document.addEventListener('DOMContentLoaded', async () => {
    loadAdmins();

    // Form Submit
    document.getElementById('admin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'جاري الحفظ...';

        try {
            const id = document.getElementById('edit-admin-id').value;
            const name = document.getElementById('admin-name').value;
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;

            // Collect Permissions
            const permissions = [];
            document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => {
                if (cb.checked) permissions.push(cb.value);
            });

            if (id) {
                // Edit Mode
                await updateDoc(doc(db, "admins", id), {
                    name,
                    // email: email, // Email change requires Auth update, complex for MVP, skip or warn
                    permissions,
                    updatedAt: serverTimestamp()
                });
                alert("تم تحديث بيانات المساعد بنجاح");
            } else {
                // Create Mode
                if (!password) throw new Error("كلمة المرور مطلوبة للحساب الجديد");

                // 1. Create Auth User (Secondary App)
                const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
                const uid = userCredential.user.uid;

                // Sign out the secondary user immediately so it doesn't interfere (though secondary instance isolates state usually)
                await signOut(secondaryAuth);

                // 2. Create Firestore Doc
                await setDoc(doc(db, "admins", uid), {
                    name,
                    email,
                    role: 'support_agent', // Default role
                    permissions,
                    createdAt: serverTimestamp(),
                    createdBy: auth.currentUser.uid
                });

                alert("تم إنشاء حساب المساعد بنجاح! 🚀");
            }

            document.getElementById('admin-modal').style.display = 'none';
            loadAdmins();

        } catch (error) {
            console.error(error);
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = "البريد الإلكتروني مستخدم بالفعل";
            alert("خطأ: " + msg);
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    });

});

async function loadAdmins() {
    const tbody = document.getElementById('admins-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا يوجد مساعدين حالياً</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            const isMe = auth.currentUser && auth.currentUser.uid === docSnap.id;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold;">${data.name} ${isMe ? '(أنت)' : ''}</td>
                <td>${data.email}</td>
                <td><span class="badge" style="background:${data.role === 'super_admin' ? '#f59e0b' : '#6366f1'}; color:white; padding:2px 8px; border-radius:4px;">${data.role === 'super_admin' ? 'مشرف عام' : 'مساعد'}</span></td>
                <td>${data.assignedTeachers ? data.assignedTeachers.length : 'الكل'}</td>
                <td><span class="status-badge" style="background:#dcfce7; color:#166534;">نشط</span></td>
                <td>
                    ${!isMe ? `
                    <button class="btn-icon edit-btn" style="color:#3b82f6;"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon delete-btn" style="color:#ef4444;"><i class="fas fa-trash"></i></button>
                    ` : '<span style="color:#94a3b8; font-size:0.8rem;">لا يمكن تعديل نفسك من هنا</span>'}
                </td>
            `;

            if (!isMe) {
                const editBtn = tr.querySelector('.edit-btn');
                editBtn.onclick = () => openEditModal(docSnap.id, data);

                const deleteBtn = tr.querySelector('.delete-btn');
                deleteBtn.onclick = () => deleteAdmin(docSnap.id, data.name);
            }

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">خطأ: ${e.message}</td></tr>`;
    }
}

function openEditModal(id, data) {
    document.getElementById('modal-title').innerText = 'تعديل بيانات المساعد';
    document.getElementById('edit-admin-id').value = id;
    document.getElementById('admin-name').value = data.name;
    document.getElementById('admin-email').value = data.email;
    document.getElementById('admin-password').value = ''; // Don't show password

    // Check Permissions
    document.querySelectorAll('.permission-item input[type="checkbox"]').forEach(cb => {
        cb.checked = data.permissions && data.permissions.includes(cb.value);
    });

    document.getElementById('admin-modal').style.display = 'flex';
}

async function deleteAdmin(id, name) {
    if (confirm(`هل أنت متأكد من حذف المساعد "${name}"؟\nلا يمكن التراجع عن هذا الإجراء.`)) {
        try {
            await deleteDoc(doc(db, "admins", id));
            // Note: Auth user deletion usually requires backend admin SDK. 
            // We only delete the Doc mostly. Disabling functionality relies on the doc check.
            alert("تم حذف الحساب بنجاح");
            loadAdmins();
        } catch (e) {
            alert("خطأ: " + e.message);
        }
    }
}
