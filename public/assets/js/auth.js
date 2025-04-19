// public/assets/js/auth.js
import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// Sign up function
async function signUp(email, password) {
    console.log("Attempting sign up..."); // Log start
    // Clear previous errors
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Sign up successful! User:", userCredential.user.uid); // Log success
        console.log("Attempting redirect to dashboard from signUp..."); // Log before redirect
        window.location.replace('/brewery/dashboard.html');
        console.log("Redirect command issued from signUp."); // Log after redirect (might not show if redirect is instant)
        // Note: Code execution might stop here due to redirect, return might not always execute
        return userCredential.user;
    } catch (error) {
        console.error("Error signing up:", error);
        // Attempt to display error on the signup page if the element exists
        const errorElement = document.getElementById('error-message'); // Re-get in case it wasn't found initially
        if (errorElement) {
            errorElement.textContent = `Signup Error: ${error.message}`; // Add context
            errorElement.style.display = 'block'; // Ensure it's visible
        }
        // DO NOT re-throw the error here during this debug phase
        // throw error;
        return null; // Indicate failure explicitly if needed
    }
}

// Sign in function
async function signIn(email, password) {
    console.log("Attempting sign in..."); // Log start
     // Clear previous errors
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Sign in successful! User:", userCredential.user.uid); // Log success
        console.log("Attempting redirect to dashboard from signIn..."); // Log before redirect
        window.location.replace('/brewery/dashboard.html');
        console.log("Redirect command issued from signIn."); // Log after redirect (might not show)
        // Note: Code execution might stop here due to redirect, return might not always execute
        return userCredential.user;
    } catch (error) {
        console.error("Error signing in:", error);
         // Attempt to display error on the login page if the element exists
         const errorElement = document.getElementById('error-message'); // Re-get
         if (errorElement) {
             errorElement.textContent = `Signin Error: ${error.message}`; // Add context
             errorElement.style.display = 'block'; // Ensure it's visible
         }
        // DO NOT re-throw error during this debug phase
        // throw error;
        return null; // Indicate failure explicitly if needed
    }
}

// Sign out function
async function logOut() {
    try {
        await signOut(auth);
        console.log("User signed out");
        // Use replace for redirection
        window.location.replace('/login.html');
    } catch (error) {
        console.error("Error signing out:", error);
        // Decide if you need to show an error message on logout failure
        throw error; // Re-throw might be appropriate here
    }
}

// ==============================================================
// REMOVED: Duplicate onAuthStateChanged Listener
// This logic is handled more appropriately in app.js
// ==============================================================

// Attach to window for HTML access (if called via inline onclick, etc.)
// Consider refactoring HTML to use module imports and event listeners instead
window.signUp = signUp;
window.signIn = signIn;
window.logOut = logOut;

// Export functions for potential module usage
export { signUp, signIn, logOut };