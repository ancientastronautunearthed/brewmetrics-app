// public/assets/js/auth.js

import { auth } from './firebase-config.js';
// *** ADD sendEmailVerification ***
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

// (Keep signUp function as is - though deprecated)
async function signUp(email, password) { /* ... */ }

// Sign in function (UPDATED WITH VERIFICATION CHECK)
async function signIn(email, password) {
    console.log("Attempting sign in via auth.js...");
    const errorElement = document.getElementById('error-message');
    const resendButton = document.getElementById('resend-verification-btn'); // Add a resend button to login.html if desired

    // Hide previous messages/buttons
    if (errorElement) errorElement.style.display = 'none';
    if (resendButton) resendButton.style.display = 'none';


    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Sign in successful (pre-verification check)! User:", user.uid);

        // *** CHECK EMAIL VERIFICATION ***
        if (!user.emailVerified) {
            console.warn(`User ${user.uid} email NOT verified.`);
            if (errorElement) {
                errorElement.textContent = "Your email address is not verified. Please check your inbox (and spam folder) for the verification link.";
                errorElement.style.display = 'block';
            }
            // Optionally show a "Resend" button
            if (resendButton) {
                resendButton.style.display = 'inline-block'; // Or 'block'
                // Remove previous listener if any
                resendButton.replaceWith(resendButton.cloneNode(true)); // Simple way to remove listeners
                const newResendButton = document.getElementById('resend-verification-btn'); // Get the new clone
                if (newResendButton) {
                    newResendButton.onclick = async () => { // Use onclick for simplicity here, or addEventListener
                         try {
                             await sendEmailVerification(user);
                             if (errorElement) {
                                 errorElement.textContent = "Verification email resent. Please check your inbox.";
                                 errorElement.style.display = 'block';
                             }
                             newResendButton.style.display = 'none'; // Hide after sending
                         } catch (resendError) {
                             console.error("Error resending verification email:", resendError);
                             if (errorElement) {
                                 errorElement.textContent = `Error resending email: ${resendError.message}`;
                                 errorElement.style.display = 'block';
                             }
                         }
                    };
                }
            }
            // IMPORTANT: DO NOT REDIRECT
            return null; // Indicate login didn't fully succeed for access purposes
        }

        // If verified, proceed to redirect
        console.log(`User ${user.uid} email IS verified. Redirecting to dashboard...`);
        window.location.replace('/brewery/dashboard.html');
        return user; // Return the verified user

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
        return null;
    }
}

// (LOGOUT FUNCTION REMAINS REMOVED)

window.signIn = signIn;
window.signUp = signUp; // Keep for now

export { signUp, signIn };