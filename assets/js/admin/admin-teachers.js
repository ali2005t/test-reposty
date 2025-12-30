import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ... (Rest of file wrapper) ...

// AFTER loadTeachers, BEFORE Toggle/Delete functions:

// Save Assignment Logic
const saveAssignBtn = document.getElementById('save-assignment-btn');
if (saveAssignBtn) {
    saveAssignBtn.onclick = async () => {
        const tid = document.getElementById('assign-teacher-id').value;
        const agentId = document.getElementById('agent-select').value;
        const select = document.getElementById('agent-select');
        const agentName = select.options[select.selectedIndex].text.split('(')[0].trim(); // Extract name

        if (!tid) return;

        saveAssignBtn.disabled = true;
        saveAssignBtn.innerText = 'جاري الحفظ...';

        try {
            // 1. Get old assignment to clean up
            const tDoc = await getDoc(doc(db, "teachers", tid));
            const tData = tDoc.data();
            const oldAgentId = tData ? tData.assignedAgentId : null;

            // 2. Remove from old agent if different
            if (oldAgentId && oldAgentId !== agentId) {
                // Ensure doc exists before update (robustness)
                // We'll skip check for speed, firestore handles standard updates fine usually.
                await updateDoc(doc(db, "admins", oldAgentId), {
                    assignedTeachers: arrayRemove(tid)
                }).catch(e => console.warn("Old agent update failed", e));
            }

            // 3. Update Teacher Doc
            await updateDoc(doc(db, "teachers", tid), {
                assignedAgentId: agentId || null,
                assignedAgentName: agentId ? agentName : null
            });

            // 4. Add to new agent
            if (agentId) {
                await updateDoc(doc(db, "admins", agentId), {
                    assignedTeachers: arrayUnion(tid)
                });
            }

            alert("تم تحديث التعيين بنجاح");
            document.getElementById('assign-agent-modal').style.display = 'none';
            loadTeachers(); // Refresh list

        } catch (e) {
            console.error(e);
            alert("حدث خطأ: " + e.message);
        } finally {
            saveAssignBtn.disabled = false;
            saveAssignBtn.innerText = 'حفظ التعيين';
        }
    };
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check admin logic here or rely on specific UI hiding
        loadTeachers();
    } else {
        window.location.href = 'login.html';
    }
});

// RBAC Check
const adminRole = sessionStorage.getItem('admin_role');
const adminPerms = JSON.parse(sessionStorage.getItem('admin_permissions') || '[]');
const assignedTeachers = JSON.parse(sessionStorage.getItem('admin_assigned_teachers') || '[]');

