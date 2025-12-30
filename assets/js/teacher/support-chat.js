import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, getDoc, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let unsubscribeChat = null;
let assignedAgentId = null; // Store assigned agent

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadTeacherProfile(user.uid);
            await loadMessages(); // Pre-load or wait for open? Pre-load is fine if lightweight.

            // Attach Events
            const sendBtn = document.querySelector('.chat-footer .btn-icon'); // The send button
            if (sendBtn) sendBtn.onclick = sendMessage;

            const input = document.getElementById('chat-input');
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') sendMessage();
                });
            }

            // Bind global functions for HTML onclicks
            window.openWhatsapp = openWhatsapp;
            window.openTickets = openTickets;
            window.closeChat = closeChat;
            window.sendMessage = sendMessage;

        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // Sidebar Toggle
    const btn = document.getElementById('open-sidebar');
    const sb = document.getElementById('sidebar');
    if (btn) btn.onclick = () => sb.classList.toggle('active');
});

async function loadTeacherProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "teachers", uid));
        if (docSnap.exists()) {
            assignedAgentId = docSnap.data().assignedAgentId || null;
            // console.log("Assigned Agent:", assignedAgentId);
        }
    } catch (e) {
        console.error("Error loading profile", e);
    }
}

async function openWhatsapp() {
    let phone = "201000000000"; // Default
    try {
        const docRef = doc(db, "config", "general_settings");
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.contactWhatsapp) {
                phone = data.contactWhatsapp.replace(/\+/g, '').replace(/\s/g, '');
            }
        }
    } catch (e) {
        console.error("Error fetching whatsapp number", e);
    }
    window.open(`https://wa.me/${phone}`, '_blank');
}

function openTickets() {
    const chatView = document.getElementById('chat-view');
    chatView.classList.add('active');
    // loadMessages called in auth, but ensure scrolled
    const chatBody = document.getElementById('chat-body');
    chatBody.scrollTop = chatBody.scrollHeight;
}

function closeChat() {
    document.getElementById('chat-view').classList.remove('active');
}

async function loadMessages() {
    if (!currentUser) return;

    const q = query(
        collection(db, "support_tickets_teacher"),
        where("teacherId", "==", currentUser.uid),
        orderBy("createdAt", "asc")
    );

    const chatBody = document.getElementById('chat-body');

    unsubscribeChat = onSnapshot(q, (snapshot) => {
        chatBody.innerHTML = '';
        if (snapshot.empty) {
            chatBody.innerHTML = '<div style="text-align:center; color:#64748b; margin-top:50px;">لا توجد رسائل سابقة. ابدأ المحادثة الآن.</div>';
        }

        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const isMe = msg.sender === 'teacher';
            const div = document.createElement('div');
            div.className = `message ${isMe ? 'msg-me' : 'msg-other'}`;
            // Handle Auto-Reply styling if needed, or just treat as other
            div.textContent = msg.text;
            if (msg.type === 'auto-reply') {
                div.style.fontSize = '0.85rem';
                div.style.fontStyle = 'italic';
            }
            chatBody.appendChild(div);
        });
        chatBody.scrollTop = chatBody.scrollHeight;
    });
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentUser) return;

    input.value = '';

    try {
        // 1. Send Message
        const msgRef = await addDoc(collection(db, "support_tickets_teacher"), {
            teacherId: currentUser.uid,
            teacherName: currentUser.displayName || 'Teacher',
            text: text,
            sender: 'teacher',
            createdAt: serverTimestamp(),
            read: false
        });

        // 2. Notification Routing
        const targetId = assignedAgentId || 'admin';
        await addDoc(collection(db, "notifications"), {
            target: targetId, // Dynamic Target
            type: 'support_msg',
            title: 'رسالة دعم جديدة',
            message: `رسالة من ${currentUser.displayName || 'معلم'}`,
            link: 'support.html',
            teacherId: currentUser.uid, // Add extra context for filtering
            createdAt: serverTimestamp(),
            read: false
        });

        // 3. Auto-Reply Logic
        await checkAutoReply();

    } catch (e) {
        console.error(e);
        // alert("فشل الإرسال"); 
    }
}

async function checkAutoReply() {
    // Check previous messages to see if we should auto-reply
    // Conditions: 
    // A. First message ever.
    // B. Last message from *Admin* (or AutoReply) was > 24 hours ago OR Last message from *Teacher* was > 24 hours ago (start of new convo).
    // Let's simplify: If NO messages from 'admin'/'system' in the last 24 hours, send one.

    // Query last few messages
    const q = query(
        collection(db, "support_tickets_teacher"),
        where("teacherId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(5)
    );

    const snap = await getDocs(q);
    const msgs = snap.docs.map(d => d.data());

    // msgs[0] is the one we just sent.

    let shouldReply = false;

    // Condition 1: It's the only message (First ever)
    if (msgs.length <= 1) {
        shouldReply = true;
    } else {
        // Condition 2: Check time gap
        // Find last message that is NOT from the current batch (i.e. older).
        // Actually, check if there is any 'admin' response recently.
        const lastAdminMsg = msgs.find(m => m.sender === 'admin' || m.sender === 'system');

        if (!lastAdminMsg) {
            // Admin never replied in the last 5 messages. Check time of the *previous* teacher message.
            // If previous teacher message was long ago (> 24h), then this is a "new" conversation start.
            const prevTeacherMsg = msgs[1]; // The one before current
            if (prevTeacherMsg && prevTeacherMsg.createdAt) {
                const diff = Date.now() - prevTeacherMsg.createdAt.toMillis();
                if (diff > 24 * 60 * 60 * 1000) {
                    shouldReply = true;
                }
            }
        } else {
            // Admin replied recently. Check how long ago.
            if (lastAdminMsg.createdAt) {
                const diff = Date.now() - lastAdminMsg.createdAt.toMillis();
                if (diff > 24 * 60 * 60 * 1000) {
                    shouldReply = true; // Admin replied > 24h ago, user is starting new topic
                }
            }
        }
    }

    if (shouldReply) {
        await addDoc(collection(db, "support_tickets_teacher"), {
            teacherId: currentUser.uid,
            teacherName: currentUser.displayName || 'Teacher',
            text: "تم استلام رسالتك، وسيقوم أحد ممثلي الدعم بالرد عليك في أقرب وقت. 🕒",
            sender: 'system',
            type: 'auto-reply',
            createdAt: serverTimestamp(),
            read: true
        });
    }
}
