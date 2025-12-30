import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function initSupportWidget() {
    // Avoid duplicates
    if (document.getElementById('support-widget-container')) return;

    // Don't show on Support Page itself to avoid clutter? Or show it for consistency?
    // User requested "shortcuts found in the pages to link to it".
    // If we are on support page, maybe hide the Ticket button but keep Whatsapp?
    // Let's keep it simple for now and show everywhere, or maybe hide on support.html.
    if (window.location.pathname.includes('support.html')) return;

    // Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        .floating-btns-container {
            position: fixed;
            bottom: 25px;
            left: 25px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            z-index: 9999;
            transition: all 0.3s ease;
        }

        .float-btn {
            background: #6366f1;
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 700;
            font-family: inherit;
            transition: transform 0.2s, box-shadow 0.2s;
            text-decoration: none;
            font-size: 0.95rem;
        }

        .float-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 20px rgba(99, 102, 241, 0.5);
        }

        .float-btn.ticket {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);
        }
        
        .float-btn.whatsapp {
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            box-shadow: 0 4px 15px rgba(37, 211, 102, 0.4);
        }

        @media (max-width: 768px) {
            .floating-btns-container {
                bottom: 80px; /* Above bottom nav if exists, or just higher */
                left: 15px;
            }
            .float-btn span {
                display: none; /* Icon only on mobile? Or keep text? User wants buttons. Keep text usually better for "Support" */
            }
            .float-btn {
                padding: 12px;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                justify-content: center;
            }
        }
    `;
    document.head.appendChild(style);

    // Create Container
    const container = document.createElement('div');
    container.id = 'support-widget-container';
    container.className = 'floating-btns-container';

    // 1. WhatsApp Button (Dynamic)
    const waBtn = document.createElement('a'); // Using <a> for simple linking
    waBtn.className = 'float-btn whatsapp';
    waBtn.innerHTML = '<i class="fab fa-whatsapp" style="font-size:1.2rem;"></i> <span>تواصل معنا</span>';
    waBtn.onclick = (e) => {
        e.preventDefault();
        openWhatsappDynamic();
    };

    // 2. Ticket Button
    const ticketBtn = document.createElement('button');
    ticketBtn.className = 'float-btn ticket';
    ticketBtn.innerHTML = '<i class="fas fa-headset" style="font-size:1.1rem;"></i> <span>الدعم الفني</span>';
    ticketBtn.onclick = () => {
        window.location.href = 'support.html';
    };

    container.appendChild(ticketBtn);
    container.appendChild(waBtn);
    document.body.appendChild(container);
}

async function openWhatsappDynamic() {
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

    const url = `https://wa.me/${phone}?text=${encodeURIComponent("مرحباً، أحتاج مساعدة في المنصة.")}`;
    window.open(url, '_blank');
}
