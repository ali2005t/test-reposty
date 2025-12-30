import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initAdminUI } from './admin-ui.js';

// Basic Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Init UI
        initAdminUI('المالية والمحفظة');
        // loadCodes
        loadCodes();
    } else {
        window.location.href = 'login.html';
    }
});

// Logout
document.getElementById('logout-btn')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'login.html');
});


let currentCodes = [];

// Load Codes
async function loadCodes() {
    const tbody = document.getElementById('codes-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';

    try {
        // Query "access_codes" where type == 'wallet'
        const q = query(
            collection(db, "access_codes"),
            where("type", "==", "wallet"),
            orderBy("createdAt", "desc"),
            limit(50)
        );

        const snap = await getDocs(q);
        currentCodes = [];

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد أكواد محفظة</td></tr>';
            return;
        }

        snap.forEach(doc => {
            currentCodes.push({ id: doc.id, ...doc.data() });
        });

        renderTable(currentCodes);
        calculateRevenue(); // New function

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">خطأ: ربما تحتاج لإنشاء Index في Firestore (type + createdAt)</td></tr>';
    }
}

function renderTable(codes) {
    const tbody = document.getElementById('codes-table-body');
    const search = document.getElementById('search-code')?.value.toLowerCase() || '';

    tbody.innerHTML = '';

    const filtered = codes.filter(c => c.code.toLowerCase().includes(search));

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد نتائج</td></tr>';
        return;
    }

    filtered.forEach(c => {
        const tr = document.createElement('tr');
        const status = c.isUsed ? '<span class="badge badge-warning">مستخدم</span>' : '<span class="badge badge-success">متاح</span>';
        const date = c.createdAt ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '-';
        const expiry = c.expiryDate || '-';

        tr.innerHTML = `
            <td style="font-family:monospace; direction:ltr; text-align:right;">${c.code}</td>
            <td>${c.value || c.amount || 0} ج.م</td>
            <td>${status}</td>
            <td>${date}</td>
            <td>${expiry}</td>
            <td>
                <button class="btn-icon danger" onclick="deleteCode('${c.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Generate
document.getElementById('generate-wallet-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('gen-btn');
    btn.disabled = true;
    btn.innerText = "جاري التوليد...";

    const amount = Number(document.getElementById('code-amount').value);
    const count = Number(document.getElementById('code-count').value);
    const expiry = document.getElementById('code-expiry').value;

    const newCodes = [];

    try {
        const batchPromises = [];
        for (let i = 0; i < count; i++) {
            const codeStr = generateRandomString(12);
            const data = {
                code: codeStr,
                type: 'wallet',
                value: amount, // Logic uses 'value' for wallet topup usually
                isUsed: false,
                createdAt: serverTimestamp(),
                createdBy: auth.currentUser.uid,
                expiryDate: expiry || null
            };
            // Add directly (Batch is better but loop addDoc OK for small nums)
            batchPromises.push(addDoc(collection(db, "access_codes"), data).then(ref => ({ id: ref.id, ...data })));
        }

        const results = await Promise.all(batchPromises);

        // Prepare Print
        preparePrint(results);
        document.getElementById('print-codes-btn').style.display = 'inline-block';
        document.getElementById('print-codes-btn').onclick = () => window.print();

        alert(`تم توليد ${count} كود بنجاح`);
        loadCodes(); // Refresh list

    } catch (err) {
        console.error(err);
        alert("خطأ في التوليد");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cogs"></i> توليد الأكواد';
    }
});


function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result.match(/.{1,4}/g).join('-');
}

window.deleteCode = async (id) => {
    if (!confirm("حذف هذا الكود؟")) return;
    try {
        await deleteDoc(doc(db, "access_codes", id));
        loadCodes();
    } catch (e) { console.error(e); }
};

document.getElementById('search-code')?.addEventListener('keyup', () => renderTable(currentCodes));


// Printing Logic (Simplified)
function preparePrint(codes) {
    const area = document.getElementById('print-area');
    if (!area) return;
    area.innerHTML = '';

    // Use card style
    // We need print.css loaded. (It is not loaded in admin/financials.html? I should check) I didn't add it.
    // I should add print.css to financials.html or inline styles.

    codes.forEach(c => {
        const card = document.createElement('div');
        card.className = 'print-card';
        // Basic Style if css missing
        card.style.border = '2px dashed #000';
        card.style.padding = '20px';
        card.style.margin = '10px';
        card.style.pageBreakInside = 'avoid';
        card.style.width = '300px';
        card.style.display = 'inline-block';
        card.style.textAlign = 'center';

        card.innerHTML = `
            <h3>Ta3leemy Wallet Code</h3>
            <h2>${c.value} EGP</h2>
            <h1 style="font-family:monospace; font-size:1.5rem; margin:10px 0;">${c.code}</h1>
            <p>Use this code to charge your wallet.</p>
        `;
    });
}

// Revenue Logic
async function calculateRevenue() {
    try {
        const teachersSnap = await getDocs(collection(db, "teachers"));
        let totalSubs = 0;
        teachersSnap.forEach(docSnap => {
            const d = docSnap.data();
            if (d.totalPaid) totalSubs += Number(d.totalPaid);
        });

        updateStatsUI(totalSubs);
    } catch (e) { console.error("Revenue Calc Error", e); }
}

function updateStatsUI(total) {
    let container = document.getElementById('revenue-stats-container');
    const parent = document.querySelector('.page-content');

    if (!container && parent) {
        const div = document.createElement('div');
        div.id = 'revenue-stats-container';
        div.className = 'content-card';
        div.style.marginBottom = '2rem';
        div.style.padding = '1.5rem';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3 style="margin:0; color:#94a3b8;">إجمالي أرباح الاشتراكات</h3>
                    <h1 style="margin:10px 0; font-size:2.5rem; color:#10b981;">0 ج.م</h1>
                </div>
                <div style="font-size:3rem; color:rgba(16, 185, 129, 0.2);"><i class="fas fa-coins"></i></div>
            </div>
        `;
        parent.insertBefore(div, parent.firstChild);
        container = div;
    }

    if (container) {
        container.querySelector('h1').innerText = total.toLocaleString() + ' ج.م';
    }
}

