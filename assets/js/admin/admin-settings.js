import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const form = document.getElementById('settings-form');
    const toast = document.getElementById('toast');

    // Auth Check
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Verify Admin (Optional: check role)
            loadSettings();
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // Load Settings
    async function loadSettings() {
        try {
            const docRef = doc(db, "config", "general_settings");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                setVal('platform-name', data.platformName);
                setVal('platform-video', data.platformVideo);
                setVal('platform-desc', data.platformDesc);
                setVal('contact-support-link', data.contactSupportLink || (data.contactWhatsapp ? `https://wa.me/${data.contactWhatsapp}` : ''));
                setVal('contact-support-text', data.contactSupportText || 'واتساب');
                setVal('contact-support-icon', data.contactSupportIcon || 'fab fa-whatsapp');
                setVal('contact-email', data.contactEmail);
                setVal('config-tax', data.taxRate);
                setVal('config-trial-days', data.trialDays);
                setVal('policy-terms', data.termsText);
                setVal('policy-privacy', data.privacyText);

                // New Fields
                let isMaint = data.maintenanceMode;

                // Check if maintenance time expired, if so, turn it off automatically in DB
                if (isMaint && data.maintenanceEndTime) {
                    const endTime = new Date(data.maintenanceEndTime).getTime();
                    const now = new Date().getTime();
                    if (now > endTime) {
                        isMaint = false;
                        // Auto-update DB
                        try {
                            setDoc(doc(db, "config", "general_settings"), { maintenanceMode: false }, { merge: true });
                            if (window.UIManager) UIManager.showToast('انتهت فترة الصيانة وتم إيقاف الوضع تلقائياً.', 'success');
                            console.log("Maintenance auto-disabled due to expiry.");
                        } catch (err) {
                            console.error("Failed to auto-disable maintenance", err);
                        }
                    }
                }

                setVal('config-maintenance', isMaint);

                // Handle Date/Time Splitting
                if (data.maintenanceEndTime) {
                    try {
                        const dt = new Date(data.maintenanceEndTime);
                        if (!isNaN(dt.getTime())) {
                            // Format YYYY-MM-DD
                            const yyyy = dt.getFullYear();
                            const mm = String(dt.getMonth() + 1).padStart(2, '0');
                            const dd = String(dt.getDate()).padStart(2, '0');
                            setVal('config-maintenance-date', `${yyyy}-${mm}-${dd}`);

                            // Format HH:MM
                            const hh = String(dt.getHours()).padStart(2, '0');
                            const min = String(dt.getMinutes()).padStart(2, '0');
                            setVal('config-maintenance-time', `${hh}:${min}`);
                        }
                    } catch (e) {
                        console.error("Invalid saved date", e);
                    }
                }

                toggleMaintenanceTime(data.maintenanceMode);
                setVal('config-blocked-ips', data.blockedIPs);
                setVal('config-blocked-domains', data.blockedDomains);
            }
        } catch (e) {
            console.error("Error loading settings:", e);
        }
    }

    function setVal(id, val) {
        if (val !== undefined && val !== null) {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = val;
                } else {
                    el.value = val;
                }
            }
        }
    }

    // Tabs Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active
            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // Save Settings
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-settings-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        btn.disabled = true;

        try {
            const data = {
                platformName: getVal('platform-name'),
                platformVideo: getVal('platform-video'),
                platformDesc: getVal('platform-desc'),
                contactSupportLink: getVal('contact-support-link'),
                contactSupportText: getVal('contact-support-text'),
                contactSupportIcon: getVal('contact-support-icon'),
                contactEmail: getVal('contact-email'),
                taxRate: Number(getVal('config-tax')),
                trialDays: Number(getVal('config-trial-days')),
                termsText: getVal('policy-terms'),
                privacyText: getVal('policy-privacy'),

                // New Fields
                maintenanceMode: getVal('config-maintenance'),
                maintenanceEndTime: (() => {
                    const d = getVal('config-maintenance-date');
                    const t = getVal('config-maintenance-time');
                    if (d && t) return new Date(`${d}T${t}`).toISOString();
                    return null;
                })(),
                blockedIPs: getVal('config-blocked-ips'),
                blockedDomains: getVal('config-blocked-domains'),

                updatedAt: serverTimestamp(),
                updatedBy: auth.currentUser.uid
            };

            await setDoc(doc(db, "config", "general_settings"), data, { merge: true });

            UIManager.showToast('تم حفظ الإعدادات بنجاح');

            // Optionally update page title immediately if changed
            if (data.platformName) document.title = `إعدادات المنصة - ${data.platformName}`;

        } catch (e) {
            console.error("Error saving settings:", e);
            UIManager.showToast("حدث خطأ أثناء الحفظ", "error");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    function getVal(id) {
        const el = document.getElementById(id);
        if (!el) return null;
        if (el.type === 'checkbox') return el.checked;
        return el.value;
    }

    function showToast() {
        // Deprecated local toast, using UIManager
        // Keeping for backward compatibility if UIManager fails
    }

    // Reset Defaults
    const resetBtn = document.getElementById('reset-defaults-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            const confirmed = await UIManager.showConfirm(
                'استعادة الافتراضيات',
                "هل أنت متأكد من استعادة الإعدادات الافتراضية؟ سيتم مسح التعديلات الغير محفوظة.",
                'نعم، استعد'
            );

            if (confirmed) {
                setVal('platform-name', 'Ta3leemy');
                setVal('platform-video', '');
                setVal('platform-desc', '');
                setVal('contact-whatsapp', '');
                setVal('contact-email', '');
                setVal('config-tax', '14');
                setVal('config-trial-days', '14');
                setVal('policy-terms', '');
                setVal('policy-privacy', '');
                UIManager.showToast("تم استعادة القيم الافتراضية في النموذج. اضغط 'حفظ' لتثبيتها.");
            }
        });
    }

    // Toggle Maintenance Time Visibility
    const maintToggle = document.getElementById('config-maintenance');
    if (maintToggle) {
        maintToggle.addEventListener('change', (e) => toggleMaintenanceTime(e.target.checked));
    }

    function toggleMaintenanceTime(isShow) {
        const group = document.getElementById('maintenance-time-group');
        if (group) group.style.display = isShow ? 'block' : 'none';
    }

    // Auto-update Support Button Text based on Icon
    const iconSelect = document.getElementById('contact-support-icon');
    const textInput = document.getElementById('contact-support-text');

    if (iconSelect && textInput) {
        iconSelect.addEventListener('change', () => {
            const val = iconSelect.value;
            let newText = "";
            if (val.includes('whatsapp')) newText = "واتساب";
            else if (val.includes('telegram')) newText = "تليجرام";
            else if (val.includes('facebook')) newText = "ماسنجر";
            else if (val.includes('phone')) newText = "اتصل بنا";
            else newText = "الدعم الفني";

            textInput.value = newText;
        });
    }

    // Generate Default Policies
    const btnGenPolicy = document.getElementById('btn-generate-policy');
    if (btnGenPolicy) {
        btnGenPolicy.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-tab');

            if (activeTab === 'terms') {
                const defaultTerms = `الشروط والأحكام العامة للاستخدام

أهلاً بكم في منصة Ta3leemy. يرجى قراءة هذه الشروط والأحكام ("الشروط") بعناية قبل استخدام الموقع أو التطبيق أو الخدمات المقدمة من خلالنا.

1. القبول بالشروط
بمجرد التسجيل أو استخدام المنصة، فإنك توافق صراحةً على الالتزام بهذه الشروط وجميع القوانين المعمول بها. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام خدماتنا.

2. الحسابات والتسجيل
- يجب عليك تقديم معلومات دقيقة وكاملة عند إنشاء حساب.
- أنت المسؤول الوحيد عن الحفاظ على سرية بيانات حسابك وكلمة المرور.
- يحظر مشاركة الحساب مع أشخاص آخرين، وقد يؤدي ذلك إلى حظر الحساب نهائياً دون استرداد المبلغ المدفوع.

3. حقوق الملكية الفكرية
- جميع المحتويات المتاحة على المنصة (بما في ذلك الفيديوهات، الملفات، النصوص، والاختبارات) هي ملكية حصرية للمنصة أو للمحاضرين.
- يمنع منعاً باتاً نسخ، توزيع، إعادة بيع، أو مشاركة أي محتوى خارج إطار المنصة. أي انتهاك لهذه الحقوق يعرضك للمسائلة القانونية.

4. سياسة الدفع والاسترداد
- جميع الرسوم المدفوعة للاشتراك في الدورات غير قابلة للاسترداد إلا في حالات استثنائية (مثل المشاكل التقنية التي تمنع الوصول للمحتوى).
- نحتفظ بالحق في تعديل أسعار الباقات والخدمات في أي وقت، ولا ينطبق التغيير على الاشتراكات السارية.

5. السلوك المسموح به
- تتعهد بعدم استخدام المنصة لأي غرض غير قانوني أو غير مصرح به.
- يمنع استخدام أي أدوات آلية أو برمجيات لجمع البيانات من المنصة (Web Scraping).

6. حدود المسؤولية
- المنصة لا تضمن خلو الخدمة من الأخطاء أو الانقطاع، ونعمل جاهدين لحل أي مشاكل تقنية في أسرع وقت.
- نحن غير مسؤولين عن أي أضرار مباشرة أو غير مباشرة قد تنشأ عن استخدامك للمنصة.

7. التعديلات على الشروط
- يحق لنا تعديل هذه الشروط في أي وقت. استمرارك في استخدام المنصة بعد التعديل يعني موافقتك على الشروط الجديدة.

تاريخ التحديث: ${new Date().toLocaleDateString('ar-EG')}`;
                document.getElementById('policy-terms').value = defaultTerms;
                UIManager.showToast('تم توليد نموذج شروط وأحكام احترافي', 'success');
            } else {
                const defaultPrivacy = `سياسة الخصوصية وحماية البيانات

نحن في Ta3leemy نلتزم بحماية خصوصيتك وضمان أمان بياناتك الشخصية. توضح هذه السياسة كيفية جمع واستخدام وحماية معلوماتك.

1. المعلومات التي نقوم بجمعها
- المعلومات الشخصية: مثل الاسم، البريد الإلكتروني، رقم الهاتف، والدولة، والتي تقدمها عند التسجيل.
- بيانات الاستخدام: مثل الكورسات التي تشاهدها، مدة المشاهدة، ونتائج الاختبارات.
- بيانات الجهاز: نوع الجهاز، نظام التشغيل، وعنوان IP لتحسين تجربتك ومنع الاحتيال.

2. كيف نستخدم معلوماتك
- لتقديم الخدمات التعليمية وإدارة حسابك.
- للتواصل معك بخصوص التحديثات، العروض، أو الدعم الفني.
- لتحسين جودة المحتوى وتطوير المنصة بناءً على تحليل سلوك المستخدمين.
- لمنع الأنشطة المشبوهة وحماية حقوق الملكية الفكرية.

3. مشاركة المعلومات
- نحن لا نقوم ببيع أو تأجير بياناتك الشخصية لأي طرف ثالث.
- قد نشارك بيانات محدودة مع مزودي الخدمات الموثوقين (مثل بوابات الدفع الإلكتروني) فقط لإتمام العمليات الضرورية.

4. ملفات تعريف الارتباط (Cookies)
- نستخدم ملفات تعريف الارتباط لتحسين تجربتك، تذكر تفضيلاتك، وتحليل حركة المرور على الموقع. يمكنك تعطيلها من إعدادات المتصفح، لكن قد يؤثر ذلك على بعض وظائف الموقع.

5. أمان البيانات
- نستخدم تقنيات تشفير متقدمة (SSL) لحماية بياناتك أثناء النقل.
- يتم تخزين كلمات المرور بشكل مشفر وآمن ولا يمكن لأي موظف الاطلاع عليها.

6. حقوقك
- يحق لك طلب الوصول إلى بياناتك الشخصية، تصحيحها، أو حذف الحساب في أي وقت عبر التواصل مع الدعم الفني.

7. التغييرات على سياسة الخصوصية
- قد نقوم بتحديث هذه السياسة من فترة لأخرى. سيتم نشر النسخة المحدثة هنا مع تاريخ التعديل.

تاريخ التحديث: ${new Date().toLocaleDateString('ar-EG')}`;
                document.getElementById('policy-privacy').value = defaultPrivacy;
                UIManager.showToast('تم توليد نموذج سياسة خصوصية احترافي', 'success');
            }
        });
    }

});
