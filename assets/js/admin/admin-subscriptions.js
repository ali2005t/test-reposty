import { db, auth } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    Timestamp,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Auth check
        loadSubscriptions();
    } else {
        window.location.href = 'login.html';
    }
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'login.html');
});

let allTeachers = [];

async function loadSubscriptions() {
    const tbody = document.getElementById('subs-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">جاري التحميل...</td></tr>';

    try {
        const q = query(collection(db, "teachers"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);

        allTeachers = [];

        snap.forEach(docSnap => {
            allTeachers.push({ id: docSnap.id, ...docSnap.data() });
        });

        renderTable(allTeachers);

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">خطأ في تحميل البيانات</td></tr>';
    }
}

function renderTable(teachers) {
    const tbody = document.getElementById('subs-table-body');
    const search = document.getElementById('search-sub')?.value.toLowerCase() || '';

    tbody.innerHTML = '';

    const filtered = teachers.filter(t => t.name.toLowerCase().includes(search));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد نتائج</td></tr>';
        return;
    }

    filtered.forEach(t => {
        const tr = document.createElement('tr');

        // Robust Plan Data
        const planLabel = t.planLabel || t.planTier || (t.subscriptionPlan === 'free_trial' ? 'تجريبي' : 'أساسية');
        let expiryDateStr = '-';
        let status = 'غير مفعل';
        let badgeClass = 'sub-expired';

        // Check Date
        let endDateSrc = t.subscriptionEnd || t.subscriptionEndsAt;

        if (endDateSrc) {
            const endsAt = endDateSrc.toDate ? endDateSrc.toDate() : new Date(endDateSrc);
            expiryDateStr = endsAt.toLocaleDateString('ar-EG');
            const now = new Date();

            if (endsAt > now) {
                // Check status flag
                if (t.subscriptionStatus === 'active' || t.hasActiveSubscription) {
                    status = 'نشط';
                    badgeClass = 'sub-active';
                } else {
                    status = 'معلق';
                    badgeClass = 'sub-trial';
                }

                if (t.planTier === 'trial' || t.subscriptionPlan === 'free_trial') {
                    status = 'تجريبي';
                    badgeClass = 'sub-trial';
                }

            } else {
                status = 'منتهي';
                badgeClass = 'sub-expired';
            }
        }

        tr.innerHTML = `
            <td style="font-weight:bold;">${t.name}<div style="font-size:0.8rem; font-weight:normal; color:#94a3b8;">${t.email}</div></td>
            <td><span class="sub-badge" style="background:#1e293b; border:1px solid #334155;">${planLabel}</span></td>
            <td>${expiryDateStr}</td>
            <td><span class="sub-badge ${badgeClass}">${status}</span></td>
            <td>${t.totalPaid ? t.totalPaid + ' ج.م' : '-'}</td>
            <td>
                <button class="btn-icon" onclick="openSubscriptionModal('${t.id}')" title="تعديل الاشتراك" style="color:#3b82f6;">
                    <i class="fas fa-edit"></i> تعديل
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Global Modal Functions
window.openSubscriptionModal = (tid) => {
    document.getElementById('sub-teacher-id').value = tid;
    document.getElementById('subscription-modal').style.display = 'flex';
    if (window.updateSubPrice) window.updateSubPrice();
};

window.updateSubPrice = () => {
    const duration = document.getElementById('sub-duration').value;
    const tier = document.getElementById('sub-plan-tier').value;
    const priceInput = document.getElementById('sub-price');

    // Base Monthly Prices
    const basePrices = {
        'basic': 199,
        'pro': 599,
        'elite': 999
    };

    if (duration === 'trial') {
        priceInput.value = 0;
        return;
    }

    const months = parseInt(duration);
    let total = basePrices[tier] * months;

    // Apply some bulk discounts
    if (months >= 12) total = total * 0.8; // 20% off yearly
    else if (months >= 6) total = total * 0.9; // 10% off 6-months

    priceInput.value = Math.floor(total);
};

// Add listener to tier too
document.getElementById('sub-plan-tier')?.addEventListener('change', window.updateSubPrice);

window.saveSubscription = async () => {
    const btn = document.getElementById('save-sub-btn');
    const tid = document.getElementById('sub-teacher-id').value;
    const duration = document.getElementById('sub-duration').value;
    const tier = document.getElementById('sub-plan-tier').value;
    const price = document.getElementById('sub-price').value;

    if (!tid) return;

    btn.disabled = true;
    btn.innerText = 'جاري التفعيل...';

    try {
        let endDate = new Date();
        const tierLabels = { 'basic': 'Starter', 'pro': 'Pro', 'elite': 'Elite' };

        let planLabel = '';

        if (duration === 'trial') {
            endDate.setDate(endDate.getDate() + 14);
            planLabel = `تجريبي (${tierLabels[tier]})`;
        } else {
            const months = parseInt(duration);
            endDate.setMonth(endDate.getMonth() + months);
            planLabel = `${tierLabels[tier]} - ${months} شهر`;
        }

        const subData = {
            teacherId: tid,
            plan: tier,
            planLabel: planLabel,
            startDate: Timestamp.now(),
            endDate: Timestamp.fromDate(endDate),
            isActive: true,
            pricePaid: parseFloat(price),
            updatedToByAdmin: true,
            updatedAt: Timestamp.now()
        };

        // 1. Create Sub Doc
        await setDoc(doc(db, "subscriptions", tid), subData);

        // 2. Update Teacher Doc
        await updateDoc(doc(db, "teachers", tid), {
            hasActiveSubscription: true,
            subscriptionStatus: 'active',
            subscriptionEnd: subData.endDate,
            planTier: tier,
            planLabel: planLabel
        });

        alert(`تم تفعيل الاشتراك بنجاح\nالنوع: ${planLabel}\nالسعر: ${price} ج.م`);
        document.getElementById('subscription-modal').style.display = 'none';

        loadSubscriptions();

    } catch (e) {
        console.error(e);
        alert('خطأ: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تفعيل الاشتراك';
    }
};

document.getElementById('search-sub')?.addEventListener('keyup', () => renderTable(allTeachers));
