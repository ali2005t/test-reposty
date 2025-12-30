/**
 * UI Manager - Centralized handling for Toasts, Alerts, and Loading States.
 * Usage: import { UIManager } from './ui-manager.js';
 */

// Inject SweetAlert2 if not present (Optional, for Confirm Modals)
if (!window.Swal) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    document.head.appendChild(script);
}

// Inject Custom Toast Styles
// Inject Custom Toast Styles
// Inject Custom Toast Styles
if (!document.getElementById('ui-manager-style')) {
    const uiManagerStyle = document.createElement('style');
    uiManagerStyle.id = 'ui-manager-style';
    uiManagerStyle.innerHTML = `
    .custom-toast-container {
        position: fixed;
        top: 20px;
        left: 20px; /* RTL default or check lang */
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
    }
    .custom-toast {
        background: #1e293b;
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        overflow: hidden;
        animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
        border: 1px solid rgba(255,255,255,0.05);
        position: relative;
    }
    .custom-toast.success { border-right: 4px solid #10b981; }
    .custom-toast.error { border-right: 4px solid #ef4444; }
    .custom-toast.info { border-right: 4px solid #3b82f6; }
    
    .toast-icon { font-size: 1.2rem; }
    .success .toast-icon { color: #10b981; }
    .error .toast-icon { color: #ef4444; }
    .info .toast-icon { color: #3b82f6; }
    
    .toast-content { flex: 1; font-family: inherit; font-size: 0.95rem; }
    
    .toast-close { cursor: pointer; color: #94a3b8; transition: 0.2s; }
    .toast-close:hover { color: white; }

    @keyframes slideIn {
        from { transform: translateX(-100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        to { transform: translateX(-100%); opacity: 0; }
    }
`;
    document.head.appendChild(uiManagerStyle);
}

// Create Container
// Create Container safely
function initToastContainer() {
    let toastContainer = document.getElementById('custom-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'custom-toast-container';
        toastContainer.className = 'custom-toast-container';
        if (document.body) {
            document.body.appendChild(toastContainer);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(toastContainer));
        }
    }
    return toastContainer;
}

// Initial call
initToastContainer();



const UIManager = {

    /**
     * Show a non-blocking toast notification.
     * @param {string} message - Text to display
     * @param {string} type - 'success' | 'error' | 'info'
     * @param {number} duration - ms (default 3000)
     */
    showToast(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `custom-toast ${type}`;

        let icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'info') icon = 'info-circle';

        toast.innerHTML = `
            <i class="fas fa-${icon} toast-icon"></i>
            <div class="toast-content">${message}</div>
            <i class="fas fa-times toast-close"></i>
        `;

        // Handle Close
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.onclick = () => removeToast(toast);

        // Ensure container exists
        let container = document.getElementById('custom-toast-container');
        if (!container) container = initToastContainer();

        container.appendChild(toast);

        // Auto Remove
        setTimeout(() => removeToast(toast), duration);
    },

    /**
     * Show a blocking confirmation modal (SweetAlert2).
     * @param {string} title 
     * @param {string} text 
     * @param {string} protocol - 'warning' | 'info'
     * @returns {Promise<boolean>}
     */
    async showConfirm(title, text, confirmBtnText = 'نعم، تابع', cancelBtnText = 'إلغاء') {
        if (window.Swal) {
            const result = await Swal.fire({
                title: title,
                text: text,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3b82f6',
                cancelButtonColor: '#ef4444',
                confirmButtonText: confirmBtnText,
                cancelButtonText: cancelBtnText,
                background: '#1e293b',
                color: '#fff'
            });
            return result.isConfirmed;
        } else {
            return confirm(`${title}\n${text}`);
        }
    },

    /**
     * Show generic Alert (SweetAlert2).
     */
    showAlert(title, text, icon = 'success') {
        if (window.Swal) {
            Swal.fire({
                title,
                text,
                icon,
                confirmButtonText: 'حسناً',
                background: '#1e293b',
                color: '#fff',
                confirmButtonColor: '#3b82f6'
            });
        } else {
            alert(`${title}: ${text}`);
        }
    }
};

window.UIManager = UIManager;

function removeToast(el) {
    el.style.animation = 'slideOut 0.3s forwards';
    setTimeout(() => el.remove(), 300);
}
// Export removed to prevent SyntaxError in non-module pages
// export { UIManager };
