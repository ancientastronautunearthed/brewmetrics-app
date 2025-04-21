// public/assets/js/firebase-config.js

// --- Step 1: Add Storage imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-functions.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js"; // <-- ADDED STORAGE IMPORT

// --- Step 2: Your Firebase Config Object ---
const firebaseConfig = {
    apiKey: "AIzaSyDXa75Y6T28vKzb0r3lzi3ReEvQiWQwTBU", // Replace with your actual config
    authDomain: "brewmetrics-app.firebaseapp.com",
    projectId: "brewmetrics-app",
    storageBucket: "brewmetrics-app.appspot.com",
    messagingSenderId: "389116646575",
    appId: "1:389116646575:web:899920c4c996b17c93f05a",
    measurementId: "G-VP3DG2NN3D"
};

// --- Step 3: Initialize App ---
const app = initializeApp(firebaseConfig);

// --- Step 4: Get Service Instances (including Storage) ---
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app); // <-- INITIALIZE STORAGE

// --- Step 5: Connect to Emulators (including Storage) ---
// Ensure ports match your firebase.json emulator config
if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    console.log("Connecting to Firebase Emulators...");
    // Ensure ports match your firebase.json
    connectAuthEmulator(auth, "http://localhost:9092");
    connectFirestoreEmulator(db, 'localhost', 8081);
    connectFunctionsEmulator(functions, "localhost", 5001);
    connectStorageEmulator(storage, "localhost", 9156); // <-- CONNECT STORAGE EMULATOR (Check port 9156 in firebase.json)
    console.log("Connected to Auth, Firestore, Functions, and Storage Emulators.");
} else {
    console.log("Connecting to LIVE Firebase services.");
}

// --- Step 6: Export All Required Services (including Storage) ---
export { auth, db, functions, storage, app }; // <-- ADDED storage TO EXPORTS