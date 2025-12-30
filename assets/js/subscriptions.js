import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    doc,
    getDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let currentTeacherDoc = null;
let pricingConfig = null;
let currentBillingPeriod = 'monthly';

// Support Number for Payments (Vodafone Cash) - Could be dynamic later
const SUPPORT_PHONE = "201000000000"; // Replace with actual admin number if available

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadPricingConfig();
            const uid = await getEffectiveUserUid(user);
            await loadSubscriptionData(uid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });
});

async function loadPricingConfig() {
    try {
        const docRef = doc(db, "config", "pricing_v2");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            pricingConfig = snap.data();
            renderPackages(pricingConfig);
        } else {
            // Fallback if no config found (shouldn't happen if admin page visited once)
            console.warn("Pricing config not found, using defaults or waiting for admin init.");
        }
    } catch (e) {
        console.error("Error loading pricing:", e);
    }
}

async function loadSubscriptionData(uid) {
    try {
        // 1. Fetch Teacher Doc (for Name/Phone/Basic Info)
        const teacherDocRef = doc(db, "teachers", uid);
        const teacherSnap = await getDoc(teacherDocRef);
        if (teacherSnap.exists()) currentTeacherDoc = teacherSnap.data();

        // 2. Fetch Active Subscription Doc
        const subDocRef = doc(db, "subscriptions", uid); // We used TID as ID in admin logic
        const subSnap = await getDoc(subDocRef);

        let subData = null;
        if (subSnap.exists()) {
            subData = subSnap.data();
        } else {
            // Check if legacy OR synced fields exist on teacher doc
            if (currentTeacherDoc?.hasActiveSubscription || currentTeacherDoc?.planTier) {
                subData = {
                    plan: currentTeacherDoc.planTier || 'basic',
                    endDate: currentTeacherDoc.subscriptionEnd || currentTeacherDoc.subscriptionEndsAt, // Check both new and old names
                    startDate: currentTeacherDoc.subscriptionStart || currentTeacherDoc.subscriptionStartedAt, // [NEW] Added Start Date
                    isActive: currentTeacherDoc.subscriptionStatus === 'active' || currentTeacherDoc.hasActiveSubscription === true,
                    planLabel: currentTeacherDoc.planLabel || currentTeacherDoc.planTier
                };
            }
        }

        renderSubscriptionStatus(subData);

        // Highlight logic
        const currentTier = subData?.plan || 'basic';
        highlightCurrentPlan(currentTier);

        // Usage Stats
        await calculateUsage(uid, currentTier);

    } catch (e) {
        console.error("Error loading sub data:", e);
        UIManager.showToast("فشل تحميل بيانات الاشتراك", "error");
    }
}

// ... existing code ...

