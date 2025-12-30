import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initHeader } from '../header-manager.js';
import { getEffectiveUserUid } from '../impersonation-manager.js';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        initHeader(user);
        const effectiveUid = await getEffectiveUserUid(user);
        if (effectiveUid) {
            initFinancials(effectiveUid);
        }
    } else {
        window.location.href = '../auth/login.html';
    }
});

async function initFinancials(uid) {
    // Determine Page Type
    const path = window.location.pathname;

    if (path.includes('invoices.html')) {
        loadInvoices(uid);
    } else if (path.includes('permissions.html')) {
        loadPermissions(uid);
    }
}

function loadInvoices(uid) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">جاري التحميل...</td></tr>';

    const q = query(
        collection(db, "financial_transactions"),
        where("teacherId", "==", uid),
        where("type", "==", "invoice"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">لا توجد فواتير حالياً</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString('ar-EG') : '-';
            const time = data.createdAt ? data.createdAt.toDate().toLocaleTimeString('ar-EG') : '';

            // Status Logic (Simple for now)
            const status = data.status === 'completed' || data.status === 'paid'
                ? '<span class="status-badge" style="background:#dcfce7; color:#166534;">مدفوعة</span>'
                : '<span class="status-badge" style="background:#e0e7ff; color:#4338ca;">بانتظار الدفع</span>';

            // Calculations (Mocking deduction/additions logic if needed, or just raw amount)
            // For now, we assume Amount is Final.

            tbody.innerHTML += `
                <tr>
                    <td>#${doc.id.slice(0, 6)}</td>
                    <td>${status}</td>
                    <td>${data.amount}</td>
                    <td>0.00</td> <!-- Discount -->
                    <td>0.00</td> <!-- Addition -->
                    <td>${date} ${time}</td>
                    <td><i class="fas fa-ellipsis-v" style="cursor:pointer; color:#94a3b8;"></i></td>
                </tr>
            `;
        });
    }, (error) => {
        console.error("Invoices Error:", error);
        if (error.code === 'failed-precondition') {
            console.log("INDEX LINK:", error.message);
        }
    });
}

function loadPermissions(uid) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري التحميل...</td></tr>';

    // We fetch both payments (additions) and deductions
    const q = query(
        collection(db, "financial_transactions"),
        where("teacherId", "==", uid),
        where("type", "in", ["payment", "deduction"]),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد أذونات حالياً</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const typeLabel = data.type === 'payment'
                ? '<span class="status-badge" style="background:#dbeafe; color:#1e40af;">(إضافة) له</span>'
                : '<span class="status-badge" style="background:#fce7f3; color:#9d174d;">(خصم) عليه</span>';

            const statusLabel = '<span class="status-badge" style="background:#e0e7ff; color:#4338ca;">مكتملة</span>';

            tbody.innerHTML += `
                <tr>
                    <td>#${doc.id.slice(0, 4)}</td>
                    <td>${statusLabel}</td>
                    <td>${typeLabel}</td>
                    <td style="font-weight:bold;">${data.amount}</td>
                    <td>${data.reason}</td>
                </tr>
            `;
        });
    }, (error) => {
        console.error("Permissions Error:", error);
        if (error.code === 'failed-precondition') {
            console.log("INDEX LINK:", error.message);
        }
    });
}
