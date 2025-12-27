import { db, auth } from '../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Default Data Structure
const defaultPackages = {
    basic: {
        title: "Starter",
        tagline: "للمبتدئين",
        priceMonthly: 199,
        priceYearly: 1999,
        maxStudents: 50,
        storage: 5,
        features: "ميزة 1\nميزة 2\nميزة 3",
        btnText: "اشترك الآن",
        isPopular: false
    },
    pro: {
        title: "Pro",
        tagline: "للمحترفين",
        priceMonthly: 599,
        priceYearly: 5999,
        maxStudents: 1000,
        storage: 100,
        features: "1,000 طالب\nكورسات غير محدودة\nتطبيق للطلاب (Android)\nتفعيل الأكواد",
        btnText: "اشترك الآن (تجربة مجانية)",
        isPopular: true
    },
    elite: {
        title: "Elite",
        tagline: "للمؤسسات",
        priceMonthly: 999,
        priceYearly: 9999,
        maxStudents: 0,
        storage: 500,
        features: "عدد طلاب غير محدود\nتطبيق (Android & iOS)\nدعم فني مخصص",
        btnText: "تواصل معنا",
        isPopular: false
    }
};

let currentPackages = { ...defaultPackages };

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Check admin logic if needed
        loadPackages();
    } else {
        window.location.href = 'login.html';
    }
});

async function loadPackages() {
    try {
        const docSnap = await getDoc(doc(db, "config", "pricing_v2")); // Use new doc v2
        if (docSnap.exists()) {
            currentPackages = { ...defaultPackages, ...docSnap.data() };
        } else {
            // Migrating or Init
            await setDoc(doc(db, "config", "pricing_v2"), defaultPackages);
        }
        fillInputs();
    } catch (e) { console.error("Error loading packages:", e); }
}

function fillInputs() {
    document.querySelectorAll('.package-card').forEach(card => {
        const id = card.dataset.id;
        const data = currentPackages[id];
        if (!data) return;

        card.querySelector('.pkg-title').value = data.title || '';
        card.querySelector('.pkg-tagline').value = data.tagline || '';
        card.querySelector('.pkg-price-monthly').value = data.priceMonthly || 0;
        card.querySelector('.pkg-price-yearly').value = data.priceYearly || 0;

        // New Fields
        card.querySelector('.pkg-max-students').value = (data.maxStudents !== undefined) ? data.maxStudents : 0;
        card.querySelector('.pkg-storage').value = (data.storage !== undefined) ? data.storage : 0;

        card.querySelector('.pkg-features').value = data.features || '';
        card.querySelector('.pkg-btn-text').value = data.btnText || '';
        card.querySelector('.pkg-popular').checked = data.isPopular || false;

        // Setup individual save listener? No, bulk save or individual? 
        // The HTML has save buttons per card.
        card.querySelector('.save-pkg-btn').onclick = () => savePackage(id);
    });
}

async function savePackage(id) {
    const card = document.querySelector(`.package-card[data-id="${id}"]`);
    if (!card) return;

    const newData = {
        title: card.querySelector('.pkg-title').value,
        tagline: card.querySelector('.pkg-tagline').value,
        priceMonthly: Number(card.querySelector('.pkg-price-monthly').value),
        priceYearly: Number(card.querySelector('.pkg-price-yearly').value),
        maxStudents: Number(card.querySelector('.pkg-max-students').value),
        storage: Number(card.querySelector('.pkg-storage').value),
        features: card.querySelector('.pkg-features').value,
        btnText: card.querySelector('.pkg-btn-text').value,
        isPopular: card.querySelector('.pkg-popular').checked
    };

    currentPackages[id] = newData;

    try {
        const btn = card.querySelector('.save-pkg-btn');
        const originalText = btn.innerText;
        btn.innerText = "جاري الحفظ...";
        btn.disabled = true;

        await setDoc(doc(db, "config", "pricing_v2"), currentPackages); // Update whole object

        btn.innerText = "تم الحفظ!";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        }, 1500);

        UIManager.showToast('تم حفظ الباقة بنجاح');

    } catch (e) {
        console.error(e);
        UIManager.showToast("خطأ في حفظ البيانات", "error");
    }
}

// Notification Logic (Keeping existing logic if needed)
const sendBtn = document.getElementById('send-notif-btn');
if (sendBtn) {
    sendBtn.onclick = async () => {
        // ... (Existing notification logic) ...
        UIManager.showToast('هذه الميزة (الإشعارات) تم نقلها لصفحة مستقلة ولكن يمكن تفعيلها هنا أيضاً.', 'info');
    };
}
