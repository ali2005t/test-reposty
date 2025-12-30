import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initGlobalSettings } from './settings-loader.js';
import { getEffectiveUserUid } from './impersonation-manager.js';

document.addEventListener('DOMContentLoaded', () => {
    initGlobalSettings();

    // Global Sidebar Toggle
    window.toggleSubmenu = function (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
    };

    // --- Sidebar Toggle Logic (Mobile) ---
    const sidebar = document.getElementById('sidebar');
    const openSidebarBtn = document.getElementById('open-sidebar');
    const closeSidebarBtn = document.getElementById('close-sidebar');

    if (openSidebarBtn) {
        openSidebarBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }

    // --- Auth & Data Fetching ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const uid = await getEffectiveUserUid(user);
            await loadTeacherData(uid);
        } else {
            // No user, redirect to login
            window.location.href = '../auth/login.html';
        }
    });

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = '../auth/login.html';
            } catch (e) {
                console.error("Logout failed", e);
            }
        });
    }

    async function loadTeacherData(uid) {
        try {
            const docRef = doc(db, "teachers", uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                // Redirect if onboarding not complete
                if (!data.onboardingComplete) {
                    window.location.href = 'onboarding.html';
                    return;
                }

                // Update UI
                updateDashboardUI(data);

            } else {
                console.error("No teacher profile found!");
                // Optionally handle extended error (logout or contact support)
            }
        } catch (error) {
            console.error("Error fetching teacher data:", error);
        }
    }

    function updateDashboardUI(data) {
        // Sidebar Profile
        const userNameEl = document.getElementById('user-name');
        const userPlanEl = document.getElementById('user-plan');
        const userAvatarEl = document.getElementById('user-avatar');

        if (userNameEl) userNameEl.innerText = data.fullName;
        if (userPlanEl) userPlanEl.innerText = (data.plan || 'Free').toUpperCase();
        if (userAvatarEl) {
            userAvatarEl.innerText = data.fullName.charAt(0).toUpperCase();
        }

        // Welcome Msg (Only on Dashboard)
        const welcomeMsg = document.getElementById('welcome-msg');
        if (welcomeMsg) welcomeMsg.innerText = `مرحباً بك، ${data.fullName.split(' ')[0]} 👋`;

        // Platform Title
        const platformTitle = document.getElementById('platform-title');
        if (platformTitle && data.platformName) {
            platformTitle.innerText = data.platformName;
        }

        // Stats (Only on Dashboard) - Safe check
        const statStudents = document.getElementById('stat-students');
        const statCourses = document.getElementById('stat-courses');
        const statViews = document.getElementById('stat-views');
        const statPlan = document.getElementById('stat-plan');

        if (statStudents) statStudents.innerText = data.stats?.students || 0;
        if (statCourses) statCourses.innerText = data.stats?.courses || 0;
        if (statViews) statViews.innerText = data.stats?.views || 0;
        if (statPlan) statPlan.innerText = (data.plan || 'Free').toUpperCase();

        // Check Plan for features
        if (data.plan === 'pro' || data.plan === 'elite') {
            // Unlock features in UI if hidden
        }
        if (data.plan === 'pro' || data.plan === 'elite') {
            // Unlock features in UI if hidden
        }

        // Referral System Toggle
        const navReferral = document.getElementById('nav-referral');
        if (navReferral) {
            if (data.referralEnabled) {
                navReferral.style.display = 'block';
            } else {
                navReferral.style.display = 'none';
            }
        }
    }

});

// Toast logic moved to ui-manager.js
