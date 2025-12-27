document.addEventListener('DOMContentLoaded', () => {

    // Check local storage
    const savedTheme = localStorage.getItem('studentAppTheme') || 'light'; // Default Light
    applyTheme(savedTheme);

    // Find toggle button(s)
    const toggles = document.querySelectorAll('.theme-toggle-btn');
    toggles.forEach(btn => {
        updateIcon(btn, savedTheme);
        btn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            updateIcon(btn, newTheme);
            localStorage.setItem('studentAppTheme', newTheme);
        });
    });
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function updateIcon(btn, theme) {
    const icon = btn.querySelector('i');
    if (icon) {
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}
