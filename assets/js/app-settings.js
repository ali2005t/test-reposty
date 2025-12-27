import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initHeader } from './header-manager.js';

document.addEventListener('DOMContentLoaded', () => {

    // Global Functions (attached to window for HTML onclick access if needed, or using event listeners)
    // Preference: use event listeners where possible, but for simplicity with existing HTML, we can attach to window or refactor HTML.
    // I will attach key functions to window to match the existing HTML onclick attributes, 
    // but refactoring to addEventListener is cleaner. For now, strict extraction.

    window.updateAppName = function (name) {
        const nameToUse = name || 'اسم المنصة';
        // Update Card Title
        const cardTitle = document.getElementById('preview-app-name-card');
        if (cardTitle) cardTitle.innerText = nameToUse;

        // Update Header Text
        const headerName = document.getElementById('preview-header-name');
        if (headerName) headerName.innerText = nameToUse;
    };

    window.setBrandColor = function (color, el) {
        document.documentElement.style.setProperty('--brand-color', color);

        // Update solid backgrounds (buttons, etc)
        document.querySelectorAll('.brand-color-bg-solid').forEach(e => e.style.background = color);

        // Update text colors
        document.querySelectorAll('.brand-color-text').forEach(e => e.style.color = color);

        document.querySelectorAll('.color-picker-item').forEach(i => i.classList.remove('active'));
        if (el) el.classList.add('active');
    };

    window.previewLogo = function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.getElementById('preview-logo-img');
                if (img) img.src = e.target.result;
            }
            reader.readAsDataURL(file);
        }
    };

    window.saveAppSettings = async function () {
        const activeColorEl = document.querySelector('.color-picker-item.active');
        let color = activeColorEl ? activeColorEl.getAttribute('data-color') : '#f59e0b';

        // Handle Custom Color
        if (activeColorEl && activeColorEl.classList.contains('custom-color-wrapper')) {
            color = document.getElementById('custom-color-input').value;
        }

        const appName = document.getElementById('app-name-input').value;

        const btn = document.querySelector('.save-settings-section .btn-primary');
        const originalText = btn ? btn.innerHTML : 'حفظ';
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
            btn.disabled = true;
        }

        try {
            const user = auth.currentUser;
            let targetUid = user.uid;

            // Impersonation Support
            const impId = sessionStorage.getItem('impersonatedTeacherId');
            if (impId) {
                targetUid = impId;
                console.log("Saving as Impersonated User:", impId);
            }

            // 1. Update Teacher Doc
            await updateDoc(doc(db, "teachers", targetUid), {
                "appSettings.brandColor": color,
                "appSettings.appName": appName,
                "appSettings.updatedAt": new Date(),
                appRequestStatus: 'pending',
                appRequestDate: serverTimestamp()
            });

            // 2. Notify Admin
            await addDoc(collection(db, "notifications"), {
                target: 'admin',
                type: 'app_request',
                title: 'طلب تجهيز تطبيق جديد',
                message: `المعلم ${user.displayName || 'معلم'} طلب تجهيز تطبيق: ${appName}`,
                data: {
                    teacherId: targetUid, // Use target
                    teacherName: user.displayName, // Is this admin's name? Maybe we want teacher name?
                    // Fetching teacher name is async. For now admin name is fine as initiator? 
                    // Or "System Update". 
                    // Let's leave user.displayName, usually Admin name. Admin will know they did it.
                    appName: appName,
                    brandColor: color,
                    email: user.email
                },
                createdAt: serverTimestamp(),
                read: false
            });

            UIManager.showToast("تم إرسال طلبك بنجاح! سيتم التجهيز قريباً.");
            showPendingState();

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء الحفظ: " + e.message);
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    };

    // Helper Functions
    window.enableEditMode = function () {
        const settingsView = document.getElementById('settings-view');
        const statusView = document.getElementById('status-view');

        if (settingsView) {
            settingsView.style.display = 'block';
            settingsView.style.animation = 'fadeIn 0.5s';
        }
        if (statusView) statusView.style.display = 'none';

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    function showPendingState() {
        const settingsView = document.getElementById('settings-view');
        const statusView = document.getElementById('status-view');

        if (settingsView) settingsView.style.display = 'none';
        if (statusView) {
            statusView.style.display = 'block';
            statusView.innerHTML = `
                <div style="padding: 4rem 2rem; max-width: 600px; margin: 0 auto;">
                    <i class="fas fa-tools" style="font-size: 4rem; color: #f59e0b; margin-bottom: 2rem;"></i>
                    <h2 style="font-size: 2rem; margin-bottom: 1rem;">جاري تجهيز تطبيقك...</h2>
                    <p style="color: #64748b; font-size: 1.2rem; line-height: 1.8;">
                        طلبك قيد المعالجة حالياً. سيقوم فريقنا بتجهيز التطبيق ورفعه على المتاجر.
                        <br>ستصلك رسالة إشعار عند اكتمال العملية.
                    </p>
                    
                     <!-- Edit Button for Pending State too, just in case they made a mistake -->
                    <div style="margin-top: 2rem;">
                         <button class="btn btn-secondary" onclick="enableEditMode()" style="font-size: 0.9rem;">
                            <i class="fas fa-edit"></i> تعديل الطلب
                        </button>
                    </div>

                    <div style="margin-top: 2rem; padding: 1rem; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; color: #b45309;">
                        <i class="fas fa-info-circle"></i> تستغرق العملية عادةً 24 ساعة.
                    </div>
                </div>
            `;
        }
    }

    function showCompletedState(link) {
        const settingsView = document.getElementById('settings-view');
        const statusView = document.getElementById('status-view');

        if (settingsView) settingsView.style.display = 'none';
        if (statusView) {
            statusView.style.display = 'block';
            statusView.innerHTML = `
                <div style="padding: 4rem 2rem; max-width: 600px; margin: 0 auto;">
                    <i class="fas fa-rocket" style="font-size: 4rem; color: #10b981; margin-bottom: 2rem;"></i>
                    <h2 style="font-size: 2rem; margin-bottom: 1rem;">تطبيقك جاهز للإطلاق! 🚀</h2>
                    <p style="color: #64748b; font-size: 1.2rem; line-height: 1.8; margin-bottom: 2rem;">
                        تم تجهيز التطبيق ورفعه بنجاح. يمكنك الآن مشاركة الرابط مع طلابك.
                    </p>
                    
                    <a href="${link || '#'}" target="_blank" class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.2rem; display: inline-flex; align-items: center; gap: 10px;">
                        <i class="fas fa-download"></i> رابط التحميل المباشر
                    </a>

                    <div style="margin-top: 3rem;">
                        <button class="btn btn-secondary" onclick="enableEditMode()" style="font-size: 0.9rem;">
                            <i class="fas fa-edit"></i> تعديل إعدادات التطبيق
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Auth & Init
    onAuthStateChanged(auth, async (user) => {
        if (user) {

            let targetUid = user.uid;
            const urlParams = new URLSearchParams(window.location.search);
            const viewAsId = urlParams.get('viewAs');

            // Impersonation Login Logic
            if (viewAsId) {
                try {
                    // Verify Admin
                    const adminDoc = await getDoc(doc(db, "admins", user.uid));
                    if (adminDoc.exists()) {
                        targetUid = viewAsId;
                        sessionStorage.setItem('impersonatedTeacherId', viewAsId);

                        // Banner
                        const banner = document.createElement('div');
                        banner.style.cssText = "position:fixed; bottom:20px; right:20px; background:#ef4444; color:white; padding:10px 20px; border-radius:30px; z-index:9999; box-shadow:0 4px 15px rgba(0,0,0,0.3); font-weight:bold; display:flex; align-items:center; gap:10px; animation: slideIn 0.5s;";
                        banner.innerHTML = `<i class="fas fa-user-secret"></i> وضع المسؤول <button style="background:rgba(255,255,255,0.2); color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;" onclick="sessionStorage.removeItem('impersonatedTeacherId'); window.location.reload();">Exit</button>`;
                        document.body.appendChild(banner);
                    }
                } catch (e) { console.error(e); }
            } else {
                const stored = sessionStorage.getItem('impersonatedTeacherId');
                if (stored) {
                    targetUid = stored;
                    // Banner (Repeated logic, simplified)
                    const banner = document.createElement('div');
                    banner.style.cssText = "position:fixed; bottom:20px; right:20px; background:#ef4444; color:white; padding:10px 20px; border-radius:30px; z-index:9999; box-shadow:0 4px 15px rgba(0,0,0,0.3); font-weight:bold; display:flex; align-items:center; gap:10px; animation: slideIn 0.5s;";
                    banner.innerHTML = `<i class="fas fa-user-secret"></i> وضع المسؤول <button style="background:rgba(255,255,255,0.2); color:white; border:none; padding:2px 8px; border-radius:4px; cursor:pointer; font-size:0.8rem;" onclick="sessionStorage.removeItem('impersonatedTeacherId'); window.location.reload();">Exit</button>`;
                    document.body.appendChild(banner);
                }
            }

            initHeader(user); // Header uses Auth user usually

            // Check Plan & Status for TARGET UID
            try {
                const docRef = doc(db, "teachers", targetUid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();

                    // Check Pending Status
                    if (data.appRequestStatus === 'pending') {
                        showPendingState();
                        return;
                    }

                    // Check Completed Status
                    if (data.appRequestStatus === 'completed') {
                        showCompletedState(data.appDownloadLink);
                        return;
                    }

                    // Pre-fill existing settings
                    if (data.appSettings) {
                        const settings = data.appSettings;
                        if (settings.appName) {
                            const input = document.getElementById('app-name-input');
                            if (input) {
                                input.value = settings.appName;
                                window.updateAppName(settings.appName);
                            }
                        }
                        if (settings.brandColor) {
                            window.setBrandColor(settings.brandColor, null);
                        }
                    }

                    const plan = data.planTier || data.plan || 'free';
                    const allowedPlans = ['pro', 'elite', 'enterprise', 'premium'];

                    if (!allowedPlans.includes(plan.toLowerCase()) && data.subscriptionPlan !== 'premium_trial') {
                        const wall = document.getElementById('upgrade-wall');
                        if (wall) wall.style.display = 'flex';
                    }
                }
            } catch (e) {
                console.error("Plan check error:", e);
            }

        } else {
            window.location.href = '../auth/login.html';
        }
    });

});
