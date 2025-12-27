import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('settings-form');
    const toast = document.getElementById('toast');

    // Auth Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Verify Admin (Optional: check role)
            loadSettings();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // Load Settings
    async function loadSettings() {
        try {
            const docRef = doc(db, "config", "general_settings");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                setVal('platform-name', data.platformName);
                setVal('platform-video', data.platformVideo);
                setVal('platform-desc', data.platformDesc);
                setVal('contact-whatsapp', data.contactWhatsapp);
                setVal('contact-email', data.contactEmail);
                setVal('config-tax', data.taxRate);
                setVal('config-trial-days', data.trialDays);
                setVal('policy-terms', data.termsText);
                setVal('policy-privacy', data.privacyText);

                // New Fields
                setVal('config-maintenance', data.maintenanceMode);
                setVal('config-blocked-ips', data.blockedIPs);
                setVal('config-blocked-domains', data.blockedDomains);
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }

    function setVal(id, val) {
        if (val !== undefined && val !== null) {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = val;
                } else {
                    el.value = val;
                }
            }
        }
    }

    // Tabs Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // Save Settings
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-settings-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        btn.disabled = true;

        try {
            const data = {
                platformName: getVal('platform-name'),
                platformVideo: getVal('platform-video'),
                platformDesc: getVal('platform-desc'),
                contactWhatsapp: getVal('contact-whatsapp'),
                contactEmail: getVal('contact-email'),
                taxRate: Number(getVal('config-tax')),
                trialDays: Number(getVal('config-trial-days')),
                termsText: getVal('policy-terms'),
                privacyText: getVal('policy-privacy'),

                // New Fields
                maintenanceMode: getVal('config-maintenance'),
                blockedIPs: getVal('config-blocked-ips'),
                blockedDomains: getVal('config-blocked-domains'),

                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser.uid
            };

            await setDoc(doc(db, "config", "general_settings"), data, { merge: true });

            UIManager.showToast('تم حفظ الإعدادات بنجاح');

            // Optionally update page title immediately if changed
            if (data.platformName) document.title = `إعدادات المنصة - ${data.platformName}`;

        } catch (e) {
            console.error("Error saving settings:", e);
            UIManager.showToast("حدث خطأ أثناء الحفظ", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    function getVal(id) {
        const el = document.getElementById(id);
        if (!el) return null;
        if (el.type === 'checkbox') return el.checked;
        return el.value;
    }

    function showToast() {
        // Deprecated local toast, using UIManager
        // Keeping for backward compatibility if UIManager fails
    }

    // Reset Defaults
    const resetBtn = document.getElementById('reset-defaults-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const confirmed = await UIManager.showConfirm(
                'استعادة الافتراضيات',
                "هل أنت متأكد من استعادة الإعدادات الافتراضية؟ سيتم مسح التعديلات الغير محفوظة.",
                'نعم، استعد'
            );

            if (confirmed) {
                setVal('platform-name', 'Ta3leemy');
                setVal('platform-video', '');
                setVal('platform-desc', '');
                setVal('contact-whatsapp', '');
                setVal('contact-email', '');
                setVal('config-tax', '14');
                setVal('config-trial-days', '14');
                setVal('policy-terms', '');
                setVal('policy-privacy', '');
                UIManager.showToast("تم استعادة القيم الافتراضية في النموذج. اضغط 'حفظ' لتثبيتها.");
            }
        });
    }

});
