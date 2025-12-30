// login.js - Secure Login Logic with Verification Check
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-btn');
            const loader = document.getElementById('btn-loader');
            const btnText = document.getElementById('btn-text');
            const errorMsg = document.getElementById('error-message');

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            // Start Loading
            btn.disabled = true;
            btnText.style.display = 'none';
            loader.style.display = 'inline-block';
            errorMsg.style.display = 'none';

            try {
                // 1. Attempt Sign In
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // 2. Check if Email is Verified (Skip for Admins to avoid checkout, but Plan says 'exempt admins')
                // Let's first check verification status.
                if (!user.emailVerified) {
                    // Check if it's an admin first? (Might be slow).
                    // Or simpler: Block everyone, but Admins usually verify anyway. 
                    // Let's STRICTLY enforce it based on User Request "البريد الذي سيعمل هو الذي يمتلك صيغة @gmail.com .. لآدمن مالوش دعوة".
                    // Wait, user said "Admins nothing to do with this". So admins might log in without verification?
                    // Let's check Firestore role.

                    // Quick check if email is admin email (or fetch role) - Fetching role is safer.
                    const adminDoc = await getDoc(doc(db, "admins", user.uid));
                    if (adminDoc.exists()) {
                        // Admin -> ALLOW even if not verified (User rule: Admins exempt)
                        window.location.href = '../admin/dashboard.html';
                        return;
                    }

                    // Not Admin -> BLock
                    // Not Admin -> BLock

                    // Trigger Resend (if not already verified)
                    // We must do this BEFORE signing out to have permission
                    try {
                        await sendEmailVerification(user);
                    } catch (err) {
                        console.error("Auto-resend failed (maybe too frequent):", err);
                    }

                    await signOut(auth); // Kick them out

                    errorMsg.innerHTML = `
                        <div style="text-align: center;">
                            <i class="fas fa-envelope-open-text" style="font-size: 2rem; color: #f59e0b; margin-bottom: 10px;"></i>
                            <h4 style="color: #f59e0b; margin: 0 0 5px 0;">البريد الإلكتروني غير مفعل</h4>
                            <p style="font-size: 0.9rem; color: #d1d5db; margin-bottom: 10px;">
                                لم يتم تفعيل حسابك بعد.
                                <br>
                                <span style="color: #4ade80; font-size: 0.8rem;">تم إرسال رابط تفعيل جديد إلى بريدك الآن.</span>
                            </p>
                            <a href="#" id="resend-link" style="color: #6366f1; text-decoration: underline; font-size: 0.85rem;">لم تصلك الرسالة؟ سجل دخول مرة أخرى لإعادة الإرسال</a>
                        </div>
                    `;
                    errorMsg.style.display = "block";
                    errorMsg.style.border = "1px solid rgba(245, 158, 11, 0.3)";
                    errorMsg.style.background = "rgba(245, 158, 11, 0.1)";

                    // Attach resend listener logic
                    const resendLink = document.getElementById('resend-link');
                    if (resendLink) {
                        resendLink.addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            alert("لأسباب أمنية، يرجى تسجيل الدخول مرة أخرى ليتم إرسال رابط التفعيل الجديد تلقائياً.");
                        });
                    }

                    btn.disabled = false;
                    btnText.style.display = 'inline-block';
                    loader.style.display = 'none';
                    return;
                }

                // 3. Email Verified -> Route based on Role
                // Check Admin
                const adminSnap = await getDoc(doc(db, "admins", user.uid));
                if (adminSnap.exists()) {
                    window.location.href = '../admin/dashboard.html';
                    return;
                }

                // Check Teacher
                const teacherSnap = await getDoc(doc(db, "teachers", user.uid));
                if (teacherSnap.exists()) {
                    window.location.href = '../teacher/dashboard.html';
                    return;
                }

                // Check Student
                const studentSnap = await getDoc(doc(db, "students", user.uid));
                if (studentSnap.exists()) {
                    // Check device restriction logic? (Skipped for now, handled in student-auth.js usually)
                    window.location.href = '../student-app/index.html';
                    return;
                }

                // Fallback
                window.location.href = '../index.html';

            } catch (error) {
                console.error("Login Error:", error);
                let msg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
                if (error.code === 'auth/user-not-found') msg = "هذا الحساب غير موجود";

                errorMsg.textContent = msg;
                errorMsg.style.display = "block";

                btn.disabled = false;
                btnText.style.display = 'inline-block';
                loader.style.display = 'none';
            }
        });
    }

    // Toggle Password Visibility
    document.getElementById('toggle-password')?.addEventListener('click', function () {
        const input = document.getElementById('password');
        if (input.type === "password") {
            input.type = "text";
            this.classList.remove("fa-eye");
            this.classList.add("fa-eye-slash");
        } else {
            input.type = "password";
            this.classList.remove("fa-eye-slash");
            this.classList.add("fa-eye");
        }
    });

});
