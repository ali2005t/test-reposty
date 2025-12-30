// register.js - Secure Registration Logic with Phone Verification
import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === CONFIGURATION ===
const ENABLE_PHONE_VERIFICATION = false; // Set to false to disable OTP step
// =====================

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    // Role/Plan param logic
    const role = new URLSearchParams(window.location.search).get('role') || 'teacher';
    const plan = new URLSearchParams(window.location.search).get('plan') || 'free';
    const refCode = new URLSearchParams(window.location.search).get('ref');

    // Global variables for OTP
    let confirmationResult = null;
    let isPhoneVerified = false;

    // Initialize Recaptcha
    if (ENABLE_PHONE_VERIFICATION) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA solved, allow signInWithPhoneNumber.
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-btn');
            const loader = document.getElementById('btn-loader');
            const btnText = document.getElementById('btn-text');
            const errorMsg = document.getElementById('error-message');

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const fullName = document.getElementById('full-name').value.trim();
            let phone = document.getElementById('phone').value.trim();

            // 1. Basic Validation
            if (!email.endsWith('@gmail.com')) {
                errorMsg.textContent = "عذراً، التسجيل متاح فقط لحسابات Gmail (@gmail.com) لضمان الجودة.";
                errorMsg.style.display = "block";
                return;
            }

            if (!phone) {
                errorMsg.textContent = "رقم الهاتف مطلوب لتأمين الحساب.";
                errorMsg.style.display = "block";
                return;
            }

            // Format Phone (Assume Egypt if missing key)
            if (!phone.startsWith('+')) {
                // simple assumption: if user types 010..., make it +2010...
                // Removing leading zero if exists
                if (phone.startsWith('0')) {
                    phone = '+20' + phone.substring(1);
                } else {
                    phone = '+20' + phone; // fallback
                }
            }

            // --- PHONE VERIFICATION STEP ---
            if (ENABLE_PHONE_VERIFICATION && !isPhoneVerified) {
                // Trigger OTP Flow
                btn.disabled = true;
                btnText.textContent = 'جاري إرسال الرمز...';
                loader.style.display = 'inline-block';
                errorMsg.style.display = 'none';

                const appVerifier = window.recaptchaVerifier;

                try {
                    const confirmation = await signInWithPhoneNumber(auth, phone, appVerifier);
                    confirmationResult = confirmation;

                    // Show OTP Modal
                    document.getElementById('otp-phone-display').innerText = phone;
                    document.getElementById('otp-modal').style.display = 'flex';

                    // Reset Register Button State (so they can try again if they cancel)
                    btn.disabled = false;
                    btnText.textContent = 'إنشاء الحساب';
                    loader.style.display = 'none';

                    return; // Stop here, wait for OTP

                } catch (error) {
                    console.error("SMS Error:", error);
                    errorMsg.textContent = "فشل إرسال رسالة التحقق. تأكد من صحة الرقم (مثال: 010xxxx).";
                    if (error.code === 'auth/invalid-phone-number') errorMsg.textContent = "رقم الهاتف غير صحيح.";
                    else if (error.code === 'auth/too-many-requests') errorMsg.textContent = "محاولات كثيرة جداً. حاول لاحقاً.";

                    errorMsg.style.display = "block";
                    btn.disabled = false;
                    btnText.textContent = 'إنشاء الحساب';
                    loader.style.display = 'none';
                    return;
                }
            }
            // -------------------------------

            // Proceed to Create Account (if OTP disabled OR already verified)
            completeRegistration(email, password, fullName, phone, role, plan);
        });
    }

    // OTP Verify Button Logic
    document.getElementById('verify-otp-btn')?.addEventListener('click', async () => {
        const otpInput = document.getElementById('otp-input').value;
        const errorMsg = document.getElementById('error-message'); // main error msg

        if (!otpInput || otpInput.length < 6) {
            alert("يرجى إدخال الرمز المكون من 6 أرقام");
            return;
        }

        try {
            await confirmationResult.confirm(otpInput);

            // Success!
            isPhoneVerified = true;
            document.getElementById('otp-modal').style.display = 'none';

            // Now verify we are "signed in" as phone user. 
            // We should signOut immediately because we want to create a NEW email user, 
            // not link (unless we want to link, but let's keep it simple: Verified -> OK -> Create real account).
            await signOut(auth);

            // Trigger Form Submit again to finish registration
            // We just call the completion function manually to avoid re-triggering 'submit' event logic weirdness
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const fullName = document.getElementById('full-name').value.trim();
            let phone = document.getElementById('phone').value.trim();
            if (!phone.startsWith('+')) {
                if (phone.startsWith('0')) phone = '+20' + phone.substring(1);
                else phone = '+20' + phone;
            }

            completeRegistration(email, password, fullName, phone, role, plan);

        } catch (error) {
            console.error("OTP Invalid", error);
            alert("رمز التحقق غير صحيح!");
        }
    });


    // Helper Function to Create User
    async function completeRegistration(email, password, fullName, phone, role, plan) {
        const btn = document.getElementById('submit-btn');
        const loader = document.getElementById('btn-loader');
        const btnText = document.getElementById('btn-text');
        const errorMsg = document.getElementById('error-message');

        btn.disabled = true;
        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        errorMsg.style.display = 'none';

        try {
            // Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Send Verification Email
            await sendEmailVerification(user);

            // Create Firestore Document
            const userData = {
                uid: user.uid,
                email: email,
                fullName: fullName,
                phone: phone, // Verified phone (if enabled)
                role: role,
                plan: plan,
                createdAt: serverTimestamp(),
                emailVerified: false,
                status: 'active',
                subscriptionStatus: 'trial',
                trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                phoneVerified: ENABLE_PHONE_VERIFICATION, // Mark as verified if feature was on
                referredBy: (role === 'teacher' && refCode) ? refCode : null
            };

            const collectionName = role === 'student' ? 'students' : 'teachers';
            await setDoc(doc(db, collectionName, user.uid), userData);

            // Notify Admin about Referral
            if (role === 'teacher' && refCode) {
                try {
                    await addDoc(collection(db, "admin_notifications"), {
                        type: 'referral_signup',
                        title: 'تسجيل معلم جديد عن طريق إحالة',
                        body: `قام المعلم "${fullName}" بالتسجيل باستخدام كود الإحالة: ${refCode}`,
                        refCode: refCode,
                        newTeacherId: user.uid,
                        isRead: false,
                        createdAt: serverTimestamp()
                    });
                } catch (e) {
                    console.error("Referral Notification Error:", e);
                }
            }

            // Sign Out
            await signOut(auth);

            // Success & Redirect
            // Success & Show Modal
            const successModal = document.getElementById('success-modal');
            if (successModal) {
                // Update email text dynamically if needed, or simpler just show it
                successModal.style.display = 'flex';
            } else {
                // Fallback just in case
                alert("تم إنشاء الحساب بنجاح! يرجى تفعيل البريد الإلكتروني.");
                window.location.href = 'login.html';
            }

        } catch (error) {
            console.error("Registration Error:", error);
            let msg = "حدث خطأ أثناء إنشاء الحساب.";
            if (error.code === 'auth/email-already-in-use') msg = "البريد الإلكتروني مستخدم بالفعل.";
            else if (error.code === 'auth/weak-password') msg = "كلمة المرور ضعيفة (يجب أن تكون 6 أحرف على الأقل).";

            errorMsg.textContent = msg;
            errorMsg.style.display = "block";

            // Reset Button
            btn.disabled = false;
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
        }
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
