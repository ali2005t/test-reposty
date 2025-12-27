/**
 * Impersonation Manager
 * Handles the logic for Admins to view the Teacher Dashboard as a specific teacher.
 */

import { db, auth } from '../firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function loginAsTeacher(teacherId) {
    if (!auth.currentUser) {
        alert("يجب عليك تسجيل الدخول كمسؤول أولاً.");
        return;
    }

    try {
        // 1. Verify Requestor is Admin
        const adminRef = doc(db, "admins", auth.currentUser.uid);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
            alert("ليس لديك صلاحية للقيام بهذا الإجراء.");
            return;
        }

        // 2. Open Dashboard with ViewAs Parameter
        // This relies on the dashboard having logic to read this param
        const url = `../teacher/dashboard.html?viewAs=${teacherId}`;
        window.open(url, '_blank');

    } catch (error) {
        console.error("Impersonation Error:", error);
        alert("حدث خطأ أثناء محاولة الدخول: " + error.message);
    }
}

// Attach to global scope for HTML buttons
window.loginAsTeacher = loginAsTeacher;
