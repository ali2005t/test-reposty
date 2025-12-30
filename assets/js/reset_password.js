// reset_password.js
import { auth } from './firebase-config.js';
import { confirmPasswordReset, verifyPasswordResetCode } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    // Get the action code from the URL request.
    const mode = new URLSearchParams(window.location.search).get('mode');
    const actionCode = new URLSearchParams(window.location.search).get('oobCode');

    const form = document.getElementById('reset-password-form');
    const errorMsg = document.getElementById('error-message');
    const successMsg = document.getElementById('success-message');
    const submitBtn = document.getElementById('submit-btn');
    const btnLoader = document.getElementById('btn-loader');
    const btnText = document.getElementById('btn-text');

    // Basic Validation: Check if code exists
    if (!actionCode) {
        form.style.display = 'none';
        errorMsg.innerHTML = 'رابط غير صالح أو منتهي الصلاحية. <a href="forgot-password.html">طلب رابط جديد</a>';
        errorMsg.style.display = 'block';
        return;
    }

    // Verify Code Validity
    try {
        const email = await verifyPasswordResetCode(auth, actionCode);
        // Code is valid, let user type new password
    } catch (error) {
        console.error("Invalid Code", error);
        form.style.display = 'none';
        errorMsg.innerHTML = 'الرابط منتهي الصلاحية أو تم استخدامه مسبقاً. <a href="forgot-password.html">طلب رابط جديد</a>';
        errorMsg.style.display = 'block';
        return;
    }

    // Handle Form Submit
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword.length < 6) {
                errorMsg.textContent = "كلمة المرور يجب أن تكون 6 أحرف على الأقل.";
                errorMsg.style.display = 'block';
                return;
            }

            if (newPassword !== confirmPassword) {
                errorMsg.textContent = "كلمات المرور غير متطابقة.";
                errorMsg.style.display = 'block';
                return;
            }

            // Lock UI
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline-block';
            errorMsg.style.display = 'none';

            try {
                await confirmPasswordReset(auth, actionCode, newPassword);

                // Success
                form.style.display = 'none';
                successMsg.style.display = 'block';

            } catch (error) {
                console.error("Reset Error", error);
                errorMsg.textContent = "حدث خطأ أثناء حفظ كلمة المرور. حاول مرة أخرى.";
                errorMsg.style.display = 'block';

                // Unlock UI
                submitBtn.disabled = false;
                btnText.style.display = 'inline-block';
                btnLoader.style.display = 'none';
            }
        });
    }

    // Toggle Password Visibility
    document.getElementById('toggle-password')?.addEventListener('click', function () {
        const input = document.getElementById('new-password');
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
