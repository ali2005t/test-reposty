import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let currentUser = null;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    const form = document.getElementById('add-user-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('save-btn');
            const loader = document.getElementById('btn-loader');

            btn.disabled = true;
            loader.style.display = 'inline-block';

            const name = document.getElementById('user-name').value;
            const email = document.getElementById('user-email').value;
            const pass = document.getElementById('user-password').value;
            const role = document.getElementById('user-role').value;

            try {
                // IMPORTANT: We cannot create a Firebase Auth User here while logged in as Admin.
                // We would need a Cloud Function or Admin SDK.
                // FOR DEMO/MVP: We will just save the "Invite" to Firestore.
                // The actual user creation would happen when they use the invite or we mock it.

                await addDoc(collection(db, "staff_invites"), {
                    ownerId: currentUser.uid,
                    name: name,
                    email: email,
                    initialPassword: pass, // Insecure in production, ok for MVP demo
                    role: role,
                    status: 'active',
                    createdAt: serverTimestamp()
                });

                // Also add to a visible 'staff' collection for list view if separate
                // Or just query 'staff_invites' in users.js

                alert("تم إضافة الموظف بنجاح (Simulation)");
                window.location.href = 'users.html';

            } catch (error) {
                console.error("Error adding user:", error);
                alert("حدث خطأ: " + error.message);
                btn.disabled = false;
                loader.style.display = 'none';
            }
        });
    }

});
