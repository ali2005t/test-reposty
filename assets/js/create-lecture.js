import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { UIManager } from './ui-manager.js';
import { getEffectiveUserUid } from './impersonation-manager.js';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    updateDoc,
    query,
    where,
    serverTimestamp,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    const params = new URLSearchParams(window.location.search);
    const preTrainingId = params.get('trainingId');
    const preUnitId = params.get('unitId');
    const editLectureId = params.get('id'); // Edit Mode ID

    let quill;
    let currentUser = null;
    let currentUserId = null;
    let isEditMode = false;

    // Initialize Quill
    if (document.getElementById('editor-container')) {
        quill = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'direction': 'rtl' }],
                    ['link', 'image', 'video'],
                    ['clean']
                ]
            }
        });
    }

    // --- Toggle Logic for Radios ---
    const setupRadioToggle = (name, targetId, showValue = 'yes') => {
        const radios = document.querySelectorAll(`input[name="${name}"]`);
        const target = document.getElementById(targetId);

        const update = () => {
            const val = document.querySelector(`input[name="${name}"]:checked`)?.value;
            if (target) target.style.display = (val === showValue) ? 'block' : 'none';
        };

        radios.forEach(r => r.addEventListener('change', update));
        update(); // Initial
    };

    // 'hasVideo' -> shows 'video-url-container'
    setupRadioToggle('hasVideo', 'video-url-container', 'yes');

    // Type Toggle Logic
    const typeSelect = document.getElementById('content-type-select');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            const isBook = typeSelect.value === 'book';

            // Toggle Fields
            const videoSection = document.querySelector('input[name="hasVideo"]').closest('.form-group');
            const liveSection = document.querySelector('input[name="isLive"]').closest('.form-group');
            // const partsSection = document.querySelector('input[name="splitParts"]').closest('.form-group');
            const driveLabel = document.querySelector('label[for="drive-url"]');

            if (videoSection) videoSection.style.display = isBook ? 'none' : 'block';
            if (liveSection) liveSection.style.display = isBook ? 'none' : 'block';
            if (driveLabel) driveLabel.innerText = isBook ? 'رابط الملزمة (PDF/Drive)' : 'رابط المحاضرة علي (Drive)';
        });
        // Trigger initial
        typeSelect.dispatchEvent(new Event('change'));
    }

    // 'inBundle' -> shows 'unit-container' (If 'no', maybe it's a standalone lecture? logic pending)
    // For now, if 'no', user can't select unit.
    setupRadioToggle('inBundle', 'unit-container', 'yes');


    // Auth & Data Loading
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            currentUserId = await getEffectiveUserUid(user);
            await loadTrainings(currentUserId);

            if (editLectureId) {
                isEditMode = true;
                const h3 = document.querySelector('h3');
                if (h3) h3.innerText = 'تعديل المحاضرة';
                const btn = document.getElementById('save-btn');
                if (btn) btn.innerHTML = '<i class="fas fa-save"></i> حفظ التعديلات';
                await loadExistingData(editLectureId);
            }
        } else {
            window.location.href = '../auth/login.html';
        }
    });

    // Populate Trainings
    async function loadTrainings(uid) {
        const select = document.getElementById('select-training');
        if (!select) return;
        select.innerHTML = '<option value="">جاري التحميل...</option>';

        try {
            const q = query(collection(db, "training_programs"), where("teacherId", "==", uid));
            const snapshot = await getDocs(q);

            select.innerHTML = '<option value="">اختر الدورة...</option>';
            snapshot.forEach(doc => {
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.innerText = doc.data().title;
                select.appendChild(opt);
            });

            // Pre-select logic
            if (preTrainingId && !isEditMode) {
                if (select.querySelector(`option[value="${preTrainingId}"]`)) {
                    select.value = preTrainingId;
                    await loadUnits(preTrainingId);
                }
            } else if (select.options.length === 2 && !editLectureId) {
                // Auto select if only 1 training
                select.options[1].selected = true;
                await loadUnits(select.value);
            }

            // Listener for change
            select.addEventListener('change', () => {
                loadUnits(select.value);
            });

        } catch (e) {
            console.error(e);
            select.innerHTML = '<option value="">فشل التحميل</option>';
        }
    }

    // Populate Units (Courses)
    async function loadUnits(trainingId) {
        const select = document.getElementById('select-unit');
        if (!select) return;

        if (!trainingId) {
            select.innerHTML = '<option value="">اختر الكورس...</option>';
            return;
        }

        select.innerHTML = '<option value="">جاري التحميل...</option>';

        try {
            // Fetch from BOTH 'courses' and 'units' to ensure data integrity
            const qCourses = query(collection(db, "courses"), where("trainingId", "==", trainingId));
            const qUnits = query(collection(db, "units"), where("trainingId", "==", trainingId));

            const [coursesSnap, unitsSnap] = await Promise.all([
                getDocs(qCourses).catch(e => ({ empty: true, forEach: () => { } })),
                getDocs(qUnits).catch(e => ({ empty: true, forEach: () => { } }))
            ]);

            select.innerHTML = '<option value="">اختر الكورس...</option>';

            const addedIds = new Set();
            const addOpt = (doc) => {
                if (addedIds.has(doc.id)) return;
                addedIds.add(doc.id);

                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.innerText = doc.data().title;
                select.appendChild(opt);
            };

            if (!coursesSnap.empty) coursesSnap.forEach(addOpt);
            if (!unitsSnap.empty) unitsSnap.forEach(addOpt);

            if (addedIds.size === 0) {
                select.innerHTML = '<option value="">لا توجد كورسات متاحة</option>';
            }

            if (preUnitId && !isEditMode) {
                if (select.querySelector(`option[value="${preUnitId}"]`)) {
                    select.value = preUnitId;
                    loadPrerequisites(preUnitId);
                }
            }

            select.addEventListener('change', () => {
                loadPrerequisites(select.value);
            });

        } catch (e) {
            console.error(e);
            select.innerHTML = '<option value="">فشل التحميل</option>';
            UIManager.showToast("خطأ في تحميل الكورسات", "error");
        }
    }

    // Load Checks/Prerequisites (Other Lectures in Unit)
    async function loadPrerequisites(unitId, currentPrereqId = null) {
        const select = document.getElementById('prerequisite-select');
        if (!unitId || !select) return;

        select.innerHTML = '<option value="">جاري تحميل المحاضرات...</option>';

        try {
            const q = query(
                collection(db, "course_content"),
                where("unitId", "==", unitId),
                where("type", "==", "lecture")
                // orderBy("order", "asc") // Optional
            );
            const snapshot = await getDocs(q);

            select.innerHTML = '<option value="">لا يوجد (اختياري)</option>';
            snapshot.forEach(doc => {
                // Exclude self if editing
                if (isEditMode && doc.id === editLectureId) return;

                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.innerText = doc.data().title;
                select.appendChild(opt);
            });

            if (currentPrereqId) {
                select.value = currentPrereqId;
            }

        } catch (e) { console.error(e); select.innerHTML = '<option value="">خطأ</option>'; }
    }


    // Load Existing Data for Edit
    async function loadExistingData(id) {
        try {
            const docSnap = await getDoc(doc(db, "course_content", id));
            if (!docSnap.exists()) {
                alert("المحاضرة غير موجودة");
                window.location.href = 'lectures.html';
                return;
            }

            const data = docSnap.data();

            // Set fields & Radios
            // Helper to set Radio
            const setRadio = (name, val) => {
                const r = document.querySelector(`input[name="${name}"][value="${val ? 'yes' : 'no'}"]`);
                if (r) r.checked = true;
                // trigger change
                const event = new Event('change');
                r?.dispatchEvent(event);
            };

            document.getElementById('lecture-title').value = data.title;
            // document.getElementById('lecture-name-display').value = data.displayName || ''; // Removed from new HTML?
            // Checking Step 1616 HTML: Prices inputs exist.

            if (document.getElementById('lecture-price')) document.getElementById('lecture-price').value = data.price || '';
            if (document.getElementById('lecture-renew-price')) document.getElementById('lecture-renew-price').value = data.renewPrice || '';
            if (document.getElementById('lecture-discount')) document.getElementById('lecture-discount').value = data.discount || '';

            setRadio('hasVideo', data.hasVideo);
            // setRadio('hasDrive', data.hasDrive); // Removed from toggle logic, input visible always? No, input id drive-url exists
            // Step 1616 HTML shows drive-url input always visible? Yes.

            setRadio('isLive', data.isLive);
            setRadio('hasExams', data.hasExams);
            // inBundle logic: if unitId exists, usually yes?
            setRadio('inBundle', true); // Default yes

            document.getElementById('video-url').value = data.videoUrl || '';
            document.getElementById('drive-url').value = data.driveUrl || '';

            document.getElementById('views-limit').value = data.viewsLimit || '';
            document.getElementById('days-limit').value = data.daysLimit || '';
            document.getElementById('lecture-order').value = data.order || 1;

            if (data.description && quill) quill.root.innerHTML = data.description;

            // Set Selects (Training first, then Unit, then Prereq)
            if (data.trainingId) {
                const tSelect = document.getElementById('select-training');
                tSelect.value = data.trainingId;
                await loadUnits(data.trainingId); // Loads courses

                if (data.unitId) {
                    document.getElementById('select-unit').value = data.unitId;
                    await loadPrerequisites(data.unitId, data.prerequisiteId);
                }
            }

            if (data.type && document.getElementById('content-type-select')) {
                const ts = document.getElementById('content-type-select');
                ts.value = data.type;
                ts.dispatchEvent(new Event('change'));
            }

        } catch (e) { console.error(e); }
    }


    // Form Submission
    document.getElementById('create-lecture-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const trainingId = document.getElementById('select-training').value;
        const unitId = document.getElementById('select-unit').value;
        const title = document.getElementById('lecture-title').value;

        // Bundle check: If inBundle is YES, must select unit.
        const inBundle = document.querySelector('input[name="inBundle"]:checked').value === 'yes';

        if (!trainingId) {
            UIManager.showToast("يرجى اختيار الدورة التدريبية", "error");
            return;
        }

        if (inBundle && !unitId) {
            UIManager.showToast("يرجى اختيار الكورس (Unit)", "error");
            return;
        }

        const btn = document.getElementById('save-btn');
        btn.disabled = true;
        btn.innerText = "جاري الحفظ...";

        // Helper get Radio Bool
        const getRadioBool = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value === 'yes';

        // Gather Data
        const data = {
            teacherId: currentUserId,
            trainingId,
            unitId: inBundle ? unitId : null, // If not in bundle? logic TBA. Assuming always in unit for now or null.
            title,

            price: Number(document.getElementById('lecture-price').value),
            renewPrice: Number(document.getElementById('lecture-renew-price').value),
            discount: Number(document.getElementById('lecture-discount').value),

            hasVideo: getRadioBool('hasVideo'),
            // hasDrive: getRadioBool('hasDrive'), // Input always there
            hasDrive: !!document.getElementById('drive-url').value, // Auto detect if url exists
            isLive: getRadioBool('isLive'),
            hasExams: getRadioBool('hasExams'),

            videoUrl: document.getElementById('video-url').value,
            driveUrl: document.getElementById('drive-url').value,

            viewsLimit: Number(document.getElementById('views-limit').value),
            daysLimit: Number(document.getElementById('days-limit').value),
            order: Number(document.getElementById('lecture-order').value),

            prerequisiteId: document.getElementById('prerequisite-select')?.value || null,

            description: quill.root.innerHTML,
            type: document.getElementById('content-type-select')?.value || 'lecture',
            // createdAt handled below
        };

        // Thumbnail TODO: Actual Upload logic
        if (!isEditMode) data.thumbnail = 'https://via.placeholder.com/150';

        try {
            let docRef;
            if (isEditMode) {
                data.updatedAt = serverTimestamp();
                await updateDoc(doc(db, "course_content", editLectureId), data);
                await UIManager.showConfirm("نجاح", "تم تعديل المحاضرة بنجاح", "حسناً", null);
            } else {
                data.createdAt = serverTimestamp();
                docRef = await addDoc(collection(db, "course_content"), data);

                // Auto-Notify Students (In-App + Push)
                try {
                    // 1. In-App Notification (Firestore)
                    await addDoc(collection(db, "notifications"), {
                        title: "محاضرة جديدة",
                        body: `تم إضافة محاضرة جديدة: "${title}". تفقدها الآن!`,
                        target: "all_students",
                        teacherId: currentUserId,
                        resourceId: docRef.id,
                        resourceType: 'lecture',
                        createdAt: serverTimestamp()
                    });

                    // 2. Push Notification (OneSignal)
                    await sendOneSignalNotification(
                        "محاضرة جديدة",
                        `تم إضافة محتوى جديد: ${title}`
                    );

                } catch (e) { console.error("Notification Error", e); }

                UIManager.showToast("تم حفظ المحاضرة وإرسال الإشعار", "success");
            }

            // Redirect
            setTimeout(() => {
                window.history.back(); // Go back to where we came from
            }, 1500);

        } catch (error) {
            console.error(error);
            UIManager.showAlert("خطأ", error.message, "error");
            btn.disabled = false;
            btn.innerHTML = isEditMode ? '<i class="fas fa-save"></i> حفظ التعديلات' : '<i class="fas fa-save"></i> حفظ';
        }
    });

    // Helper: Send OneSignal Push
    async function sendOneSignalNotification(title, message) {
        const APP_ID = "3dd814ae-df51-4396-8aca-0877931b7b5f";
        const API_KEY = "os_v2_app_hxmbjlw7kfbzncwkbb3zgg33l6rvdweaxtwejinebzzxqfh6emugtojz2kjm3zpuhptilb6cy7psx5t5lwsfm24hjp4tqldhyovw43q";

        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${API_KEY}`,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                app_id: APP_ID,
                included_segments: ["All"],
                headings: { en: title, ar: title },
                contents: { en: message, ar: message }
            })
        };

        try {
            await fetch('https://onesignal.com/api/v1/notifications', options);
        } catch (e) { console.error("OneSignal Error", e); }
    }

});
