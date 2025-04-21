// public/assets/js/signup-brewery.js

console.log("signup-brewery.js script loaded.");

// --- Imports ---
import { auth, db, storage } from './firebase-config.js';
// *** ADD sendEmailVerification import ***
import { createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// --- DOM Element References ---
// (Keep all existing references)
const signupForm = document.getElementById('brewery-signup-form');
const emailInput = document.getElementById('signup-email');
const passwordInput = document.getElementById('signup-password');
const passwordConfirmInput = document.getElementById('signup-password-confirm');
const breweryNameInput = document.getElementById('brewery-name');
const logoFileInput = document.getElementById('logo-upload');
const logoPreview = document.getElementById('logo-preview');
const descriptionInput = document.getElementById('brewery-description');
const addressStreetInput = document.getElementById('address-street');
const addressCityInput = document.getElementById('address-city');
const addressStateInput = document.getElementById('address-state');
const addressZipInput = document.getElementById('address-zip');
const addressCountryInput = document.getElementById('address-country');
const publicPhoneInput = document.getElementById('public-phone');
const websiteUrlInput = document.getElementById('website-url');
const submitButton = document.getElementById('submit-signup-btn');
const loadingIndicator = document.getElementById('loading-indicator');
const errorMessageDiv = document.getElementById('error-message');
// *** ADD a success message area (optional but good UX) ***
const successMessageDiv = document.getElementById('success-message'); // Assumes you add <div id="success-message" class="success-message" style="display: none;"></div> to your HTML

// --- Helper Functions ---

// Add or modify showSuccess function
function showSuccess(message) {
    console.log("Signup Success:", message);
    if (successMessageDiv) {
        successMessageDiv.textContent = message;
        successMessageDiv.style.display = 'block';
        successMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // Fallback if the success div doesn't exist
        alert(message);
    }
    if (errorMessageDiv) errorMessageDiv.style.display = 'none'; // Hide error
    if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide loading
    // Keep button disabled after successful submission to prevent duplicates
    if (submitButton) submitButton.disabled = true;
    // Optionally hide the form itself
    // if (signupForm) signupForm.style.display = 'none';
}


function showError(message) {
    console.error("Signup Error:", message);
    if (errorMessageDiv) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
        errorMessageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (successMessageDiv) successMessageDiv.style.display = 'none'; // Hide success
    if (loadingIndicator) loadingIndicator.style.display = 'none'; // Hide loading
    if(submitButton) submitButton.disabled = false; // Re-enable button on error
}

function showLoading(isLoading) {
    if (isLoading) {
        if (errorMessageDiv) errorMessageDiv.style.display = 'none';
        if (successMessageDiv) successMessageDiv.style.display = 'none';
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if(submitButton) submitButton.disabled = true;
    } else {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        // Don't re-enable button here, handle in showError/showSuccess
    }
}

// (keep getFileExtension function)
function getFileExtension(filename) {
    if (!filename || typeof filename !== 'string') return '';
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}


// --- Event Listeners ---
// (Keep Logo Preview Listener as is)
if (logoFileInput && logoPreview) {
    logoFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                logoPreview.src = e.target.result;
                logoPreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
             const uploadArea = document.getElementById('logo-upload-area');
             if (uploadArea) uploadArea.textContent = `Selected: ${file.name}`;
        } else {
            logoPreview.src = '#';
            logoPreview.style.display = 'none';
             const uploadArea = document.getElementById('logo-upload-area');
             if (uploadArea) uploadArea.textContent = 'Click or drag here to upload logo';
            if (file) {
                 if (typeof showError === 'function') {
                    showError("Please select a valid image file (PNG, JPG, SVG).");
                 }
                 logoFileInput.value = '';
            }
        }
    });
} else {
     console.warn("Logo input or preview element not found.");
}

