// forgot-password.js
import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    const emailInput = document.getElementById('email');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const btn = document.getElementById('submit-btn');
            const loader = document.getElementById('btn-loader');
            const btnText = document.getElementById('btn-text');
            const errorMsg = document.getElementById('error-message');
            const successMsg = document.getElementById('success-message');

            const email = emailInput.value.trim();

            if (!email) return;

            // UI Loading State
            btn.disabled = true;
            btnText.style.display = 'none';
            loader.style.display = 'inline-block';
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';

            try {
                // Send Reset Email
                await sendPasswordResetEmail(auth, email);

                // Success
                successMsg.innerHTML = `
                    <i class="fas fa-check-circle"></i> تم إرسال رابط استعادة كلمة المرور إلى <b>${email}</b>.
                    <br>يرجى تفقد صندوق الوارد (وأيضاً البريد المهمل Spam).
                `;
                successMsg.style.display = "block";
                form.reset();

            } catch (error) {
                console.error("Reset Password Error:", error);

                let msg = "حدث خطأ أثناء محاولة إرسال الرابط.";
                if (error.code === 'auth/user-not-found') msg = "لا يوجد حساب مسجل بهذا البريد الإلكتروني.";
                else if (error.code === 'auth/invalid-email') msg = "صيغة البريد الإلكتروني غير صحيحة.";

                errorMsg.textContent = msg;
                errorMsg.style.display = "block";
            } finally {
                // Reset UI
                btn.disabled = false;
                btnText.style.display = 'inline-block';
                loader.style.display = 'none';
            }
        });
    }
});
