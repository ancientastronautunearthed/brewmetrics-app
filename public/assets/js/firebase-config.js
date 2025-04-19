// public/assets/js/firebase-config.js
const firebaseConfig = {
    apiKey: "AIzaSyDXa75Y6T28vKzb0r3lzi3ReEvQiWQwTBU",
    authDomain: "brewmetrics-app.firebaseapp.com",
    projectId: "brewmetrics-app",
    storageBucket: "brewmetrics-app.appspot.com",
    messagingSenderId: "389116646575",
    appId: "1:389116646575:web:899920c4c996b17c93f05a",
    measurementId: "G-VP3DG2NN3D"
};

// Initialize Firebase

// Import SDKs using CDN links
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";         // <-- Added connectAuthEmulator here
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // <-- Added connectFirestoreEmulator here
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-functions.js"; // <-- CORRECTED Functions import

// Your firebaseConfig object goes here (as defined before)
// const firebaseConfig = { ... };

const app = initializeApp(firebaseConfig);

// Get instances
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app); // Now this should work

// --- CONNECT TO EMULATORS ---
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("Connecting to Firebase Emulators...");
    connectAuthEmulator(auth, "http://localhost:9092");
    connectFirestoreEmulator(db, 'localhost', 8081);
    connectFunctionsEmulator(functions, "localhost", 5001); // Use localhost/port here
} else {
    console.log("Connecting to LIVE Firebase services.");
}

// Export the initialized services
export { auth, db, functions, app };