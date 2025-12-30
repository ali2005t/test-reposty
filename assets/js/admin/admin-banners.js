import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    doc,
    deleteDoc,
    orderBy,
    Timestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const bannersColl = collection(db, "banners");

// --- التأكد من تسجيل الدخول ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        loadBanners();
    }
});

// --- تحميل البانرات ---
async function loadBanners() {
    const container = document.getElementById('banners-container');
    const loading = document.getElementById('loading-indicator');

    // مسح المحتوى الحالي مع الحفاظ على كارت الإضافة
    const addCard = container.querySelector('.add-card');
    container.innerHTML = '';
    container.appendChild(addCard);

    loading.style.display = 'block';

    try {
        const q = query(bannersColl, orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        loading.style.display = 'none';

        if (snapshot.empty) {
            // مفيش بانرات حاليا
        } else {
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                createBannerCard(docSnap.id, data);
            });
        }

    } catch (e) {
        console.error(e);
        loading.innerHTML = 'حدث خطأ في التحميل';
    }
}

// --- عرض الكارت ---
function createBannerCard(id, data) {
    const container = document.getElementById('banners-container');

    const card = document.createElement('div');
    card.className = 'banner-card';

    // خريطة الألوان
    const colorMap = {
        'blue': '#3b82f6',
        'red': '#ef4444',
        'green': '#10b981',
        'yellow': '#f59e0b',
        'purple': '#8b5cf6'
    };
    const bgColor = colorMap[data.style] || '#334155';
    const textColor = data.style === 'yellow' ? 'black' : 'white';

    // تسمية الفئة المستهدفة
    let targetLabel = 'الكل';
    if (data.target === 'student') targetLabel = 'الطلاب';
    if (data.target === 'teacher') targetLabel = 'المعلمين';

    card.innerHTML = `
        <div class="banner-preview" style="background:${bgColor}; color:${textColor};">
            <div style="position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.5); color:white; padding:2px 8px; border-radius:4px; font-size:0.7rem;">
                ${targetLabel}
            </div>
            <h3>${data.title || data.type}</h3>
            ${renderPreviewContent(data)}
            ${data.btnText ? `<a href="#" class="preview-btn">${data.btnText}</a>` : ''}
        </div>
        <div class="banner-actions">
            <span style="font-size:0.8rem; color:#94a3b8;">${new Date(data.createdAt?.toDate()).toLocaleDateString('ar-EG')}</span>
            <button class="btn-icon danger" onclick="deleteBanner('${id}')"><i class="fas fa-trash"></i></button>
        </div>
    `;

    // إضافة الكارت (بعد كارت الإضافة)
    container.appendChild(card);
}

function renderPreviewContent(data) {
    if (data.type === 'image') return `<img src="${data.url}" style="max-width:100%; height:80px; object-fit:cover; border-radius:6px;">`;
    if (data.type === 'video') return `<div style="color:white;"><i class="fab fa-youtube"></i> فيديو: ${data.url}</div>`;
    if (data.type === 'html') return `<div style="background:#000; color:#10b981; padding:5px; font-family:monospace; font-size:0.8rem;">HTML Code</div>`;
    return `<p>${data.body || ''}</p>`;
}

// --- فتح نافذة الإضافة ---
document.getElementById('open-add-modal').onclick = () => {
    document.getElementById('banner-modal').style.display = 'flex';
};

document.getElementById('banner-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // حالة التحميل (Loading state)
    const btn = document.getElementById('save-banner-btn');
    btn.disabled = true;
    btn.innerText = 'جاري الحفظ...';

    // تجميع البيانات
    const type = document.getElementById('banner-type').value;
    const title = document.getElementById('banner-title').value; // For simple
    const body = document.getElementById('banner-body').value;   // For simple
    const url = document.getElementById('banner-url').value;     // For image/video
    const html = document.getElementById('banner-html').value;   // For html

    // --- validation ---
    if (type === 'simple' && !title) { alert("العنوان مطلوب"); btn.disabled = false; btn.innerText = 'حفظ ونشر'; return; }
    if ((type === 'image' || type === 'video') && !url) { alert("الرابط مطلوب"); btn.disabled = false; btn.innerText = 'حفظ ونشر'; return; }
    if (type === 'html' && !html) { alert("الكود مطلوب"); btn.disabled = false; btn.innerText = 'حفظ ونشر'; return; }

    const target = document.getElementById('banner-target').value;
    const btnText = document.getElementById('banner-btn-text').value;
    const link = document.getElementById('banner-link').value;

    const styleInputs = document.getElementsByName('banner-style');
    let style = 'blue';
    for (const input of styleInputs) {
        if (input.checked) style = input.value;
    }

    try {
        await addDoc(bannersColl, {
            type: type || 'simple',
            title: title || '',
            body: body || '',
            url: url || '',     // For Media
            html: html || '',   // For HTML
            target,
            btnText,
            link,
            style,
            createdAt: Timestamp.now(),
            isActive: true
        });

        document.getElementById('banner-modal').style.display = 'none';
        document.getElementById('banner-form').reset();
        loadBanners(); // تحديث القائمة

    } catch (e) {
        alert("خطأ: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = 'حفظ ونشر';
    }
});

// --- حذف البانر ---
window.deleteBanner = async (id) => {
    if (confirm("هل أنت متأكد من حذف هذا البانر؟")) {
        try {
            await deleteDoc(doc(db, "banners", id));
            loadBanners();
        } catch (e) {
            alert("فشل الحذف: " + e.message);
        }
    }
};

window.loadCodes = loadBanners; // تحديث
