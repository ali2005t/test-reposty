import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    addDoc,
    serverTimestamp,
    doc,
    updateDoc,
    getDocs // Added getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    let selectedTeacherId = null;
    let unsubscribeMessages = null;
    let allConversations = [];

    onAuthStateChanged(auth, (user) => {
        if (user) {
            loadConversations();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // 1. Load Conversations (Teachers who sent messages)
    // Firestore doesn't support "Group By" easily. 
    // We will query ALL messages, order by time, and client-side group? 
    // Or better: Keep a "conversations" collection.
    // Given the current structure in `teacher/support.html`: we just add to `support_tickets_teacher`.
    // So we need to query unique teacherIds.
    // Optimization: In a real app, we'd have a `last_message` on the user profile or a `conversations` collection.
    // For now, let's query the `support_tickets_teacher` and group client-side.
    // Warning: This could be heavy if thousands of messages.
    // Limit to last 500 messages?

    function loadConversations() {
        const q = query(collection(db, "support_tickets_teacher"), orderBy("createdAt", "desc"));

        onSnapshot(q, (snapshot) => {
            const teachersMap = new Map();

            snapshot.forEach(doc => {
                const data = doc.data();
                if (!teachersMap.has(data.teacherId)) {
                    teachersMap.set(data.teacherId, {
                        teacherId: data.teacherId,
                        teacherName: data.teacherName,
                        lastMsg: data.text,
                        time: data.createdAt,
                        unread: (data.sender === 'teacher' && data.read === false) ? 1 : 0
                    });
                } else {
                    // Accumulate unread logic if needed, but we processed descending so first entry is latest.
                    // But for unread count, we need to scan all.
                    const existing = teachersMap.get(data.teacherId);
                    if (data.sender === 'teacher' && data.read === false) {
                        existing.unread += 1;
                    }
                }
            });

            allConversations = Array.from(teachersMap.values());
            renderList(allConversations);
        });
    }

    function renderList(list) {
        const container = document.getElementById('conversations-list');
        container.innerHTML = '';

        const searchVal = document.getElementById('search-teacher').value.toLowerCase();

        list.filter(c => c.teacherName.toLowerCase().includes(searchVal)).forEach(conv => {
            const div = document.createElement('div');
            div.className = `chat-item ${selectedTeacherId === conv.teacherId ? 'active' : ''}`;
            const timeStr = conv.time ? new Date(conv.time.seconds * 1000).toLocaleDateString('ar-EG') : '';

            div.innerHTML = `
                <div class="avatar">${conv.teacherName.charAt(0)}</div>
                <div class="info">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="name">${conv.teacherName}</span>
                        <span style="font-size:0.7rem; color:#64748b;">${timeStr}</span>
                    </div>
                    <div class="last-msg">
                        ${conv.lastMsg}
                        ${conv.unread > 0 ? `<span class="unread-badge">${conv.unread}</span>` : ''}
                    </div>
                </div>
            `;

            div.onclick = () => selectConversation(conv);
            container.appendChild(div);
        });
    }

    document.getElementById('search-teacher').addEventListener('input', () => renderList(allConversations));

    function selectConversation(conv) {
        selectedTeacherId = conv.teacherId;
        renderList(allConversations); // Re-render to highlight active

        // Update Header
        document.getElementById('chat-header').style.visibility = 'visible';
        document.getElementById('current-name').innerText = conv.teacherName;
        document.getElementById('current-avatar').innerText = conv.teacherName.charAt(0);
        document.getElementById('chat-input-area').style.display = 'flex';

        loadMessages(conv.teacherId);
    }

    function loadMessages(teacherId) {
        if (unsubscribeMessages) unsubscribeMessages();

        const q = query(
            collection(db, "support_tickets_teacher"),
            where("teacherId", "==", teacherId),
            orderBy("createdAt", "asc")
        );

        const container = document.getElementById('messages-container');

        unsubscribeMessages = onSnapshot(q, (snapshot) => {
            container.innerHTML = '';

            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                // Mark as read if from teacher
                if (msg.sender === 'teacher' && !msg.read) {
                    updateDoc(doc(db, "support_tickets_teacher", docSnap.id), { read: true });
                }

                const div = document.createElement('div');
                div.className = `message ${msg.sender === 'admin' ? 'msg-admin' : 'msg-teacher'}`;
                const time = msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '...';

                div.innerHTML = `
                    ${msg.text}
                    <div class="msg-time">${time}</div>
                `;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        });
    }

    // Send Message
    const input = document.getElementById('message-input');
    const btn = document.getElementById('send-btn');

    async function send() {
        const text = input.value.trim();
        if (!text || !selectedTeacherId) return;

        input.value = '';

        // Find teacher name from active convo to avoid empty field?
        const currentConvo = allConversations.find(c => c.teacherId === selectedTeacherId);

        try {
            await addDoc(collection(db, "support_tickets_teacher"), {
                teacherId: selectedTeacherId,
                teacherName: currentConvo ? currentConvo.teacherName : 'Unknown',
                text: text,
                sender: 'admin',
                createdAt: serverTimestamp(),
                read: false
            });

            // Notify Teacher?
            await addDoc(collection(db, "notifications"), {
                target: selectedTeacherId,
                title: 'رد من الدعم الفني',
                body: text,
                type: 'support_reply',
                link: 'support.html',
                createdAt: serverTimestamp(),
                read: false
            });

        } catch (e) {
            console.error(e);
            alert("خطأ في الإرسال");
        }
    }

    btn.onclick = send;
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') send();
    });

    window.openTeacherProfile = () => {
        if (selectedTeacherId) {
            window.location.href = `teachers.html?viewProfile=${selectedTeacherId}`;
            // Note: admin/teachers.html might need logic to auto-open modal if param exists.
            // I'll skip implementing that "auto open" logic for now unless requested, 
            // but the link will at least go to teachers page.
        }
    };

});