async function loadTeachers() {
    const tbody = document.getElementById('teachers-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const q = query(collection(db, "teachers"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5">No teachers found</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();

            // RBAC Filter: If Agent, only show assigned teachers
            if (adminRole !== 'super_admin' && assignedTeachers.length > 0 && !assignedTeachers.includes(docSnap.id)) {
                return;
            }

            const tr = document.createElement('tr');

            const isVerified = data.isVerified;
            const statusBadge = isVerified ?
                '<span class="status-badge status-active">Verified</span>' :
                '<span class="status-badge status-draft">Pending</span>';

            // Date Formatting
            let dateStr = '-';
            if (data.createdAt) {
                const date = data.createdAt.toDate();
                dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
            }

            // Action Buttons Wrapper (Dropdown)
            let actions = `
            <div class="dropdown">
                <button class="dropdown-toggle" onclick="toggleDropdown(event, '${docSnap.id}')">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
                <div id="dropdown-${docSnap.id}" class="dropdown-menu">
            `;

            // 0. View Profile (Everyone)
            actions += `<button class="action-btn-text" onclick="openViewProfileModal('${docSnap.id}')">
                <i class="fas fa-eye" style="color:#60a5fa;"></i> عرض الملف
            </button>`;

            // 0.5 Financials
            actions += `<button class="action-btn-text" onclick="openFinancialsModal('${docSnap.id}')">
                <i class="fas fa-coins" style="color:#f59e0b;"></i> المالية
            </button>`;

            // 1. Verify/Suspend
            if (adminRole === 'super_admin') {
                if (isVerified) {
                    actions += `<button class="action-btn-text" onclick="toggleVerify('${docSnap.id}', false)">
                        <i class="fas fa-ban" style="color:#ef4444;"></i> حظر الحساب
                    </button>`;
                } else {
                    actions += `<button class="action-btn-text" onclick="toggleVerify('${docSnap.id}', true)">
                        <i class="fas fa-check" style="color:#10b981;"></i> تفعيل الحساب
                    </button>`;
                }
            }

            // 2. View As Teacher (Impersonate)
            if (adminRole === 'super_admin' || adminPerms.includes('impersonate')) {
                actions += `<button class="action-btn-text" onclick="loginAsTeacher('${docSnap.id}')">
                    <i class="fas fa-user-secret" style="color:#818cf8;"></i> دخول كمعلم
                </button>`;
            }

            // 3. Subscription Management
            if (adminRole === 'super_admin' || adminPerms.includes('financials')) {
                actions += `<button class="action-btn-text" onclick="openSubscriptionModal('${docSnap.id}')">
                    <i class="fas fa-file-invoice-dollar" style="color:#f59e0b;"></i> إدارة الاشتراك
                </button>`;
            }

            // 4. Assign Agent (Super Admin Only)
            if (adminRole === 'super_admin') {
                actions += `<button class="action-btn-text" onclick="openAssignModal('${docSnap.id}', '${data.name}')">
                    <i class="fas fa-user-tag" style="color:#3b82f6;"></i> تعيين مساعد
                </button>`;
            }

            // 5. Delete
            if (adminRole === 'super_admin') {
                actions += `<hr style="margin:4px 0; border:0; border-top:1px solid #334155;">`;
                actions += `<button class="action-btn-text" onclick="deleteTeacher('${docSnap.id}')">
                    <i class="fas fa-trash" style="color:#ef4444;"></i> حذف نهائي
                </button>`;
            }

            actions += `</div></div>`;

            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${data.name}</div>
                    <div style="font-size:0.8rem;">${data.phone || '-'}</div>
                     ${data.assignedAgentName ? `<div style="font-size:0.7rem; color:#10b981; margin-top:2px;"><i class="fas fa-shield-alt"></i> ${data.assignedAgentName}</div>` : ''}
                </td>
                <td>${data.email}</td>
                <td>${data.platformName || '-'}</td>
                <td>${statusBadge}</td>
                <td style="font-size:0.85rem; color:#cbd5e1;">${dateStr}</td>
                <td>
                    ${actions}
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5">Error loading teachers</td></tr>';
    }
}

// Global Actions
// Global Actions
window.openAssignModal = async (tid, tName) => {
    // We need to inject the modal or find it.
    // Expect the HTML to be there.
    const modal = document.getElementById('assign-agent-modal');
    if (!modal) return alert("Missing Modal HTML");

    document.getElementById('assign-teacher-id').value = tid;
    document.getElementById('assign-modal-title').innerText = `تعيين مساعد للمعلم: ${tName}`;

    // Load Agents
    const select = document.getElementById('agent-select');
    select.innerHTML = '<option>جاري التحميل...</option>';

    const q = query(collection(db, "admins"), where("role", "!=", "super_admin")); // Only assistants
    const snap = await getDocs(q);

    select.innerHTML = '<option value="">بدون مساعد (إلغاء التعيين)</option>';
    snap.forEach(doc => {
        const d = doc.data();
        select.innerHTML += `<option value="${doc.id}">${d.name} (${d.email})</option>`;
    });

    modal.style.display = 'flex';
};