import { collection, query, where, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function calculateUsage(uid, currentTier) {
    // 1. Get Limits from Config
    let limitStudents = 0; // 0 = unlimited
    let limitStorage = 5; // GB

    if (pricingConfig && pricingConfig[currentTier]) {
        limitStudents = pricingConfig[currentTier].maxStudents || 0;
        limitStorage = pricingConfig[currentTier].storage || 5;
    } else {
        // Fallback defaults
        if (currentTier === 'basic') { limitStudents = 50; limitStorage = 5; }
        else if (currentTier === 'pro') { limitStudents = 1000; limitStorage = 100; }
        else { limitStudents = 0; limitStorage = 500; }
    }

    // 2. Count Real Students
    // In 'students' collection, we have 'enrolledTeachers' array
    let currentStudents = 0;
    try {
        const q = query(collection(db, "students"), where("enrolledTeachers", "array-contains", uid));
        const snapshot = await getCountFromServer(q);
        currentStudents = snapshot.data().count;
    } catch (e) {
        console.error("Error counting students:", e);
        // Fallback for demo if query fails (e.g. index needed)
        currentStudents = currentTeacherDoc.studentCount || 0;
    }

    // 3. Mock Storage (Random for MVP, or store in teacher doc)
    // For now, let's say 10% of limit + random
    let currentStorage = (limitStorage * 0.1).toFixed(1);

    // 4. Update UI
    updateProgressBar('students', currentStudents, limitStudents, '');
    updateProgressBar('storage', currentStorage, limitStorage, 'GB');
}

function updateProgressBar(type, current, limit, unit) {
    const textEl = document.getElementById(`${type}-count-text`);
    const barEl = document.getElementById(`${type}-progress`);
    const msgEl = document.getElementById(`${type}-msg`);

    if (!textEl || !barEl || !msgEl) return;

    let percentage = 0;
    let limitText = limit === 0 ? '∞' : limit;

    if (limit === 0) {
        // Unlimited
        percentage = 5; // Just show a little bar
        textEl.innerText = `${current} ${unit} / غير محدود`;
        barEl.style.width = '100%';
        barEl.style.background = '#10b981'; // Green
    } else {
        percentage = (current / limit) * 100;
        if (percentage > 100) percentage = 100;
        textEl.innerText = `${current} ${unit} / ${limit} ${unit}`;
        barEl.style.width = `${percentage}%`;

        // Color coding
        if (percentage > 90) barEl.style.background = '#ef4444'; // Red
        else if (percentage > 70) barEl.style.background = '#f59e0b'; // Orange
        else barEl.style.background = '#10b981'; // Green
    }

    // Msg
    if (limit > 0 && percentage >= 90) {
        msgEl.innerText = '⚠️ اقتربت من الحد الأقصى! يرجى الترقية.';
        msgEl.style.color = '#ef4444';
    } else {
        if (type === 'students') msgEl.innerText = 'عدد الطلاب النشطين حالياً';
        if (type === 'storage') msgEl.innerText = 'إجمالي الملفات والفيديوهات المرفوعة';
    }
}

window.switchBilling = (period) => {
    currentBillingPeriod = period;

    // UI Update
    const mBtn = document.getElementById('btn-monthly');
    const yBtn = document.getElementById('btn-yearly');

    if (mBtn && yBtn) {
        if (period === 'monthly') {
            mBtn.style.background = '#6366f1'; mBtn.style.color = 'white';
            yBtn.style.background = 'transparent'; yBtn.style.color = '#94a3b8';
        } else {
            yBtn.style.background = '#6366f1'; yBtn.style.color = 'white';
            mBtn.style.background = 'transparent'; mBtn.style.color = '#94a3b8';
        }
    }

    if (pricingConfig) renderPackages(pricingConfig);
};

function renderPackages(config) {
    const grid = document.querySelector('.plans-grid');
    if (!grid) return;
    grid.innerHTML = ''; // Clear hardcoded

    const order = ['basic', 'pro', 'elite']; // Enforce order

    order.forEach(key => {
        const pkg = config[key];
        if (!pkg) return;

        // Features List
        const featuresHtml = pkg.features.split('\n').map(f => `<li><i class="fas fa-check"></i> ${f}</li>`).join('');

        // Badge
        const badge = pkg.isPopular ?
            `<div style="position:absolute; top:0; left:50%; transform:translateX(-50%); background:#6366f1; color:white; padding:4px 15px; border-radius:0 0 10px 10px; font-size:0.8rem; font-weight:bold;">الأكثر طلباً</div>` : '';

        // Icon mapping (simple)
        const icons = { 'basic': 'paper-plane', 'pro': 'rocket', 'elite': 'building' };
        const iconClass = icons[key] || 'star';

        const price = currentBillingPeriod === 'monthly' ? pkg.priceMonthly : pkg.priceYearly;
        const periodText = currentBillingPeriod === 'monthly' ? 'شهرياً' : 'سنوياً';

        const card = document.createElement('div');
        card.className = 'plan-card';
        card.id = `plan-${key}`;
        card.innerHTML = `
            ${badge}
            <i class="fas fa-${iconClass}" style="font-size:2rem; color:${pkg.isPopular ? '#6366f1' : '#94a3b8'}; margin-bottom:15px;"></i>
            <h3 style="margin:0; color:white;">${pkg.title}</h3> 
            <p style="color:#94a3b8; font-size:0.9rem; margin-top:5px;">${pkg.tagline}</p>
            <div class="plan-price">${price} <span>ج.م / ${periodText}</span></div>
            <ul class="plan-features">${featuresHtml}</ul>
            <button class="btn ${pkg.isPopular ? 'btn-primary' : 'btn-outline'} full-width" 
                onclick="initiateSubscription('${key}', '${pkg.title} (${currentBillingPeriod === 'monthly' ? 'شهري' : 'سنوي'})', ${price})" 
                style="${pkg.isPopular ? 'background:#6366f1;' : 'border-color:#334155; color:white;'}">
                ${pkg.btnText}
            </button>
        `;
        grid.appendChild(card);
    });
}

function renderSubscriptionStatus(data) {
    const planNameEl = document.getElementById('current-plan-name');
    const expiryEl = document.getElementById('expiry-date');
    const statusEl = document.getElementById('plan-status');

    // New Elements
    const progressContainer = document.getElementById('time-progress-container');
    const progressStartEl = document.getElementById('sub-start-date');
    const progressEndEl = document.getElementById('sub-end-date');
    const progressBar = document.getElementById('sub-time-progress');
    const progressText = document.getElementById('sub-days-remaining-text');

    if (!data) {
        planNameEl.innerText = "لا يوجد اشتراك نشط";
        expiryEl.innerText = "";
        statusEl.innerText = "غير مفعل";
        statusEl.style.background = '#64748b';
        if (progressContainer) progressContainer.style.display = 'none';
        return;
    }

    // Plan Name
    // Prefer planLabel from admin, status else fallback
    planNameEl.innerText = data.planLabel || (pricingConfig?.[data.plan]?.title) || data.plan || "باقة غير معروفة";

    // Status Badge
    let isActive = data.isActive;

    // Check Date Expiry Manually if isActive is true but date passed
    let endDate = null;
    let startDate = null;

    if (data.endDate) {
        // Handle Firestore Timestamp or JS Date
        endDate = data.endDate.toDate ? data.endDate.toDate() : new Date(data.endDate);
        if (endDate < new Date()) isActive = false;
    }

    if (data.startDate) {
        startDate = data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate);
    }

    if (isActive) {
        statusEl.style.background = '#10b981';
        statusEl.innerText = 'نشط';
    } else {
        statusEl.style.background = '#ef4444';
        statusEl.innerText = 'منتهي / غير نشط';
    }

    // Expiry Date Logic
    if (endDate) {
        const now = new Date();
        const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        const expiryText = endDate.toLocaleDateString('ar-EG');

        // Show progress bar if we have both dates
        if (progressContainer && startDate) {
            progressContainer.style.display = 'block';
            progressStartEl.innerText = startDate.toLocaleDateString('ar-EG');
            progressEndEl.innerText = expiryText;

            const totalTime = endDate - startDate;
            const elapsedTime = now - startDate;
            let percent = 0;

            if (totalTime > 0) {
                percent = (elapsedTime / totalTime) * 100;
                if (percent < 0) percent = 0;
                if (percent > 100) percent = 100;
            }

            progressBar.style.width = `${percent}%`;
            progressText.innerText = `انقضى ${Math.floor(percent)}% من المدة (متبقي ${daysLeft > 0 ? daysLeft : 0} يوم)`;

            // Color Logic
            if (percent > 90) progressBar.style.background = '#ef4444'; // Red near end
            else if (percent > 75) progressBar.style.background = '#f59e0b'; // Orange
            else progressBar.style.background = 'linear-gradient(90deg, #10b981, #3b82f6)';
        }

        if (daysLeft > 0) {
            expiryEl.innerHTML = `<i class="fas fa-clock"></i> ينتهي في: ${expiryText}`;
            if (daysLeft < 5) expiryEl.style.color = '#ef4444'; // Red warning close to expiry
            else expiryEl.style.color = '#10b981';
        } else {
            expiryEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> انتهى الاشتراك في: ${expiryText}`;
            expiryEl.style.color = '#ef4444';

            if (isActive === false) {
                UIManager.showToast('انتهت مدة اشتراكك، يرجى التجديد.', 'warning');
            }
        }
    } else {
        expiryEl.innerText = 'غير محدد';
        if (progressContainer) progressContainer.style.display = 'none';
    }
}

function highlightCurrentPlan(tier) {
    // Wait for render
    setTimeout(() => {
        document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('active-plan'));

        const cardId = `plan-${tier}`;
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.add('active-plan');
            const btn = card.querySelector('button');
            if (btn) {
                btn.innerText = 'الخطة الحالية';
                btn.disabled = true;
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-outline');
            }
        }
    }, 500); // Small delay to ensure renderPackages finished
}

// Global Scope for Button Click
window.initiateSubscription = async (planKey, planTitle, price) => {
    // Manual Payment Flow (WhatsApp)

    // 1. Show Instructions Modal
    const confirmed = await UIManager.showConfirm(
        `الاشتراك في ${planTitle}`,
        `لتفعيل الاشتراك، يرجى تحويل مبلغ **${price} ج.م** عبر فودافون كاش.\n\nسيتم توجيهك الآن إلى الواتساب لإرسال طلب الاشتراك وتفاصيل التحويل للمسؤول.\n\nهل تريد المتابعة؟`,
        "نعم، تواصل واتساب",
        "إلغاء"
    );

    if (!confirmed) return;

    // 2. Prepare WhatsApp Message
    const teacherName = currentUser.displayName || currentTeacherDoc.name || "معلم";
    const teacherEmail = currentUser.email;
    const teacherPhone = currentTeacherDoc.phoneNumber || currentTeacherDoc.phone || "غير مسجل";

    const message = `مرحباً، أود الاشتراك في *${planTitle}*.\n\n` +
        `👤 *الاسم:* ${teacherName}\n` +
        `📧 *البريد:* ${teacherEmail}\n` +
        `📱 *الهاتف:* ${teacherPhone}\n` +
        `💰 *الباقة:* ${planTitle} (${price} ج.م)\n\n` +
        `يرجى تزويدي برقم فودافون كاش لإتمام التحويل.`;

    const encodedMsg = encodeURIComponent(message);
    const waUrl = `https://wa.me/${SUPPORT_PHONE}?text=${encodedMsg}`;

    // 3. Open WhatsApp
    window.open(waUrl, '_blank');
};
