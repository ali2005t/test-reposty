import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection, query, where, orderBy, onSnapshot,
    addDoc, updateDoc, doc, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {

    const ticketsListEl = document.getElementById('tickets-list');
    const messagesContainer = document.getElementById('messages-container');
    const chatInputArea = document.getElementById('chat-input-area');
    const actionsArea = document.getElementById('chat-actions');
    const msgInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-msg-btn');
    const closeTicketBtn = document.getElementById('close-ticket-btn');

    let currentTicketId = null;
    let messageUnsub = null;
    let currentUser = null; // This variable might become redundant if initHeader handles it or if currentUser.uid is replaced by effectiveUid

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Assuming initHeader is defined elsewhere or will be added.
            // For this change, we'll just call it as per instruction.
            // Also, currentUser might need to be set here if initHeader doesn't handle it.
            currentUser = user; // Keep currentUser for now, as other functions might still rely on it.
            initHeader(user);
            const uid = await getEffectiveUserUid(user);
            if (uid) loadSupportTickets(uid);
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // Placeholder for initHeader as it's used in the instruction but not defined in the original code.
    // You might need to define this function elsewhere.
    function initHeader(user) {
        // Example: Update UI elements with user info
        // console.log("Initializing header for user:", user.displayName || user.email);
    }

    // --- 1. Load Tickets (Real-time) ---
    function loadTickets() {
        const q = query(
            collection(db, 'tickets'),
            where('teacherId', '==', currentUser.uid),
            orderBy('updatedAt', 'desc')
        );

        onSnapshot(q, (snapshot) => {
            ticketsListEl.innerHTML = '<div style="padding:15px; font-weight:bold; color:#f1f5f9; border-bottom:1px solid #334155;">التذاكر</div>';

            if (snapshot.empty) {
                ticketsListEl.innerHTML += '<div style="padding:20px; color:#94a3b8; text-align:center;">لا توجد تذاكر حالياً</div>';
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const isActive = currentTicketId === docSnap.id ? 'active' : '';
                const date = data.updatedAt ? data.updatedAt.toDate().toLocaleDateString('ar-EG') : '';

                const item = document.createElement('div');
                item.className = `ticket-item ${isActive}`;
                item.innerHTML = `
                    <div class="ticket-header">
                        <span style="font-weight:bold; color:white;">${data.studentName || 'طالب'}</span>
                        <span class="ticket-status ${data.status === 'open' ? 'status-open' : 'status-closed'}">
                            ${data.status === 'open' ? 'مفتوح' : 'مغلق'}
                        </span>
                    </div>
                    <div style="font-size:0.9rem; color:#cbd5e1; margin-bottom:5px;">${data.title}</div>
                    <div style="font-size:0.8rem; color:#64748b; display:flex; justify-content:space-between;">
                        <span>${data.lastMessage ? data.lastMessage.substring(0, 30) + '...' : ''}</span>
                        <span>${date}</span>
                    </div>
                `;
                item.onclick = () => selectTicket(docSnap.id, data);
                ticketsListEl.appendChild(item);
            });
        }, (error) => {
            ticketsListEl.innerHTML += '<div style="padding:15px; text-align:center; color:#ef4444; font-size:0.85rem;">حدث خطأ في تحميل البيانات. تأكد من إنشاء الفهرس (Index) في Firebase.</div>';
            console.error("Snapshot error:", error);
        });
    }

    // --- 2. Select Ticket & Load Messages ---
    function selectTicket(ticketId, ticketData) {
        if (currentTicketId === ticketId) return;
        currentTicketId = ticketId;

        // Update Header
        document.getElementById('chat-student-name').textContent = ticketData.studentName || 'طالب';
        document.getElementById('chat-title').textContent = ticketData.title;

        // Show Inputs
        chatInputArea.style.display = ticketData.status === 'open' ? 'flex' : 'none';
        actionsArea.style.display = ticketData.status === 'open' ? 'block' : 'none';

        // Highlight
        document.querySelectorAll('.ticket-item').forEach(el => el.classList.remove('active'));
        // (Re-rendering list handles active class, but efficient to toggle here too if list doesn't update instantly)

        // Load Messages
        if (messageUnsub) messageUnsub(); // Unsubscribe prev
        const msgsRef = collection(db, 'tickets', ticketId, 'messages');
        const q = query(msgsRef, orderBy('timestamp', 'asc'));

        messagesContainer.innerHTML = ''; // Clear

        messageUnsub = onSnapshot(q, (snapshot) => {
            messagesContainer.innerHTML = '';

            if (snapshot.empty) {
                messagesContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">بداية المحادثة</div>';
            }

            snapshot.forEach(doc => {
                const msg = doc.data();
                const isMe = msg.senderId === currentUser.uid;

                const div = document.createElement('div');
                div.className = `message ${isMe ? 'msg-teacher' : 'msg-student'}`;
                div.textContent = msg.text;
                messagesContainer.appendChild(div);
            });

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }

    // --- 3. Send Message ---
    async function sendMessage() {
        const text = msgInput.value.trim();
        if (!text || !currentTicketId) return;

        try {
            msgInput.value = '';

            // Add to subcollection
            await addDoc(collection(db, 'tickets', currentTicketId, 'messages'), {
                text: text,
                senderId: currentUser.uid,
                isAdmin: true, // It's a teacher/admin
                timestamp: serverTimestamp()
            });

            // Update parent ticket (last message & unread status if needed)
            await updateDoc(doc(db, 'tickets', currentTicketId), {
                lastMessage: text,
                updatedAt: serverTimestamp(),
                // teacherUnread: false,
                studentUnread: true
            });

        } catch (e) {
            console.error("Send error:", e);
            UIManager.showToast("فشل الإرسال", "error");
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // --- 4. Close Ticket ---
    closeTicketBtn.addEventListener('click', async () => {
        if (!currentTicketId) return;
        if (!confirm('هل تريد إغلاق هذه التذكرة؟ لن يتمكن الطالب من الرد.')) return;

        try {
            await updateDoc(doc(db, 'tickets', currentTicketId), {
                status: 'closed',
                updatedAt: serverTimestamp()
            });

            chatInputArea.style.display = 'none';
            actionsArea.style.display = 'none';
            UIManager.showToast("تم إغلاق التذكرة");
        } catch (e) {
            console.error(e);
        }
    });

});
