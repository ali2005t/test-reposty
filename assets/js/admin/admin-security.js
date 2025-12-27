import { auth, db, firebaseConfig } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs, doc, setDoc, deleteDoc, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // Auth Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
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
                const date = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '-';
                const roleBadge = data.role === 'super_admin'
                    ? '<span class="badge badge-super">Super Admin</span>'
                    : '<span class="badge badge-admin">Admin</span>';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${data.name}</td>
                    <td>${data.email}</td>
                    <td>${roleBadge}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn-icon" onclick="deleteAdmin('${doc.id}', '${data.email}')" style="color:#ef4444;" title="حذف">
                            <i class="fas fa-trash"></i>
                        </button>
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
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.email
            });

            // 3. Log Action
            await logAction('Create Admin', `Created admin: ${email} with role ${role}`);

            // Cleanup
            await signOut(secondaryAuth);
            // Note: We don't delete secondaryApp explicitly as verify logic is complex, but it's local scope.

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

    window.deleteAdmin = async (uid, email) => {
        const confirmed = await UIManager.showConfirm(
            'حذف مسؤول',
            `هل أنت متأكد من حذف المسؤول ${email}؟ (لن يتم حذف حساب الدخول، فقط الصلاحية)`,
            'نعم، احذف',
            'إلغاء'
        );

        if (!confirmed) return;

        try {
            // We delete the Firestore doc. The Auth user remains but login checks Firestore, so access is revoked.
            await deleteDoc(doc(db, "admins", uid));
            await logAction('Delete Admin', `Deleted admin access for: ${email}`);
            UIManager.showToast("تم حذف الصلاحية بنجاح");
            loadAdmins();
        } catch (e) {
            console.error("Error deleting admin:", e);
            UIManager.showToast("حدث خطأ أثناء الحذف", "error");
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
            await addDoc(collection(db, "audit_logs"), {
                adminEmail: auth.currentUser.email,
                adminUid: auth.currentUser.uid,
                action: action,
                details: details,
                timestamp: serverTimestamp()
            });
        } catch (e) {
            console.error("Failed to log action:", e);
        }
    }

});
