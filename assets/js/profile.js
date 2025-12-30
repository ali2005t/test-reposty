import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// No Storage Import needed

document.addEventListener('DOMContentLoaded', () => {

    let currentUser = null;
    const profileImg = document.getElementById('profile-image-preview');
    const fileInput = document.getElementById('file-upload');
    const saveBtn = document.getElementById('save-btn');
    let newProfileImageBase64 = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            const effectiveUid = await getEffectiveUserUid(user);
            if (effectiveUid) await loadProfile(effectiveUid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    async function loadProfile(uid) {
        try {
            const docRef = doc(db, "teachers", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                const fullNameInput = document.getElementById('full-name');
                const sideName = document.getElementById('side-name');
                const emailInput = document.getElementById('email');
                const platformInput = document.getElementById('platform-name');
                const subjectsInput = document.getElementById('subjects');
                const teacherCode = document.getElementById('teacher-code');

                if (fullNameInput) fullNameInput.value = data.name || '';
                if (sideName) sideName.innerText = data.name || 'محاضر';
                if (emailInput) emailInput.value = data.email || '';
                // Phone
                const phoneInput = document.getElementById('phone-display');
                if (phoneInput) phoneInput.value = data.phone || '';

                if (platformInput) platformInput.value = data.platformName || '';
                if (subjectsInput) subjectsInput.value = data.subjects || '';
                if (teacherCode) teacherCode.innerText = data.code || uid.substring(0, 6).toUpperCase();

                if (data.profileImage && profileImg) {
                    profileImg.src = data.profileImage;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Show loading
            const uploadBtn = document.querySelector('.upload-btn');
            let originalText = '';
            if (uploadBtn) {
                originalText = uploadBtn.innerHTML;
                uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري المعالجة...';
                uploadBtn.disabled = true;
            }

            // Resize and Compress Image
            resizeImage(file, 300, 300, async (base64String) => {
                newProfileImageBase64 = base64String;
                if (profileImg) profileImg.src = base64String;

                // Immediate Save to Firestore
                try {
                    await updateDoc(doc(db, "teachers", currentUser.uid), {
                        profileImage: base64String,
                        updatedAt: serverTimestamp()
                    });
                    alert('تم تحديث الصورة بنجاح!');
                } catch (err) {
                    console.error("Save image failed", err);
                    alert("فشل حفظ الصورة: " + err.message);
                } finally {
                    if (uploadBtn) {
                        uploadBtn.innerHTML = originalText;
                        uploadBtn.disabled = false;
                    }
                }
            });
        });
    }

    function resizeImage(file, maxWidth, maxHeight, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to 0.7 quality JPEG
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                callback(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    const form = document.getElementById('profile-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (saveBtn) saveBtn.disabled = true;

            const btnText = document.getElementById('btn-text');
            const btnLoader = document.getElementById('btn-loader');
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline-block';

            try {
                const updates = {
                    name: document.getElementById('full-name').value,
                    platformName: document.getElementById('platform-name').value,
                    subjects: document.getElementById('subjects').value,
                    phone: document.getElementById('phone-display').value,
                    updatedAt: serverTimestamp()
                };

                if (newProfileImageBase64) {
                    updates.profileImage = newProfileImageBase64;
                }

                await updateDoc(doc(db, "teachers", currentUser.uid), updates);
                alert("تم حفظ البيانات بنجاح");
                window.location.reload();
            } catch (error) {
                console.error(error);
                alert("حدث خطأ أثناء الحفظ");
            } finally {
                if (saveBtn) saveBtn.disabled = false;
                if (btnText) btnText.style.display = 'inline';
                if (btnLoader) btnLoader.style.display = 'none';
            }
        });
    }
    const passForm = document.getElementById('password-form');
    if (passForm) {
        passForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const passBtn = document.getElementById('pass-btn');
            const passBtnText = document.getElementById('pass-btn-text');
            const passBtnLoader = document.getElementById('pass-btn-loader');

            const currentPass = document.getElementById('current-password').value;
            const newPass = document.getElementById('new-password').value;

            if (!currentPass || !newPass) {
                alert("يرجى ملء جميع الحقول");
                return;
            }
            if (newPass.length < 6) {
                alert("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
                return;
            }

            if (passBtn) passBtn.disabled = true;
            if (passBtnText) passBtnText.style.display = 'none';
            if (passBtnLoader) passBtnLoader.style.display = 'inline-block';

            try {
                // Re-authenticate
                const credential = EmailAuthProvider.credential(currentUser.email, currentPass);
                await reauthenticateWithCredential(currentUser, credential);

                // Update
                await updatePassword(currentUser, newPass);

                alert("تم تحديث كلمة المرور بنجاح");
                passForm.reset();

            } catch (error) {
                console.error("Password Update Error", error);
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                    alert("كلمة المرور الحالية غير صحيحة");
                } else {
                    alert("حدث خطأ: " + error.message);
                }
            } finally {
                if (passBtn) passBtn.disabled = false;
                if (passBtnText) passBtnText.style.display = 'inline';
                if (passBtnLoader) passBtnLoader.style.display = 'none';
            }
        });
    }

    // Forgot Password Trigger
    const forgotBtn = document.getElementById('forgot-pass-btn');
    if (forgotBtn) {
        forgotBtn.onclick = async (e) => {
            e.preventDefault(); // prevent form submit if inside form
            if (confirm("هل تريد إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني؟ " + currentUser.email)) {
                try {
                    // We need sendPasswordResetEmail from auth import
                    // Dynamic import or add it to main import
                    const { sendPasswordResetEmail } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                    await sendPasswordResetEmail(auth, currentUser.email);
                    alert("تم إرسال الرابط! تفقد بريدك الإلكتروني.");
                } catch (err) {
                    console.error(err);
                    alert("حدث خطأ: " + err.message);
                }
            }
        }
    }

});
