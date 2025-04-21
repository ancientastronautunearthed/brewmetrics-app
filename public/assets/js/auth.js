// public/assets/js/auth.js

import { auth } from './firebase-config.js';
// *** ADD sendEmailVerification ***
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// (Keep signUp function as is - though deprecated)
async function signUp(email, password) { /* ... */ }

// Sign in function (UPDATED TO BYPASS VERIFICATION CHECK)
async function signIn(email, password) {
    console.log("Attempting sign in via auth.js...");
    const errorElement = document.getElementById('error-message');
    const resendButton = document.getElementById('resend-verification-btn'); // Keep reference JIC

    // Hide previous messages/buttons
    if (errorElement) errorElement.style.display = 'none';
    if (resendButton) resendButton.style.display = 'none';


    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Sign in successful (pre-verification check)! User:", user.uid);

        // *** BYPASS EMAIL VERIFICATION CHECK ***
        // The check for user.emailVerified is now removed/commented out.

        /*
        // --- START: Original Email Verification Block (Now Bypassed) ---
        if (!user.emailVerified) {
            console.warn(`User ${user.uid} email NOT verified. (Check bypassed in auth.js)`);
            if (errorElement) {
                errorElement.textContent = "Your email address is not verified. Please check your inbox (and spam folder) for the verification link.";
                errorElement.style.display = 'block';
            }
            // Optionally show a "Resend" button
            if (resendButton) {
                resendButton.style.display = 'inline-block'; // Or 'block'
                resendButton.replaceWith(resendButton.cloneNode(true));
                const newResendButton = document.getElementById('resend-verification-btn');
                if (newResendButton) {
                    newResendButton.onclick = async () => { // Resend logic // };
                }
            }
            // IMPORTANT: DO NOT REDIRECT
            return null; // Indicate login didn't fully succeed for access purposes
        }
        // --- END: Original Email Verification Block ---
        */

        // If authentication is successful, proceed to redirect regardless of verification status
        console.log(`User ${user.uid} authenticated. Redirecting to dashboard (verification bypassed)...`);
        window.location.replace('/brewery/dashboard.html');
        return user; // Return the user object

    } catch (error) {
        console.error("Error signing in:", error);
         if (errorElement) {
             // Provide more specific common errors
             if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                 errorElement.textContent = "Invalid email or password.";
             } else {
                errorElement.textContent = `Signin Error: ${error.message}`;
             }
             errorElement.style.display = 'block';
         }
        return null; // Return null on authentication failure
    }
}

// (LOGOUT FUNCTION REMAINS REMOVED)

// Ensure functions are available globally if called directly from HTML onclick (legacy pattern)
// It's better practice to add event listeners in JS, but this maintains compatibility if needed.
window.signIn = signIn;
window.signUp = signUp; // Keep for now if used

// Export for potential module usage elsewhere (though maybe not needed if only used by HTML)
export { signUp, signIn };