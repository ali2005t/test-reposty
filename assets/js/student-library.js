import { db, auth } from './firebase-config.js';
import {
    doc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    documentId
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const notesList = document.getElementById('notes-list');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loadLibrary(user.uid);
    } else {
        window.location.href = 'login.html';
    }
});

async function loadLibrary(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        let purchased = [];
        if (userDoc.exists()) {
            const d = userDoc.data();
            purchased = d.purchasedItems || [];
        }

        if (purchased.length === 0) {
            notesList.innerHTML = `
                <div style="text-align:center; padding:3rem; color:#94a3b8;">
                    <i class="fas fa-book-open" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <p>لا توجد ملازم مشتراة</p>
                    <button class="btn btn-primary btn-sm" onclick="location.href='my-courses.html'" style="margin-top:10px;">إضافة كود</button>
                </div>
            `;
            return;
        }

        // Fetch Items
        // Optimally, store "type" in purchasedItems? No, currently just IDs.
        // We have to fetch docs.
        // Chunking 10 for 'in' query

        const chunks = [];
        for (let i = 0; i < purchased.length; i += 10) {
            chunks.push(purchased.slice(i, i + 10));
        }

        const books = [];

        for (const chunk of chunks) {
            const q = query(
                collection(db, "course_content"),
                where(documentId(), 'in', chunk)
            );
            const snaps = await getDocs(q);
            snaps.forEach(d => {
                const data = d.data();
                if (data.type === 'book') {
                    books.push({ id: d.id, ...data });
                }
            });
        }

        if (books.length === 0) {
            notesList.innerHTML = `
                <div style="text-align:center; padding:3rem; color:#94a3b8;">
                    <i class="fas fa-book-open" style="font-size:3rem; margin-bottom:1rem; opacity:0.5;"></i>
                    <p>لديك منتجات مشتراة لكنها ليست ملازم</p>
                </div>
            `;
            return;
        }

        notesList.innerHTML = '';
        books.forEach(book => {
            const el = document.createElement('div');
            el.className = 'note-card';
            el.onclick = () => window.open(book.fileUrl, '_blank');
            el.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <div class="note-icon">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="note-info" style="margin-right:15px;">
                        <h3>${book.title}</h3>
                        <p>${book.description || 'ملزمة PDF'}</p>
                    </div>
                </div>
                <i class="fas fa-download" style="color:#cbd5e1;"></i>
            `;
            notesList.appendChild(el);
        });

    } catch (e) {
        console.error(e);
        notesList.innerHTML = `<div style="color:red; text-align:center;">خطأ في التحميل</div>`;
    }
}
