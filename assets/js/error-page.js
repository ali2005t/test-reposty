document.addEventListener('DOMContentLoaded', () => {
    // Intelligent Home Link
    window.handleHomeLink = function (e) {
        if (e) e.preventDefault();
        window.location.href = '/';
    };

    // SPA 404 Redirect Hack & UI Logic
    (function () {
        var path = window.location.pathname;

        // Elements
        var redirectEl = document.getElementById('redirect-content');
        var errorEl = document.getElementById('error-content');

        // Show loader initially
        if (redirectEl) redirectEl.style.display = 'flex';

        // Check if we are aiming for student app slug logic
        // If the path contains specific markers or needs handling
        if (path.includes('/student-app/')) {
            // Redirect immediately to preserve SPA routing
            window.location.replace('index.html?redirect=' + encodeURIComponent(path));
        } else {
            // Standard 404 behavior for other paths
            // We give a tiny delay just in case some other script (like a router) was supposed to pick it up,
            // otherwise we reveal the 404 UI.

            setTimeout(() => {
                if (redirectEl) redirectEl.style.display = 'none';
                if (errorEl) errorEl.style.display = 'block';
            }, 500);
        }
    })();
});
