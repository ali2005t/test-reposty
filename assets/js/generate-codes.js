import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    serverTimestamp,
    orderBy,
    deleteDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let currentUser = null;
    const typeSelect = document.getElementById('code-type');
    const trainSelect = document.getElementById('select-training');
    const unitSelect = document.getElementById('select-unit');
    const lectSelect = document.getElementById('select-lecture');
    const priceInput = document.getElementById('code-price-input');

    // Filters & Actions
    const filterSelect = document.getElementById('filter-status');
    const delAllBtn = document.getElementById('del-all-btn');

    // Data Cache
    const CACHE = {
        trainings: [],
        units: [],
        lectures: []
    };

    // Loaded Codes
    let loadedCodes = [];

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadTrainings(user.uid);
            loadCodes(user.uid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // UI Logic
    typeSelect.addEventListener('change', updateVisibility);

    function updateVisibility() {
        const type = typeSelect.value;
        const groupUnit = document.getElementById('group-unit');
        const groupLect = document.getElementById('group-lecture');

        if (type === 'training') {
            groupUnit.style.display = 'none';
            groupLect.style.display = 'none';
            updatePrice();
        } else if (type === 'unit') {
            groupUnit.style.display = 'block';
            groupLect.style.display = 'none';
            loadUnits(trainSelect.value);
        } else if (type === 'lecture' || type === 'exam' || type === 'book') {
            groupUnit.style.display = 'block';
            groupLect.style.display = 'block';

            // Update Label based on type
            const label = groupLect.querySelector('label');
            if (type === 'lecture') label.innerText = "اختر الفيديو/المحاضرة";
            else if (type === 'exam') label.innerText = "اختر الامتحان";
            else if (type === 'book') label.innerText = "اختر الملزمة/الكتاب";
            else label.innerText = "اختر المحتوى";

            loadUnits(trainSelect.value);
        } else if (type === 'wallet') {
            groupUnit.style.display = 'none';
            groupLect.style.display = 'none';
        }
    }

    // Cascading Loads
    async function loadTrainings(uid) {
        trainSelect.innerHTML = '<option value="">جاري التحميل...</option>';
        try {
            const q = query(collection(db, "training_programs"), where("teacherId", "==", uid));
            const snap = await getDocs(q);
            CACHE.trainings = [];
            trainSelect.innerHTML = '<option value="">اختر الدورة...</option>';
            snap.forEach(d => {
                const data = { id: d.id, ...d.data() };
                CACHE.trainings.push(data);
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.innerText = data.title;
                trainSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    trainSelect.addEventListener('change', () => {
        if (typeSelect.value !== 'training') {
            loadUnits(trainSelect.value);
        } else {
            updatePrice();
        }
    });

    async function loadUnits(tId) {
        if (!tId) return;
        unitSelect.innerHTML = '<option value="">جاري التحميل...</option>';
        try {
            const q = query(collection(db, "courses"), where("trainingId", "==", tId));
            const snap = await getDocs(q);
            CACHE.units = [];
            unitSelect.innerHTML = '<option value="">اختر الكورس...</option>';
            snap.forEach(d => {
                const data = { id: d.id, ...d.data() };
                CACHE.units.push(data);
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.innerText = data.title;
                unitSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    unitSelect.addEventListener('change', () => {
        if (typeSelect.value === 'unit') {
            updatePrice();
        } else if (typeSelect.value === 'lecture') {
            loadLectures(unitSelect.value);
        }
    });

    async function loadLectures(uId) {
        if (!uId) return;
        lectSelect.innerHTML = '<option value="">جاري التحميل...</option>';
        try {
            const q = query(collection(db, "course_content"), where("unitId", "==", uId));
            const snap = await getDocs(q);
            CACHE.lectures = [];
            lectSelect.innerHTML = '<option value="">اختر المحاضرة...</option>';
            snap.forEach(d => {
                const data = { id: d.id, ...d.data() };
                CACHE.lectures.push(data);
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.innerText = data.title;
                lectSelect.appendChild(opt);
            });
        } catch (e) { console.error(e); }
    }

    lectSelect.addEventListener('change', updatePrice);


    function updatePrice() {
        const type = typeSelect.value;
        let price = 0;
        if (type === 'training') {
            const t = CACHE.trainings.find(x => x.id === trainSelect.value);
            if (t) price = t.price || 0;
        } else if (type === 'unit') {
            // Units price logic if any
        } else if (type === 'lecture') {
            const l = CACHE.lectures.find(x => x.id === lectSelect.value);
            if (l) price = l.price || 0;
        }
        if (priceInput) priceInput.value = price;
    }


    // Generate
    document.getElementById('generate-codes-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = typeSelect.value;
        const qty = parseInt(document.getElementById('code-quantity').value);
        let targetId, targetName;

        const color = document.getElementById('card-color-picker')?.value || '#22c55e';
        const expiry = document.getElementById('code-expiry')?.value || null;

        if (type === 'training') {
            targetId = trainSelect.value;
            const t = CACHE.trainings.find(x => x.id === targetId);
            targetName = t ? t.title : 'Unknown';
        } else if (type === 'unit') {
            targetId = unitSelect.value;
            const u = CACHE.units.find(x => x.id === targetId);
            targetName = u ? u.title : 'Unknown';
        } else if (['lecture', 'exam', 'book'].includes(type)) {
            targetId = lectSelect.value;
            const l = CACHE.lectures.find(x => x.id === targetId);
            targetName = l ? l.title : 'Unknown';
        } else if (type === 'wallet') {
            targetId = 'WALLET';
            targetName = `رصيد بقيمة ${finalPrice}`;
        }

        if (!targetId && type !== 'wallet') {
            alert("يرجى اختيار الهدف لتوليد الكود");
            return;
        }

        // Manual Price Override 
        const finalPrice = parseFloat(priceInput.value) || 0;

        const btn = document.getElementById('gen-btn');
        btn.disabled = true;
        btn.innerText = "جاري التوليد...";

        try {
            for (let i = 0; i < qty; i++) {
                const code = generateRandomCode();
                await addDoc(collection(db, "access_codes"), {
                    code: code,
                    type: type,
                    targetId: targetId,
                    targetName: targetName,
                    price: finalPrice,
                    expiryDate: expiry, // YYYY-MM-DD string
                    cardColor: color,
                    teacherId: currentUser.uid,
                    isUsed: false,
                    status: 'available',
                    createdAt: serverTimestamp()
                });
            }

            if (window.showToast) window.showToast("تم توليد الأكواد بنجاح", "success");
            loadCodes(currentUser.uid);

        } catch (e) {
            console.error(e);
            alert("خطأ في التوليد");
        } finally {
            btn.disabled = false;
            btn.innerText = "توليد الأكواد";
        }
    });

    function generateRandomCode() {
        // Safe chars, length 8 + hyphen? No, User reported "Wrong Codes".
        // Let's make it simpler: 5 chars - 5 chars? Or just 10 chars.
        // User screenshot showed simple input.
        // Let's keep 4-4 but ensure no ambiguity.
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            if (i === 4) result += '-';
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Load & Render & Filter
    async function loadCodes(uid) {
        document.getElementById('loading-indicator').style.display = 'block';
        try {
            const q = query(collection(db, "access_codes"), where("teacherId", "==", uid));
            const snap = await getDocs(q);
            loadedCodes = [];
            snap.forEach(d => loadedCodes.push({ id: d.id, ...d.data() }));

            // Sort
            loadedCodes.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

            renderTable();
        } catch (e) { console.error(e); }
        document.getElementById('loading-indicator').style.display = 'none';
    }

    function renderTable() {
        const tbody = document.getElementById('codes-table-body');
        tbody.innerHTML = '';

        const searchVal = document.getElementById('search-code')?.value.toLowerCase() || '';
        const filter = filterSelect.value; // all, unused, used

        const filtered = loadedCodes.filter(c => {
            const matchesSearch = !searchVal ||
                (c.code && c.code.toLowerCase().includes(searchVal)) ||
                (c.targetName && c.targetName.toLowerCase().includes(searchVal));

            if (!matchesSearch) return false;

            if (filter === 'all') return true;
            if (filter === 'unused') return !c.isUsed;
            if (filter === 'used') return c.isUsed;
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد أكواد</td></tr>';
            return;
        }

        let index = 1;
        filtered.forEach(data => {
            const tr = document.createElement('tr');
            const isUsed = data.isUsed;

            // Apply cardColor to the row if available
            if (data.cardColor) {
                tr.style.setProperty('--card-color', data.cardColor);
                tr.classList.add('has-card-color'); // Add a class to apply specific styling if needed
            }

            tr.innerHTML = `
                <td>${index++}</td>
                <td style="font-family:monospace; font-weight:bold; color:var(--primary-color); font-size:1.1rem;">${data.code}</td>
                <td>${translateType(data.type)}</td>
                <td>${data.targetName || '-'}</td>
                <td>
                    <span class="status-badge ${!isUsed ? 'success' : 'danger'}">
                        ${!isUsed ? 'متاح' : 'مستخدم'}
                    </span>
                </td>
                <td>${data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleDateString('ar-EG') : '-'}</td>
                <td>${data.price || 0}</td>
                <td>
                    <button class="btn-icon-small copy-btn" title="نسخ"><i class="fas fa-copy"></i></button>
                    ${!isUsed ? `<button class="btn-icon-small delete-btn" style="color:red;" title="حذف"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            `;

            tr.querySelector('.copy-btn').onclick = () => {
                navigator.clipboard.writeText(data.code);
            };

            const del = tr.querySelector('.delete-btn');
            if (del) del.onclick = async () => {
                if (confirm("حذف الكود؟")) {
                    await deleteDoc(doc(db, "access_codes", data.id));
                    tr.remove();
                    // update loadedCodes cache separate step or reload
                    loadedCodes = loadedCodes.filter(x => x.id !== data.id);
                }
            };

            tbody.appendChild(tr);
        });
    }

    // Filter Listener
    if (filterSelect) filterSelect.onchange = renderTable;
    document.getElementById('search-code')?.addEventListener('input', renderTable);

    // Delete All Logic
    if (delAllBtn) delAllBtn.onclick = async () => {
        const filter = filterSelect.value;
        const toDelete = loadedCodes.filter(c => {
            if (filter === 'all') return true;
            // Usually only delete UNUSED in bulk for safety? Or All?
            // User asked "Delete All Codes".
            // Let's delete displayed list.
            if (filter === 'unused') return !c.isUsed;
            if (filter === 'used') return c.isUsed;
            return true;
        }); // Filter applies to what is visible actually?

        // Actually, let's delete currently FILTERED items.
        // It's safer.

        if (toDelete.length === 0) return alert("لا توجد أكواد للحذف");
        if (!confirm(`هل أنت متأكد من حذف ${toDelete.length} كود؟`)) return;

        delAllBtn.disabled = true;
        delAllBtn.innerText = "جاري الحذف...";

        try {
            // Delete one by one (Firestore web doesn't have delete query)
            // Batch them
            const chunks = chunkArray(toDelete, 400); // safety
            // Implementing generic delete loop
            for (const item of toDelete) {
                await deleteDoc(doc(db, "access_codes", item.id));
            }

            alert("تم الحذف بنجاح");
            loadCodes(currentUser.uid); // Reload

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء الحذف");
        } finally {
            delAllBtn.disabled = false;
            delAllBtn.innerHTML = '<i class="fas fa-trash"></i> حذف الكل';
        }
    };

    function translateType(t) {
        if (t === 'training') return 'دورة';
        if (t === 'unit') return 'كورس';
        if (t === 'lecture') return 'محاضرة';
        return t;
    }

    function chunkArray(myArray, chunk_size) {
        var index = 0;
        var arrayLength = myArray.length;
        var tempArray = [];
        for (index = 0; index < arrayLength; index += chunk_size) {
            const myChunk = myArray.slice(index, index + chunk_size);
            tempArray.push(myChunk);
        }
        return tempArray;
    }


    // Print Logic
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.onclick = async () => {
            await renderPrintCards();
            window.print();
        };
    }

    async function renderPrintCards() {
        const container = document.getElementById('print-area');
        if (!container) return;

        container.innerHTML = 'Preparing...';

        // Filter Logic same as table
        const filterSelect = document.getElementById('filter-status');
        const filter = filterSelect ? filterSelect.value : 'all';
        const filtered = loadedCodes.filter(c => {
            if (filter === 'all') return true;
            if (filter === 'unused') return !c.isUsed;
            if (filter === 'used') return c.isUsed;
            return true;
        });

        if (filtered.length === 0) {
            alert("لا توجد أكواد للطباعة");
            return;
        }

        // Fetch Teacher Info for Card Branding
        let teacherName = "أكاديمية تعليمي";
        let subTitle = "منصة تعليمية";
        if (currentUser) {
            try {
                const d = await getDoc(doc(db, "teachers", currentUser.uid));
                if (d.exists()) {
                    const t = d.data();
                    teacherName = t.platformName || t.name;
                    subTitle = t.specialization || "منصة تعليمية";
                }
            } catch (e) { }
        }

        container.innerHTML = '';

        filtered.forEach((data, idx) => {
            // Serial: "A" + first 4 chars of ID + idx
            const serial = `S-${data.id.substring(0, 4).toUpperCase()}-${idx + 1}`;

            const card = document.createElement('div');
            card.className = 'code-card';
            // Apply Dynamic Color
            if (data.cardColor) card.style.setProperty('--card-color', data.cardColor);

            card.innerHTML = `
                <div class="card-logo-watermark">${teacherName.split(' ')[0]}</div>
                <div class="card-header-badge">${translateType(data.type)}</div>
                <div class="card-serial">${serial}</div>
                
                <div class="card-center">
                    <h3>أهلاً بكم في ${teacherName}</h3>
                    <h2>${data.targetName || 'محتوى تعليمي'}</h2>
                    <p>${subTitle}</p>
                    <div class="card-code-box">${data.code}</div>
                </div>

                <div class="card-footer">
                    هذا الكارت يستخدم مرة واحدة فقط
                    ${data.expiryDate ? `<br>صالح حتى ${data.expiryDate}` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    }

});