window.openSubscriptionModal = (tid) => {
    document.getElementById('sub-teacher-id').value = tid;
    document.getElementById('subscription-modal').style.display = 'flex';
    updateSubPrice();
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
        // Tier Names Mapping
        const tierLabels = { 'basic': 'Starter', 'pro': 'Pro', 'elite': 'Elite' }; // Matches your design

        let planLabel = '';

        if (duration === 'trial') {
            endDate.setDate(endDate.getDate() + 14);
            planLabel = `تجريبي (${tierLabels[tier]})`;
        } else {
            const months = parseInt(duration);
            endDate.setMonth(endDate.getMonth() + months);
            planLabel = `${tierLabels[tier]} - ${months} شهر`;
        }

        const { setDoc, Timestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        const subData = {
            teacherId: tid,
            plan: tier, // Store key (basic, pro, elite) for logic
            planLabel: planLabel, // Display text
            startDate: Timestamp.now(),
            endDate: Timestamp.fromDate(endDate),
            isActive: true,
            pricePaid: parseFloat(price),
            updatedToByAdmin: true,
            updatedAt: Timestamp.now()
        };

        await setDoc(doc(db, "subscriptions", tid), subData);

        // Update Teacher Doc Flag AND Plan Details (Redundancy)
        await updateDoc(doc(db, "teachers", tid), {
            hasActiveSubscription: true,
            subscriptionStatus: 'active',
            subscriptionEnd: subData.endDate,
            planTier: tier,
            planLabel: planLabel
        });

        alert(`تم تفعيل الاشتراك بنجاح\nالنوع: ${planLabel}\nالسعر: ${price} ج.م`);
        document.getElementById('subscription-modal').style.display = 'none';

        // Refresh to show any changes if we display sub status in table
        loadTeachers();

    } catch (e) {
        console.error(e);
        alert('خطأ: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'تفعيل الاشتراك';
    }
};

window.toggleVerify = async (id, status) => {
    const confirmed = await UIManager.showConfirm(
        status ? 'تفعيل حساب' : 'تعليق حساب',
        status ? "هل أنت متأكد من تفعيل هذا المعلم؟ (سيتم تفعيل الباقة التجريبية تلقائياً)" : "هل أنت متأكد من تعليق هذا المعلم؟",
        status ? 'تفعيل' : 'تعليق'
    );

    if (!confirmed) return;

    try {
        await updateDoc(doc(db, "teachers", id), {
            isVerified: status,
            status: status ? 'active' : 'suspended'
        });

        // Auto-Activate Trial on Verification
        if (status) {
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 14);

            const { setDoc, Timestamp } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

            await setDoc(doc(db, "subscriptions", id), {
                teacherId: id,
                plan: 'trial',
                planLabel: 'باقة تجريبية (تفعيل تلقائي)',
                startDate: Timestamp.now(),
                endDate: Timestamp.fromDate(endDate),
                isActive: true,
                pricePaid: 0,
                createdAt: Timestamp.now()
            });

            await updateDoc(doc(db, "teachers", id), {
                hasActiveSubscription: true,
                subscriptionStatus: 'active',
                subscriptionEnd: Timestamp.fromDate(endDate),
                planTier: 'trial',
                planLabel: 'باقة تجريبية (تفعيل تلقائي)'
            });
            UIManager.showToast('تم تفعيل الحساب والباقة التجريبية بنجاح');
        } else {
            UIManager.showToast('تم تعليق الحساب بنجاح');
        }

        loadTeachers();
    } catch (e) {
        UIManager.showToast("خطأ: " + e.message, "error");
    }
};

window.deleteTeacher = async (id) => {
    const confirmed = await UIManager.showConfirm(
        'حذف معلم',
        "هل أنت متأكد؟ سيتم حذف حساب المعلم نهائياً.",
        'حذف',
        'إلغاء'
    );

    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "teachers", id));
        loadTeachers();
        UIManager.showToast('تم حذف المعلم بنجاح');
    } catch (e) {
        UIManager.showToast("خطأ: " + e.message, "error");
    }
};

