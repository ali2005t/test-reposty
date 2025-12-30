import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8vGz87P52E8q2ayft-yOBstywyRHJ344",
    authDomain: "eduhive-6db28.firebaseapp.com",
    databaseURL: "https://eduhive-6db28-default-rtdb.firebaseio.com",
    projectId: "eduhive-6db28",
    storageBucket: "eduhive-6db28.firebasestorage.app",
    messagingSenderId: "778043381002",
    appId: "1:778043381002:web:f3c345c9c2f3d5eeb056f3",
    measurementId: "G-5V7JHPNMS3"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, analytics, firebaseConfig };
