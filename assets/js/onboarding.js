import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- Step Navigation Logic ---
    let currentStep = 1;
    const totalSteps = 3;
    const form = document.getElementById('onboarding-form');
    const platformNameInput = document.getElementById('platform-name');
    const slugInput = document.getElementById('platform-slug');

    // Navigation Buttons
    document.querySelectorAll('.next-step').forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                if (currentStep === 1) {
                    // Auto-generate slug from name if empty
                    if (!slugInput.value) {
                        slugInput.value = generateSlug(platformNameInput.value);
                    }
                }
                showStep(currentStep + 1);
            }
        });
    });

    document.querySelectorAll('.prev-step').forEach(btn => {
        btn.addEventListener('click', () => {
            showStep(currentStep - 1);
        });
    });

    function showStep(step) {
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(el => el.style.display = 'none');
        // Show target step
        document.getElementById(`step-${step}`).style.display = 'block';

        // Update dots
        document.querySelectorAll('.step-dot').forEach((dot, index) => {
            dot.classList.toggle('active', index + 1 === step);
        });

        currentStep = step;
    }

    function validateStep(step) {
        if (step === 1) {
            const name = document.getElementById('platform-name').value;
            const specialty = document.getElementById('specialty').value;
            if (!name || !specialty) {
                alert("يرجى ملء جميع الحقول المطلوبة");
                return false;
            }
        }
        return true;
    }

    function generateSlug(text) {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w\-\u0600-\u06FF]+/g, '') // Remove all non-word chars (allow Arabic)
            .replace(/\-\-+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }


    // --- Firebase Logic ---
    let currentUser = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            // Check if already onboarded, redirect if so
            const docRef = doc(db, "teachers", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists() && docSnap.data().onboardingComplete) {
                window.location.href = 'dashboard.html';
            }
        } else {
            // Not logged in
            window.location.href = '../auth/login.html';
        }
    });


    // --- Form Submission ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = document.getElementById('finish-btn');
        const loader = document.getElementById('btn-loader');
        const btnText = document.getElementById('btn-text');

        btn.disabled = true;
        loader.style.display = 'inline-block';
        btnText.style.display = 'none';

        try {
            const platformName = document.getElementById('platform-name').value;
            const specialty = document.getElementById('specialty').value;
            const slug = document.getElementById('platform-slug').value;

            // Update Teacher Document
            await updateDoc(doc(db, "teachers", currentUser.uid), {
                platformName: platformName,
                specialty: specialty,
                platformSlug: slug,
                onboardingComplete: true,
                updatedAt: serverTimestamp()
            });

            // Redirect to Dashboard
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error("Onboarding Error:", error);
            alert("حدث خطأ أثناء حفظ البيانات: " + error.message);

            btn.disabled = false;
            loader.style.display = 'none';
            btnText.style.display = 'inline-block';
        }
    });

});