window.openViewProfileModal = async (tid) => {
    console.log("Opening profile for:", tid);

    // Close any open dropdowns first
    document.querySelectorAll('.dropdown-menu.show').forEach(el => el.classList.remove('show'));

    let modal = document.getElementById('view-profile-modal');
    if (!modal) {
        console.error("Modal not found in DOM");
        alert("خطأ: نافذة الملف الشخصي غير موجودة، حاول تحديث الصفحة.");
        return;
    }

    // Force visibility using cssText to override everything
    modal.style.cssText = `
        display: flex !important; 
        position: fixed !important; 
        top: 0 !important; 
        left: 0 !important; 
        width: 100% !important; 
        height: 100% !important; 
        z-index: 10000 !important; 
        background: rgba(0,0,0,0.8) !important; 
        justify-content: center !important; 
        align-items: center !important; 
        visibility: visible !important; 
        opacity: 1 !important;
    `;

    console.log("Modal forced visible with cssText");

    // Reset UI
    document.getElementById('vp-name').innerText = 'جاري التحميل...';
    document.getElementById('vp-uid').innerText = tid;
    document.getElementById('vp-email').innerText = '...';
    document.getElementById('vp-platform').innerText = '...';
    document.getElementById('vp-phone').innerText = '...';
    document.getElementById('vp-password').innerText = '***';
    document.getElementById('vp-link').value = '';
    document.getElementById('vp-avatar').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    document.getElementById('vp-referred-by').innerText = '...';
    document.getElementById('vp-referral-count').innerText = '...';
    document.getElementById('vp-referral-toggle').checked = false;
    document.getElementById('vp-referral-toggle').onchange = null; // Clear old listener

    try {
        const docSnap = await getDoc(doc(db, "teachers", tid));

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('vp-name').innerText = data.name || 'بدون اسم';
            document.getElementById('vp-email').innerText = data.email || '-';
            document.getElementById('vp-platform').innerText = data.platformName || '-';
            document.getElementById('vp-phone').innerText = data.phone || '-';

            // Password Check
            if (data.password) {
                document.getElementById('vp-password').innerText = data.password;
            } else {
                document.getElementById('vp-password').innerText = 'مشفر (Secure)';
            }

            // Student App Link Construction
            const absoluteBase = new URL('../student-app/index.html', window.location.href).href;
            let finalLink = absoluteBase;

            if (data.uniqueName || data.slug) {
                finalLink += `/#/${data.uniqueName || data.slug}`;
            } else {
                finalLink += `?t=${tid}`;
            }

            document.getElementById('vp-link').value = finalLink;
            document.getElementById('vp-link-go').href = finalLink;

            // Avatar
            if (data.profileImage) {
                document.getElementById('vp-avatar').innerHTML = `<img src="${data.profileImage}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
            } else {
                document.getElementById('vp-avatar').innerHTML = (data.name ? data.name[0] : 'T').toUpperCase();
            }
            // Referral Logic
            // A. Checked State
            const refToggle = document.getElementById('vp-referral-toggle');
            refToggle.checked = data.referralEnabled === true;

            // B. Listener
            refToggle.onchange = async (e) => {
                const newState = e.target.checked;
                try {
                    await updateDoc(doc(db, "teachers", tid), {
                        referralEnabled: newState
                    });
                    // Optional: Toast
                    console.log("Referral status updated:", newState);
                } catch (err) {
                    console.error("Failed to update referral status", err);
                    e.target.checked = !newState; // revert
                    alert("فشل التحديث");
                }
            };

            // C. Referred By
            if (data.referredBy) {
                // Fetch referrer name
                getDoc(doc(db, "teachers", data.referredBy)).then(rSnap => {
                    if (rSnap.exists()) {
                        document.getElementById('vp-referred-by').innerHTML = `<a href="#" onclick="openViewProfileModal('${rSnap.id}')" style="color:#60a5fa;">${rSnap.data().name}</a>`;
                    } else {
                        document.getElementById('vp-referred-by').innerText = 'مستخدم محذوف';
                    }
                });
            } else {
                document.getElementById('vp-referred-by').innerText = 'تسجيل مباشر';
            }

            // D. Count Referrals
            const countQ = query(collection(db, "teachers"), where("referredBy", "==", tid));
            getDocs(countQ).then(snap => {
                document.getElementById('vp-referral-count').innerText = snap.size + " معلم";
            });

        } else {
            document.getElementById('vp-name').innerText = 'معلم غير موجود';
        }
    } catch (e) {
        console.error("Profile Load Error", e);
        document.getElementById('vp-name').innerText = 'خطأ في التحميل';
    }
};


// --- Financials Logic ---
window.openFinancialsModal = async (tid) => {
    // Close other dropdowns
    document.querySelectorAll('.dropdown-menu.show').forEach(el => el.classList.remove('show'));

    const modal = document.getElementById('financials-modal');
    if (!modal) return;

    document.getElementById('fin-teacher-id').value = tid;
    document.getElementById('fin-history-body').innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري التحميل...</td></tr>';

    // Force show
    modal.style.cssText = `display: flex !important; position: fixed !important; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000; background: rgba(0,0,0,0.8); justify-content: center; align-items: center; visibility: visible !important; opacity: 1 !important;`;

    await loadFinancialHistory(tid);
};

async function loadFinancialHistory(tid) {
    const tbody = document.getElementById('fin-history-body');
    try {
        const q = query(
            collection(db, "financial_transactions"),
            where("teacherId", "==", tid),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">لا توجد معاملات سابقة</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString('ar-EG') : '-';

            let typeBadge = '';
            if (data.type === 'invoice') typeBadge = '<span class="status-badge" style="background:#e0e7ff; color:#4338ca;">فاتورة</span>';
            else if (data.type === 'payment') typeBadge = '<span class="status-badge" style="background:#dcfce7; color:#166534;">إضافة (له)</span>';
            else if (data.type === 'deduction') typeBadge = '<span class="status-badge" style="background:#fee2e2; color:#991b1b;">خصم (عليه)</span>';

            tbody.innerHTML += `
                <tr>
                    <td>${typeBadge}</td>
                    <td style="font-weight:bold; direction:ltr;">${data.amount}</td>
                    <td>${data.reason}</td>
                    <td>${date}</td>
                    <td style="font-size:0.8rem; color:#64748b;">${data.createdBy || 'System'}</td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Error loading financials:", e);
        if (e.code === 'failed-precondition') {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#f59e0b;">يجب إنشاء Index في فايربيس أولاً (راجع الكونسول)</td></tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">خطأ في التحميل</td></tr>';
        }
    }
}

// Add Transaction Form
const addFinForm = document.getElementById('add-transaction-form');
if (addFinForm) {
    addFinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tid = document.getElementById('fin-teacher-id').value;
        const type = document.getElementById('fin-type').value;
        const amount = parseFloat(document.getElementById('fin-amount').value);
        const reason = document.getElementById('fin-reason').value;
        const btn = document.getElementById('fin-submit-btn');

        if (!tid || !amount || !reason) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            await addDoc(collection(db, "financial_transactions"), {
                teacherId: tid,
                type: type,
                amount: amount,
                reason: reason,
                status: 'completed', // Admin actions are auto-completed usually
                createdAt: serverTimestamp(),
                createdBy: 'admin'
            });

            // Refresh list & Reset form
            document.getElementById('fin-amount').value = '';
            document.getElementById('fin-reason').value = '';
            await loadFinancialHistory(tid);
            alert("تمت الإضافة بنجاح");

        } catch (error) {
            console.error("Add Transaction Error:", error);
            alert("حدث خطأ: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> إضافة';
        }
    });
}


// Dropdown Toggle Logic
window.toggleDropdown = (e, id) => {
    e.stopPropagation();

    // 1. Find the target dropdown
    const targetId = `dropdown-${id}`;
    const targetMenu = document.getElementById(targetId);

    // 2. Close ALL other dropdowns
    document.querySelectorAll('.dropdown-menu.show').forEach(el => {
        if (el.id !== targetId) el.classList.remove('show');
    });

    // 3. Toggle this one
    if (targetMenu) {
        targetMenu.classList.toggle('show');
    }
};

// Close dropdowns when clicking anywhere outside
document.addEventListener('click', (e) => {
    // If click is NOT inside a dropdown toggle or menu, close all
    if (!e.target.closest('.dropdown-toggle') && !e.target.closest('.dropdown-menu')) {
        document.querySelectorAll('.dropdown-menu.show').forEach(el => el.classList.remove('show'));
    }
});
