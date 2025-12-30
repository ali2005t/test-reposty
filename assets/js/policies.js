import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

(async () => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') || 'terms'; // 'terms' or 'privacy'

    const titleMap = {
        'terms': 'الشروط والأحكام',
        'privacy': 'سياسة الخصوصية'
    };

    document.getElementById('page-title').innerText = titleMap[type];
    document.title = `${titleMap[type]} - Ta3leemy`;

    try {
        const docRef = doc(db, "config", "general_settings");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            const content = type === 'terms' ? data.termsText : data.privacyText;

            if (content) {
                document.getElementById('page-content').innerHTML = `<p>${content}</p>`;
            } else {
                document.getElementById('page-content').innerHTML = `
                    <div style="text-align:center; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 10px;">
                        <i class="fas fa-file-alt" style="font-size: 3rem; color: #475569; margin-bottom: 15px;"></i>
                        <p>لم يتم إضافة محتوى لهذه الصفحة بعد.</p>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.error("Error", e);
        document.getElementById('page-content').innerText = "حدث خطأ أثناء تحميل المحتوى.";
    }
})();