// --- Form Submission Listener ---
if (signupForm) {
    console.log("Attaching submit listener to form.");
    signupForm.addEventListener('submit', async (event) => {
        console.log("Submit event triggered!");
        event.preventDefault();
        console.log("Default form submission prevented.");

        if (typeof showLoading !== 'function' || typeof showError !== 'function' || typeof showSuccess !== 'function') {
            console.error("showLoading, showError, or showSuccess function is not defined!");
            if (submitButton) submitButton.disabled = true;
            return;
        }

        showLoading(true);

        // --- Get Form Values ---
        // (Keep form value retrieval as is)
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        const passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : '';
        const breweryName = breweryNameInput ? breweryNameInput.value.trim() : '';
        const logoFile = logoFileInput ? logoFileInput.files[0] : null;
        const description = descriptionInput ? descriptionInput.value.trim() : '';
        const addressStreet = addressStreetInput ? addressStreetInput.value.trim() : '';
        const addressCity = addressCityInput ? addressCityInput.value.trim() : '';
        const addressState = addressStateInput ? addressStateInput.value.trim() : '';
        const addressZip = addressZipInput ? addressZipInput.value.trim() : '';
        const addressCountry = addressCountryInput ? addressCountryInput.value.trim() : '';
        const publicPhone = publicPhoneInput ? publicPhoneInput.value.trim() : '';
        const websiteUrl = websiteUrlInput ? websiteUrlInput.value.trim() : '';


        // --- Client-Side Validation ---
        // (Keep validation as is)
        if (!emailInput || !passwordInput || !passwordConfirmInput || !breweryNameInput || !addressStreetInput || !addressCityInput || !addressStateInput || !addressZipInput || !addressCountryInput) {
             console.error("One or more required form input elements not found in the DOM.");
             showError("A required form field is missing. Please contact support.");
             return;
        }
        if (!email || !password || !passwordConfirm || !breweryName || !addressStreet || !addressCity || !addressState || !addressZip || !addressCountry) {
            showError("Please fill in all required fields (Account, Brewery Name, Full Address).");
            return;
        }
        if (password.length < 6) {
             showError("Password must be at least 6 characters long.");
             return;
        }
        if (password !== passwordConfirm) {
            showError("Passwords do not match.");
            return;
        }
        if (logoFile && logoFile.size > 2 * 1024 * 1024) {
             showError("Logo file is too large (Max 2MB).");
             return;
        }
         const logoExt = logoFile ? (typeof getFileExtension === 'function' ? getFileExtension(logoFile.name).toLowerCase() : '') : '';
         if (logoFile && !['png', 'jpg', 'jpeg', 'svg'].includes(logoExt)) {
              showError("Invalid logo file type. Please use PNG, JPG, or SVG.");
              return;
         }

        let userCredentialForVerification = null; // Store the user credential

        try {
            // --- Step 1: Create Firebase Auth User ---
            console.log("Attempting to create auth user...");
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const userId = userCredential.user.uid;
            userCredentialForVerification = userCredential; // Store for verification step
            console.log("Auth user created successfully:", userId);

            // --- Step 2: Upload Logo (if provided) ---
            // (Keep logo upload logic as is)
            let logoUrl = null;
            if (logoFile) {
                console.log("Logo file detected, attempting upload...");
                const fileExtension = logoExt;
                const logoPath = `logos/${userId}/logo.${fileExtension}`;
                const storageRef = ref(storage, logoPath);
                console.log(`Uploading logo to: ${logoPath}`);
                const uploadResult = await uploadBytes(storageRef, logoFile);
                console.log("Logo uploaded successfully:", uploadResult);
                logoUrl = await getDownloadURL(uploadResult.ref);
                console.log("Logo download URL obtained:", logoUrl);
            } else {
                console.log("No logo file provided.");
            }


            // --- Step 3: Prepare Firestore Profile Data ---
            // (Keep profile data preparation as is)
             const breweryProfileData = {
                ownerId: userId, email: email, breweryName: breweryName, logoUrl: logoUrl, description: description || null, address: { street: addressStreet, city: addressCity, state: addressState, zip: addressZip, country: addressCountry, }, publicPhone: publicPhone || null, websiteUrl: websiteUrl || null, createdAt: serverTimestamp(),
             };
            console.log("Preparing Firestore data:", breweryProfileData);


            // --- Step 4: Write Profile to Firestore ---
            const breweryDocRef = doc(db, "breweries", userId);
            console.log(`Attempting to set Firestore document at: breweries/${userId}`);
            await setDoc(breweryDocRef, breweryProfileData);
            console.log("Firestore profile created successfully!");

            // --- Step 5: Send Verification Email ---
            console.log("Attempting to send verification email...");
            await sendEmailVerification(userCredentialForVerification.user);
            console.log("Verification email sent successfully.");

            // --- Step 6: Show Success Message (NO REDIRECT) ---
            console.log("Signup process complete. Showing success message.");
            showSuccess(`Account created for ${email}. Please check your inbox (and spam folder!) for a verification email. Click the link in the email to activate your account before logging in.`);
            // NO window.location.replace here!

        } catch (error) {
            // --- Comprehensive Error Handling ---
            console.error("Error during signup process:", error);
            let userMessage = "An unexpected error occurred during signup. Please try again.";

             // Handle verification email sending error specifically
             if (error.code === 'auth/missing-ios-bundle-id' || error.message.includes('sendEmailVerification')) {
                 // This usually means Action URL domain isn't authorized in console, or config issues
                 console.error("Error sending verification email:", error);
                 userMessage = "Account created, but failed to send verification email. Please try logging in later or contact support.";
                 // Show success for account creation, but warn about email
                 showSuccess(`Account created for ${email}, BUT failed to send verification email. Please contact support if you cannot log in after some time.`);
                 return; // Exit after showing mixed success/error
             }


            // Keep existing Auth/Storage/Firestore error handling
            if (error && error.code) {
                switch (error.code) {
                    case 'auth/email-already-in-use': userMessage = "This email address is already registered. Please log in or use a different email."; break;
                    case 'auth/weak-password': userMessage = "The password is too weak. Please use a stronger password (at least 6 characters)."; break;
                    case 'auth/invalid-email': userMessage = "The email address provided is not valid."; break;
                    default: userMessage = `An authentication error occurred (${error.code}). Please try again.`; break;
                }
            } else if (error && error.name === 'FirebaseError' && error.message && error.message.includes('storage/')) {
                console.error("Detailed Storage Error:", error); userMessage = "Error uploading logo. Please check the file and try again, or skip the logo for now.";
            } else if (error && error.name === 'FirebaseError' && error.message && error.message.includes('firestore/')) {
                 console.error("Detailed Firestore Error:", error); userMessage = "Error saving brewery profile. Your account may have been created, but profile setup failed. Please contact support.";
            } else if (error instanceof Error) {
                 userMessage = `An unexpected client-side error occurred: ${error.message}`;
             }

            showError(userMessage);
            // NOTE: If Auth user was created but subsequent steps failed (Firestore, Verification Email),
            // the user exists but might be in a limbo state. Robust cleanup is complex client-side.
        }
        // No finally needed here

    }); // End form submit listener
} else {
    console.error("Brewery signup form element with ID 'brewery-signup-form' was not found!");
     if (typeof showError === 'function') {
        showError("Signup form could not be found. Please contact support.");
    }
}