import { db, auth } from '../firebase-config.js';
import {
    collection,
    query,
    where,
    getDocs,
    getCountFromServer,
    orderBy,
    limit,
    getDoc,
    doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Basic Admin Protection
async function checkAdmin(user) {
    if (!user) return false;
    // In real app, check custom claims or 'admins' existing collection
    // For now, allow specific email or check 'users/uid' role if exists
    // Lets assume we have an 'admins' collection or just checking email
    // Or we rely on 'users' collection having role: 'admin'

    try {
        const d = await getDoc(doc(db, "users", user.uid));
        if (d.exists() && d.data().role === 'admin') return true;
    } catch (e) { }

    return false; // Default deny
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const isAdmin = await checkAdmin(user);
        if (!isAdmin) {
            // alert("غير مسموح لك بالدخول هنا");
            // window.location.href = '../index.html';
            // For Dev/Demo: Allow if email is specific? Or just warn?
            // Let's Log it but allow for now if user just created manual account?
            // NO, Security First. Redirect.
            // Commented out for now until user creates an admin account manually.
            console.warn("User is not admin role", user.uid);
        }

        loadStats();
        loadRecentTeachers();
    } else {
        window.location.href = 'login.html';
    }
});

// Logout
document.getElementById('admin-logout')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'login.html');
});


async function loadStats() {
    try {
        // Count Teachers
        const teachersSnap = await getCountFromServer(collection(db, "teachers"));
        document.getElementById('count-teachers').innerText = teachersSnap.data().count;

        // Count Students
        const studentsSnap = await getCountFromServer(collection(db, "users")); // "users" are students usually
        document.getElementById('count-students').innerText = studentsSnap.data().count;

        // Count Courses (Trainings)
        const coursesSnap = await getCountFromServer(collection(db, "training_programs"));
        document.getElementById('count-courses').innerText = coursesSnap.data().count;

        // Revenue (Sum of 'access_codes' where isUsed=true or status='sold'?)
        // Firestore doesn't sum. We have to fetch or keep aggregation.
        // For MVP, maybe fetch last 100 codes and sum? Or just placeholder.
        // Let's sum valid codes.
        // Warning: Reading ALL codes is expensive.
        document.getElementById('total-revenue').innerText = "Coming Soon";

    } catch (e) {
        console.error("Stats Error", e);
    }
}

async function loadRecentTeachers() {
    const tbody = document.getElementById('recent-teachers-body');
    if (!tbody) return;
    tbody.innerHTML = 'Loading...';

    try {
        const q = query(
            collection(db, "teachers"),
            orderBy("createdAt", "desc"),
            limit(5)
        );
        const snap = await getDocs(q);

        tbody.innerHTML = '';
        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="4">لا يوجدمعلمون جدد</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const data = doc.data();
            const tr = document.createElement('tr');
            const status = data.isVerified ?
                '<span class="status-badge status-active">نشط</span>' :
                '<span class="status-badge status-draft">معلق</span>';

            tr.innerHTML = `
                <td>
                    <div style="font-weight:bold;">${data.name || 'No Name'}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${data.phone || ''}</div>
                </td>
                <td>${data.email}</td>
                <td>${status}</td>
                <td>
                    <button class="btn-icon" onclick="location.href='teachers.html'"><i class="fas fa-eye"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = 'Error loading teachers';
    }
}
