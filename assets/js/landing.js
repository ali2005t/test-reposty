import { analytics, db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {

    // --- Maintenance Check ---
    try {
        const configRef = doc(db, "config", "general_settings");
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
            const data = configSnap.data();
            if (data.maintenanceMode) {
                window.location.href = 'maintenance.html';
                return; // Stop execution
            }
        }
    } catch (e) {
        console.error("Error checking maintenance mode:", e);
    }

    // --- Splash Screen Logic ---
    const splashScreen = document.getElementById('splash-screen');
    const appContent = document.getElementById('app-content');

    if (splashScreen && appContent) {
        // Show splash for at least 2.5 seconds
        setTimeout(() => {
            splashScreen.classList.add('hidden');
            appContent.classList.add('visible');

            // Remove from DOM after transition to avoid z-index blocking
            setTimeout(() => {
                splashScreen.style.display = 'none';
            }, 500);

        }, 2500);
    }

    // --- Dynamic Pricing Logic ---
    const pricingContainer = document.querySelector('.pricing-cards');
    const toggleSwitch = document.querySelector('.toggle-switch');

    let isYearly = false;
    let packagesData = {}; // To store fetched data

    // Ordered keys for display
    const packageOrder = ['basic', 'pro', 'elite'];

    // Fetch Dynamic Settings & Pricing
    try {
        const [pricingSnap, settingsSnap] = await Promise.all([
            getDoc(doc(db, "config", "pricing_v2")),
            getDoc(doc(db, "config", "general_settings"))
        ]);

        // 1. Render Packages
        if (pricingSnap.exists()) {
            packagesData = pricingSnap.data();
            renderPricingCards();
        }

        // 2. Global Settings (Platform Name etc)
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.platformName) {
                document.title = document.title.replace('Ta3leemy', data.platformName);
                document.querySelectorAll('.logo, .splash-logo').forEach(el => {
                    if (el.tagName === 'A') el.innerHTML = `${data.platformName}<span class="dot">.</span>`;
                    else el.innerText = data.platformName;
                });
            }
            if (data.platformDesc) {
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) metaDesc.content = data.platformDesc;
            }
            if (data.platformVideo) {
                const vidBtns = document.querySelectorAll('a[href="#demo"]');
                vidBtns.forEach(btn => {
                    btn.href = data.platformVideo;
                    btn.target = "_blank";
                    btn.innerHTML = '<i class="fas fa-play"></i> شاهد الفيديو';
                });
            }
        }

    } catch (e) {
        console.error("Error fetching data:", e);
    }

    function renderPricingCards() {
        if (!pricingContainer) return;
        pricingContainer.innerHTML = '';

        packageOrder.forEach(key => {
            const pkg = packagesData[key];
            if (!pkg) return;

            const price = isYearly ? pkg.priceYearly : pkg.priceMonthly;
            const period = isYearly ? '/ سنة' : '/ شهر';
            const features = pkg.features ? pkg.features.split('\n') : [];
            const isFeatured = pkg.isPopular ? 'featured' : '';
            const popularBadge = pkg.isPopular ? '<div class="badge-popular">الأكثر طلباً</div>' : '';

            // Generate Features List HTML
            const featuresHtml = features.map(f => {
                // Check if feature starts with "!" (to disable it visually? No, let's keep it simple for now)
                // Assuming all listed features are positive updates.
                return `<li><i class="fas fa-check"></i> ${f}</li>`;
            }).join('');

            const html = `
                <div class="price-card ${isFeatured}">
                    ${popularBadge}
                    <div class="card-header">
                        <h3>${pkg.title}</h3>
                        <div class="price">
                            <span class="currency">ج.م</span>
                            <span class="amount">${price}</span>
                            <span class="period">${period}</span>
                        </div>
                        <p>${pkg.tagline}</p>
                    </div>
                    <ul class="features-list">
                        ${featuresHtml}
                    </ul>
                    <a href="auth/register.html?plan=${key}" class="btn ${pkg.isPopular ? 'btn-primary' : 'btn-secondary'} full-width">${pkg.btnText}</a>
                </div>
            `;
            pricingContainer.innerHTML += html;
        });
    }

    if (toggleSwitch) {
        toggleSwitch.addEventListener('click', () => {
            toggleSwitch.classList.toggle('active');
            isYearly = !isYearly;

            // Switch active text class
            const spans = document.querySelectorAll('.pricing-toggle span');
            if (spans.length >= 2) {
                spans[0].classList.toggle('active');
                spans[1].classList.toggle('active');
            }

            // Re-render cards with animation
            const cards = document.querySelectorAll('.price-card');
            cards.forEach(c => c.style.opacity = '0');

            setTimeout(() => {
                renderPricingCards();
                // Fade in new cards
                document.querySelectorAll('.price-card').forEach(c => {
                    c.style.animation = 'scaleIn 0.3s ease forwards';
                    c.style.opacity = '1';
                });
            }, 200);
        });
    }

    console.log("Ta3leemy Platform Loaded");
});
