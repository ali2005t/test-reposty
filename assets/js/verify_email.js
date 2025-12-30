// verify_email.js
import { auth } from './firebase-config.js';
import { applyActionCode } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async () => {
    // Get the action code from the URL request.
    const actionCode = new URLSearchParams(window.location.search).get('oobCode');
    const mode = new URLSearchParams(window.location.search).get('mode'); // verifyEmail

    const loader = document.getElementById('loader');
    const successMsg = document.getElementById('success-message');
    const errorMsg = document.getElementById('error-message');

    if (!actionCode) {
        loader.style.display = 'none';
        errorMsg.style.display = 'block';
        return;
    }

    try {
        // Apply the verification code
        await applyActionCode(auth, actionCode);

        // Success
        loader.style.display = 'none';
        successMsg.style.display = 'block';

    } catch (error) {
        console.error("Verification Error", error);
        loader.style.display = 'none';
        errorMsg.style.display = 'block';
    }
});
