import { auth, db } from './firebase-config.js';
import { applyTheme } from './theme-loader.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, query, where, orderBy, onSnapshot,
    addDoc, doc, getDocs, getDoc, serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const ticketsContainer = document.getElementById('tickets-container');
    const modal = document.getElementById('new-ticket-modal');
    const fab = document.getElementById('open-new-ticket');
    const cancelBtn = document.getElementById('cancel-ticket');
    const createBtn = document.getElementById('create-ticket-btn');
    const teacherSelect = document.getElementById('teacher-select');

    // Chat Elements
    const chatView = document.getElementById('chat-view');
    const closeChatBtn = document.getElementById('close-chat');
    const chatBody = document.getElementById('student-chat-body');
    const chatInput = document.getElementById('student-chat-input');
    const sendBtn = document.getElementById('student-send-btn');
    const chatTitle = document.getElementById('chat-page-title');

    let currentUser = null;
    let currentTicketId = null;
    let messageUnsub = null;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await applyTheme();
            currentUser = user;
            loadTickets();
            loadMyTeachers(); // Populate dropdown
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- 1. Load Tickets ---
    function loadTickets() {
        const q = query(
            collection(db, 'tickets'),
            where('studentId', '==', currentUser.uid),
            orderBy('updatedAt', 'desc')
        );

        onSnapshot(q, (snapshot) => {
            ticketsContainer.innerHTML = '';
            if (snapshot.empty) {
                ticketsContainer.innerHTML = '<div style="text-align:center; padding:50px; color:#64748b;">لا توجد تذاكر مسجلة. اضغط + لإضافة واحدة.</div>';
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const statusClass = data.status === 'open' ? 'status-open' : 'status-closed';
                const statusText = data.status === 'open' ? 'مفتوح' : 'مغلق';

                const card = document.createElement('div');
                card.className = 'ticket-card';
                card.innerHTML = `
                    <div style="overflow:hidden; margin-bottom:5px;">
                        <span class="ticket-status ${statusClass}">${statusText}</span>
                        <span style="float:right; color:#64748b; font-size:0.8rem;">${data.updatedAt?.toDate().toLocaleDateString('ar-EG') || ''}</span>
                    </div>
                    <h3 style="margin:5px 0; font-size:1rem; color:#1e293b;">${data.title}</h3>
                    <p style="color:#64748b; font-size:0.9rem; margin:0;">${data.lastMessage ? data.lastMessage.substring(0, 40) + '...' : 'لا توجد رسائل'}</p>
                `;
                card.onclick = () => openChat(docSnap.id, data);
                ticketsContainer.appendChild(card);
            });
        });
    }

    // --- 2. Load Teachers (for Dropdown) ---
    async function loadMyTeachers() {
        try {
            // Find unique teachers from Enrollments? 
            // Or from 'students' collection doc which has 'enrolledTeachers' array.
            // Let's us 'students' collection if we rely on it based on previous tasks.
            const studentDoc = await getDoc(doc(db, "students", currentUser.uid));
            if (studentDoc.exists()) {
                const data = studentDoc.data();
                const teacherIds = data.enrolledTeachers || [];

                teacherSelect.innerHTML = '<option value="">اختر المعلم...</option>';

                if (teacherIds.length === 0) {
                    teacherSelect.innerHTML = '<option value="">لست مشتركاً مع أي معلم</option>';
                    return;
                }

                // Fetch Teacher Names needed? Yes.
                for (const tid of teacherIds) {
                    const tSnap = await getDoc(doc(db, "teachers", tid));
                    if (tSnap.exists()) {
                        const tData = tSnap.data();
                        const opt = document.createElement('option');
                        opt.value = tid;
                        opt.textContent = tData.name || tData.platformName || "معلم";
                        teacherSelect.appendChild(opt);
                    }
                }
            } else {
                teacherSelect.innerHTML = '<option value="">حساب الطالب غير مفعل</option>';
            }
        } catch (e) { console.error(e); }
    }

    // --- 3. Create Ticket ---
    fab.onclick = () => modal.classList.add('active');
    cancelBtn.onclick = () => modal.classList.remove('active');

    createBtn.onclick = async () => {
        const teacherId = teacherSelect.value;
        const title = document.getElementById('ticket-title').value;

        if (!teacherId || !title) {
            alert("يرجى ملء جميع الحقول");
            return;
        }

        try {
            createBtn.disabled = true;
            createBtn.textContent = 'جاري الإرسال...';

            await addDoc(collection(db, 'tickets'), {
                studentId: currentUser.uid,
                studentName: currentUser.displayName || "طالب", // fallback if not set
                teacherId: teacherId,
                title: title,
                status: 'open',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                studentUnread: false,
                // teacherUnread: true // Optional
                lastMessage: "تذكرة جديدة"
            });

            modal.classList.remove('active');
            document.getElementById('ticket-title').value = '';

        } catch (e) {
            console.error(e);
            alert("حدث خطأ");
        } finally {
            createBtn.disabled = false;
            createBtn.textContent = 'إرسال';
        }
    };

    // --- 4. Chat System ---
    function openChat(ticketId, data) {
        currentTicketId = ticketId;
        chatTitle.textContent = data.title;
        chatView.classList.add('active');

        // Listen to messages
        if (messageUnsub) messageUnsub();
        const ref = collection(db, 'tickets', ticketId, 'messages');
        const q = query(ref, orderBy('timestamp', 'asc'));

        messageUnsub = onSnapshot(q, (snap) => {
            chatBody.innerHTML = '';
            snap.forEach(d => {
                const msg = d.data();
                const isMe = msg.senderId === currentUser.uid;
                const div = document.createElement('div');
                div.className = `message ${isMe ? 'msg-me' : 'msg-other'}`;
                div.textContent = msg.text;
                chatBody.appendChild(div);
            });
            chatBody.scrollTop = chatBody.scrollHeight;
        });
    }

    closeChatBtn.onclick = () => {
        chatView.classList.remove('active');
        currentTicketId = null;
        if (messageUnsub) messageUnsub();
    };

    async function sendMsg() {
        const text = chatInput.value.trim();
        if (!text || !currentTicketId) return;

        try {
            chatInput.value = '';
            await addDoc(collection(db, 'tickets', currentTicketId, 'messages'), {
                text,
                senderId: currentUser.uid,
                isAdmin: false,
                timestamp: serverTimestamp()
            });

            await updateDoc(doc(db, 'tickets', currentTicketId), {
                lastMessage: text,
                updatedAt: serverTimestamp(),
                // teacherUnread: true
            });
        } catch (e) { console.error(e); }
    }

    sendBtn.onclick = sendMsg;

});
