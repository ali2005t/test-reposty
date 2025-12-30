import { db } from '../firebase-config.js';
import { collection, query, where, getDocs, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tab Switching Logic
function switchTab(tabName) {
    const walletTab = document.getElementById('wallet-tab');
    const analysisTab = document.getElementById('analysis-tab');
    const btnWallet = document.getElementById('tab-wallet');
    const btnAnalysis = document.getElementById('tab-analysis');

    if (tabName === 'wallet') {
        walletTab.style.display = 'block';
        analysisTab.style.display = 'none';
        btnWallet.style.borderBottomColor = '#6366f1';
        btnWallet.style.color = 'white';
        btnAnalysis.style.borderBottomColor = 'transparent';
        btnAnalysis.style.color = '#94a3b8';
    } else {
        walletTab.style.display = 'none';
        analysisTab.style.display = 'block';
        btnAnalysis.style.borderBottomColor = '#6366f1';
        btnAnalysis.style.color = 'white';
        btnWallet.style.borderBottomColor = 'transparent';
        btnWallet.style.color = '#94a3b8';
    }
}

// Attach Event Listeners
document.getElementById('tab-wallet')?.addEventListener('click', () => switchTab('wallet'));
document.getElementById('tab-analysis')?.addEventListener('click', () => switchTab('analysis'));

document.getElementById('run-report-btn')?.addEventListener('click', generateTeacherReport);

async function generateTeacherReport() {
    const tbody = document.getElementById('teacher-report-body');
    const dateInput = document.getElementById('report-date').value;

    if (!dateInput) {
        alert("الرجاء اختيار تاريخ");
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">جاري الحساب... قد يستغرق لحظات</td></tr>';

    try {
        // 1. Get All Teachers
        const teachersSnap = await getDocs(collection(db, "teachers"));
        const teachers = [];
        teachersSnap.forEach(t => teachers.push({ id: t.id, ...t.data() }));

        // 2. Define Time Range for the selected Date
        const startDate = new Date(dateInput);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(dateInput);
        endDate.setHours(23, 59, 59, 999);

        const startTs = Timestamp.fromDate(startDate);
        const endTs = Timestamp.fromDate(endDate);

        // 3. Query Codes generated in this range (Type=invoice usually means charged to student, but here we check 'access_codes' generally or 'invoices')
        // The user asked "How many codes generated".
        // We query 'access_codes' collection.
        // Needs Index: createdBy + createdAt

        // Optimization: Fetch ALL codes for this day, then group by Creator (Teacher) in JS to avoid N queries.
        // Assuming 'createdBy' field exists on codes.

        const codesQuery = query(
            collection(db, "access_codes"),
            where("createdAt", ">=", startTs),
            where("createdAt", "<=", endTs)
        );

        const codesSnap = await getDocs(codesQuery);
        const codesByTeacher = {};

        codesSnap.forEach(doc => {
            const d = doc.data();
            const teacherId = d.createdBy; // Assuming teacher ID is here
            if (!codesByTeacher[teacherId]) {
                codesByTeacher[teacherId] = { count: 0, value: 0 };
            }
            codesByTeacher[teacherId].count++;
            codesByTeacher[teacherId].value += Number(d.value || 0);
        });

        // 4. Render
        tbody.innerHTML = '';
        let totalPlatformProfit = 0;

        teachers.forEach(t => {
            const stats = codesByTeacher[t.id] || { count: 0, value: 0 };

            // Calc Platform Profit (simplified logic: e.g. 10% or fixed subscription)
            // User asked: "Calculate his cost".
            // If subscription is monthly, daily cost = Subscription / 30.
            let subCost = 0;
            if (t.subscription && t.subscription.price) {
                subCost = (t.subscription.price / 30).toFixed(2);
            }

            // Only show active teachers or those who generated codes
            if (stats.count === 0 && subCost == 0) return;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${t.name}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${t.email}</div>
                </td>
                <td>
                    <span class="badge ${t.subscription?.status === 'active' ? 'badge-success' : 'badge-warning'}">
                        ${t.subscription?.tier || 'Free'}
                    </span>
                </td>
                <td style="text-align:center;">${stats.count}</td>
                <td style="text-align:center;">${stats.value} ج.م</td>
                <td style="text-align:center; color:#10b981;">
                     ${subCost > 0 ? `+${subCost} ج.م (Sub)` : '0'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (tbody.children.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد بيانات لهذا اليوم</td></tr>';
        }

    } catch (error) {
        console.error("Report Error:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">خطأ: ${error.message} <br> تأكد من وجود Index (createdAt)</td></tr>`;
    }
}
