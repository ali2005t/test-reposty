import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CHECK_INTERVAL = 60 * 60 * 1000; // 1 Hour
const POPUP_HTML = `
<div id="sub-expired-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:none; align-items:center; justify-content:center; flex-direction:column;">
    <div style="background:#1e293b; padding:2rem; border-radius:16px; width:90%; max-width:800px; text-align:center; box-shadow:0 0 30px rgba(0,0,0,0.5); border:1px solid #334155;">
        <h2 style="color:#ef4444; margin-bottom:10px;">⚠️ انتهت فترة اشتراكك</h2>
        <p style="color:#cbd5e1; margin-bottom:2rem; font-size:1.1rem;">يرجى تجديد الاشتراك للاستمرار في استخدام المنصة والاستفادة من كافة المميزات.</p>
        
        <div id="pricing-plans-container" style="display:flex; gap:20px; flex-wrap:wrap; justify-content:center;">
            <div style="color:white;">Loading Plans...</div>
        </div>

        <button id="close-sub-modal" style="margin-top:2rem; background:transparent; border:1px solid #475569; color:#94a3b8; padding:8px 20px; border-radius:8px; cursor:pointer;">إغلاق مؤقت</button>
    </div>
</div>
`;

// Inject Modal
document.body.insertAdjacentHTML('beforeend', POPUP_HTML);

const modal = document.getElementById('sub-expired-modal');
const container = document.getElementById('pricing-plans-container');
document.getElementById('close-sub-modal').onclick = () => {
    modal.style.display = 'none';
    localStorage.setItem('subPopupLastShown', Date.now());
};

export async function initSubscriptionCheck(user) {
    if (!user) return;

    // Check Logic
    const check = async () => {
        try {
            const docSnap = await getDoc(doc(db, "teachers", user.uid));
            if (!docSnap.exists()) return;

            const data = docSnap.data();
            const endsAt = data.subscriptionEndsAt ? data.subscriptionEndsAt.toDate() : null;

            if (!endsAt || endsAt < new Date()) {
                // Expired
                const lastShown = localStorage.getItem('subPopupLastShown');
                const now = Date.now();

                if (!lastShown || (now - lastShown > CHECK_INTERVAL)) {
                    await showRenewalModal();
                }
            }
        } catch (e) {
            console.error("Sub Check Error", e);
        }
    };

    // Run Immediately
    check();
    // Run Interval
    setInterval(check, CHECK_INTERVAL);
}

async function showRenewalModal() {
    modal.style.display = 'flex';

    // Load Prices
    try {
        const pSnap = await getDoc(doc(db, "config", "pricing"));
        let prices = { monthly: ['299', '599', '1199'], yearly: ['2999', '5999', '11999'] };
        if (pSnap.exists()) prices = pSnap.data();

        const plans = ['Start', 'Pro', 'Elite'];
        const features = [
            ['50 طالب', 'مساحة 5GB', 'دعم فني'],
            ['200 طالب', 'مساحة 20GB', 'دعم فني', 'متجر خاص'],
            ['عدد لا محدود', 'مساحة مفتوحة', 'دعم مميز', 'دومين خاص']
        ]; // Example features

        container.innerHTML = plans.map((name, i) => `
            <div style="background:#0f172a; padding:1.5rem; border-radius:12px; border:1px solid #334155; flex:1; min-width:200px; max-width:250px;">
                <h3 style="color:#3b82f6; margin-top:0;">${name}</h3>
                <h2 style="color:white; font-size:1.8rem;">${prices.monthly[i]} <span style="font-size:0.9rem; color:#94a3b8;">ج.م/شهر</span></h2>
                <ul style="text-align:right; color:#cbd5e1; list-style:none; padding:0; margin:1rem 0;">
                    ${features[i].map(f => `<li>✓ ${f}</li>`).join('')}
                </ul>
                <button onclick="requestSubscription('${name.toLowerCase()}')" style="width:100%; background:#3b82f6; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer;">اشترك الآن</button>
            </div>
        `).join('');

        // Make functions global for onclick
        window.requestSubscription = (plan) => {
            const phoneNumber = "01000000000"; // Admin Contact
            const msg = `مرحباً، أرغب في تجديد اشتراكي على باقة ${plan}.`;
            window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(msg)}`, '_blank');
        };

    } catch (e) {
        console.error(e);
    }
}
