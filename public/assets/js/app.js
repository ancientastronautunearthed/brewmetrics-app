// public/assets/js/app.js
// SECTION 1: Imports and Constants
// Goal: Import Firebase modules, remove unused constants.

import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged,
    signOut,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    serverTimestamp,
    orderBy,
    Timestamp,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// --- Constants REMOVED: SURVEY_CATEGORIES, METRIC_MAP, TOOLTIP_MAP ---
// Standard survey content is now centralized in 'survey-content.js'
// used by the patron app and the scoring cloud function.

// --- END OF SECTION 1 ---

// --- START OF SECTION 2: DOM Elements & Global Variables ---
// Goal: Define globals and get references to HTML elements.

// --- Global Variables ---
let currentUserId = null;
let currentBreweryId = null;
// let currentBreweryData = null; // Could store brewery data globally if needed frequently

// --- DOM Elements ---
const authStatusDiv = document.getElementById('auth-status');
const dashboardContentDiv = document.getElementById('dashboard-content');
const errorMessageDiv = document.getElementById('error-message');
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const batchForm = document.getElementById('batch-form');
const batchFormTitle = document.getElementById('batch-form-title');
const batchesListDiv = document.getElementById('batches-list');
const editingBatchIdInput = document.getElementById('editing-batch-id');
const saveBatchBtn = document.getElementById('save-batch-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const addCustomQBtn = document.getElementById('add-custom-q-btn');
const customQuestionsContainer = document.getElementById('custom-questions-container');
const noCustomQuestionsMessage = document.getElementById('no-custom-questions-message');
const publicUrlInput = document.getElementById('public-url-input');
const copyUrlBtn = document.getElementById('copy-url-btn');
const generateQrBtn = document.getElementById('generate-qr-btn');
const hideQrBtn = document.getElementById('hide-qr-btn');
const qrCodeDisplay = document.getElementById('qr-code-display');
const copySuccessMsg = document.getElementById('copy-success');
const verifyEmailNotice = document.getElementById('verify-email-notice');
// Note: Input elements like 'batch-name', 'batch-label-icon-url' etc.,
// are accessed via the form when needed, no separate constants required.

// --- END OF SECTION 2 ---

// --- START OF SECTION 3: Helper Functions ---
// Goal: Define utility UI functions and the form reset logic.

// Utility Functions
function showElement(element) { if (element) element.style.display = 'block'; }
function hideElement(element) { if (element) element.style.display = 'none'; }
function displayError(message) { if (errorMessageDiv) { errorMessageDiv.textContent = `Error: ${message}`; showElement(errorMessageDiv); } console.error("Dashboard Error:", message); }
function clearError() { if (errorMessageDiv) { errorMessageDiv.textContent = ''; hideElement(errorMessageDiv); } }
function setLoading(button, isLoading, defaultText = 'Save') { if (!button) return; button.disabled = isLoading; const span = button.querySelector('.btn-content'); if (span) { span.textContent = isLoading ? 'Saving...' : defaultText; } }

/**
 * Resets the batch form to its initial "Create New Batch" state.
 * Clears standard inputs, custom questions, icon URL, and resets buttons/titles.
 */
function resetBatchForm() {
    console.log("Resetting batch form.");
    if (batchForm) batchForm.reset(); // Clears standard inputs bound to the form

    if (editingBatchIdInput) editingBatchIdInput.value = '';
    if (batchFormTitle) batchFormTitle.textContent = 'Create New Batch';
    if (saveBatchBtn) {
        const saveButtonContent = saveBatchBtn.querySelector('.btn-content');
        if (saveButtonContent) {
            const iconHTML = '<span class="icon icon-save"></span>';
            saveButtonContent.innerHTML = `${iconHTML}Save Batch`;
        }
        saveBatchBtn.disabled = false; // Ensure button is enabled
    }
    if (cancelEditBtn) hideElement(cancelEditBtn);

    // Clear dynamic custom questions
    if (customQuestionsContainer) customQuestionsContainer.innerHTML = '';
    if (noCustomQuestionsMessage) showElement(noCustomQuestionsMessage);

    // Clear any input error styling
    batchForm?.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    clearError(); // Also clear global errors
    console.log("Batch form reset complete.");
}

// --- END OF SECTION 3 ---

// --- START OF SECTION 4: Authentication & Brewery ID Fetching ---
// Goal: Handle auth state, fetch brewery context, trigger init.

/** Displays email verification notice and adds resend functionality. */
function showVerificationNotice(user) {
    if (!verifyEmailNotice) return;
    verifyEmailNotice.innerHTML = `Please verify your email address. <button id="resend-verification-btn" class="btn btn-link btn-small">Resend Verification</button>`;
    showElement(verifyEmailNotice);
    const resendBtn = document.getElementById('resend-verification-btn');
    if (resendBtn) {
        resendBtn.onclick = async () => {
            try {
                resendBtn.disabled = true;
                resendBtn.textContent = 'Sending...';
                await sendEmailVerification(user);
                alert('Verification email sent! Check your inbox (and spam folder).');
                resendBtn.textContent = 'Sent!';
            } catch (error) {
                console.error("Error sending verification email:", error);
                alert(`Failed to send verification email: ${error.message}`);
                resendBtn.textContent = 'Resend Failed';
                // Re-enable after a delay? Or keep disabled?
                setTimeout(() => {
                     resendBtn.disabled = false;
                     resendBtn.textContent = 'Resend Verification';
                }, 3000);
            }
        };
    }
}

/** Fetches the breweryId associated with the logged-in user from Firestore. */
async function fetchUserBreweryId(userId) {
    console.log(`Fetching brewery ID for user: ${userId}`);
    if (!userId) {
         console.error("fetchUserBreweryId called without userId.");
         displayError("Authentication error. Cannot load brewery.");
         return; // Stop if no user ID
     }
    try {
        // Assumes a 'users' collection where each doc ID is the user's UID
        // and contains a 'breweryId' field. Adjust if your structure differs.
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().breweryId) {
            currentBreweryId = userDocSnap.data().breweryId;
            console.log("Found Brewery ID:", currentBreweryId);
            // *** Trigger dashboard initialization now that we have the context ***
            initDashboard();
        } else {
            console.error("Brewery ID not found for user:", userId);
            displayError("Could not find associated brewery. Please ensure your account is linked correctly or contact support.");
            // Prevent further dashboard loading if brewery isn't linked
            hideElement(dashboardContentDiv);
            showElement(authStatusDiv); // Show a status message maybe?
            if(authStatusDiv) authStatusDiv.textContent = "Brewery link missing for this account.";
        }
    } catch (error) {
        console.error("Error fetching brewery ID:", error);
        displayError(`Failed to load brewery information: ${error.message}`);
        hideElement(dashboardContentDiv); // Hide dashboard on error
    }
}

/** Main listener for Firebase Authentication state changes. */
onAuthStateChanged(auth, (user) => {
    hideElement(authStatusDiv); // Hide "Checking authentication..." message
    if (user) {
        // USER IS SIGNED IN
        console.log("Auth State Changed: User is signed in:", user.uid);
        currentUserId = user.uid; // Set global userId
        if (userEmailSpan) userEmailSpan.textContent = user.email || 'User Account';

        // --- Email Verification Handling (Optional - currently bypassed) ---
        // if (!user.emailVerified) {
        //     showVerificationNotice(user);
        //     hideElement(dashboardContentDiv); // Optionally hide dashboard until verified
        // } else {
            hideElement(verifyEmailNotice); // Hide notice if verified or bypassed
            // Fetch brewery ID, which will then call initDashboard if successful
            fetchUserBreweryId(user.uid);
            showElement(dashboardContentDiv); // Show the main container immediately
        // }

    } else {
        // USER IS SIGNED OUT
        console.log("Auth State Changed: User is signed out.");
        currentUserId = null;
        currentBreweryId = null;
        if (userEmailSpan) userEmailSpan.textContent = '';
        hideElement(verifyEmailNotice);
        hideElement(dashboardContentDiv);
        if(dashboardContentDiv) dashboardContentDiv.dataset.initialized = 'false'; // Reset init flag

        // Redirect to login if trying to access dashboard while logged out
        if (window.location.pathname.includes('/brewery/dashboard.html')) {
            console.log("Redirecting to login page.");
            window.location.href = '/login.html'; // Adjust path if needed
        }
    }
});

// --- END OF SECTION 4 ---

// --- START OF SECTION 5: Public URL / QR Code ---
// Goal: Display public URL and handle QR code generation. (No changes needed)

/** Updates the Public URL input and enables QR button */
function updateBreweryPublicUrl() {
    if (currentBreweryId && publicUrlInput) {
        // URL points to the page where patrons select an ACTIVE batch for THIS brewery
        const selectBatchUrl = `${window.location.origin}/select-batch/?breweryId=${currentBreweryId}`;
        publicUrlInput.value = selectBatchUrl;
        // Enable QR button only if the QRCode library is loaded
        generateQrBtn.disabled = (typeof QRCode === 'undefined');
        if (typeof QRCode === 'undefined') {
            console.warn("QRCode library not loaded. QR generation disabled.");
        }
    } else {
         publicUrlInput.value = 'Brewery not loaded...';
         generateQrBtn.disabled = true;
    }
}

// Copy URL Button Listener
copyUrlBtn?.addEventListener('click', () => {
    if (!publicUrlInput || publicUrlInput.value === 'Brewery not loaded...') return;
    publicUrlInput.select();
    publicUrlInput.setSelectionRange(0, 99999); // For mobile selection
    try {
        // Modern async clipboard API
        navigator.clipboard.writeText(publicUrlInput.value).then(() => {
            showElement(copySuccessMsg);
            setTimeout(() => hideElement(copySuccessMsg), 2000);
        }).catch(err => {
            console.error('Async copy failed: ', err);
            alert('Failed to copy link. Please copy manually.');
        });
    } catch (err) { // Fallback for older execCommand (less reliable)
        try {
             document.execCommand('copy');
             showElement(copySuccessMsg);
             setTimeout(() => hideElement(copySuccessMsg), 2000);
        } catch (execErr) {
             console.error('execCommand copy failed: ', execErr);
             alert('Failed to copy link. Please copy manually.');
        }
    }
});

// Generate QR Button Listener
generateQrBtn?.addEventListener('click', () => {
    const url = publicUrlInput.value;
    if (url && url !== 'Brewery not loaded...' && typeof QRCode !== 'undefined') {
        qrCodeDisplay.innerHTML = ''; // Clear previous QR
        try {
            new QRCode(qrCodeDisplay, {
                text: url, width: 160, height: 160,
                colorDark: "#2C1B18", colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            showElement(qrCodeDisplay);
            showElement(hideQrBtn);
            hideElement(generateQrBtn);
        } catch (qrError) {
            console.error("QR Code generation error:", qrError);
            alert("Failed to generate QR code.");
            qrCodeDisplay.innerHTML = '<p class="error-message">QR generation failed.</p>';
        }
    } else {
        alert("Cannot generate QR code. URL not available or library missing.");
    }
});

// Hide QR Button Listener
hideQrBtn?.addEventListener('click', () => {
    hideElement(qrCodeDisplay);
    hideElement(hideQrBtn);
    showElement(generateQrBtn);
});

// --- END OF SECTION 5 ---

// --- START OF SECTION 6: Batch Form Logic (Custom Questions UI) ---
// Goal: Handle adding/removing custom question input rows.

/**
 * Dynamically add a row for a new custom question (text input only).
 * @param {object} question - Optional existing question data { questionId, questionText }
 */
function addCustomQuestionRow(question = { questionId: '', questionText: '' }) {
    // Ensure container elements exist
    if (!customQuestionsContainer || !noCustomQuestionsMessage) {
        console.error("Custom question container or message element not found.");
        return;
    }
    hideElement(noCustomQuestionsMessage); // Hide the 'no questions' message

    const questionIndex = customQuestionsContainer.querySelectorAll('.custom-question-item').length;

    // Generate a temporary client-side ID for new questions, use existing DB ID if loading
    // Ensures label 'for' attribute is unique even if DB IDs aren't present yet
    const tempClientSideId = `temp_${Date.now()}_${questionIndex}`;
    // Use the actual database ID if provided (for linking during save/load), otherwise null
    const databaseId = question.questionId || null;

    const div = document.createElement('div');
    div.className = 'custom-question-item';
    // Store the DATABASE ID here if it exists, used when saving updates
    if (databaseId) {
        div.dataset.questionDbId = databaseId;
    }

    const inputId = `custom-q-text-${tempClientSideId}`; // Unique ID for the input element itself

    div.innerHTML = `
        <span class="question-number"><strong>${questionIndex + 1}.</strong></span>
        <div class="form-group">
            <label for="${inputId}" class="sr-only">Custom Question Text:</label> <!-- Label for accessibility -->
            <input type="text" id="${inputId}" class="custom-question-input" placeholder="Enter your optional custom question" value="${question.questionText || ''}" required>
        </div>
        <button type="button" class="btn btn-danger remove-custom-q-btn" title="Remove Question">Remove</button>
    `;
    customQuestionsContainer.appendChild(div);

    // Focus the newly added input for better UX
    const newInput = div.querySelector(`#${inputId}`);
    if (newInput) {
        newInput.focus();
    }
}

/** Renumbers the visual 'X.' prefix for custom questions in the UI */
function renumberCustomQuestions() {
     if (!customQuestionsContainer) return;
     const remainingItems = customQuestionsContainer.querySelectorAll('.custom-question-item');
     remainingItems.forEach((item, index) => {
         const numberSpan = item.querySelector('.question-number strong');
         if (numberSpan) numberSpan.textContent = `${index + 1}.`;
     });
     // Show 'no questions' message if container becomes empty
     if (remainingItems.length === 0 && noCustomQuestionsMessage) {
         showElement(noCustomQuestionsMessage);
     }
}

// --- Event Listener Setup (Partial - Add Button Only) ---
// The actual attachment of this listener happens later in setupDashboardEventListeners
// This defines *what* happens when the button is clicked.
function handleAddCustomQuestionClick() {
    // Optional: Implement limit check here if desired
    // const currentCount = customQuestionsContainer.querySelectorAll('.custom-question-item').length;
    // if (currentCount >= MAX_CUSTOM_QUESTIONS) {
    //     alert(`You can add a maximum of ${MAX_CUSTOM_QUESTIONS} custom questions.`);
    //     return;
    // }
    addCustomQuestionRow(); // Add an empty row
}

// The remove logic is handled via event delegation later.

// --- END OF SECTION 6 ---// --- START OF SECTION 7: Batch Form Saving/Loading ---
// Goal: Load batch data into the form for editing, save new/updated batch data.

/**
 * Load existing batch data into the form for editing.
 * Populates standard fields, icon URL, and custom questions.
 */
async function loadBatchDataIntoForm(batchId) {
    console.log(`Loading batch ${batchId} for editing.`);
    clearError(); // Clear any previous errors
    resetBatchForm(); // Start with a clean form

    // Get necessary form elements (defined globally or retrieved here)
    const formTitle = document.getElementById('batch-form-title');
    const saveButton = document.getElementById('save-batch-btn');
    const cancelButton = document.getElementById('cancel-edit-btn');
    const editingBatchIdInput = document.getElementById('editing-batch-id');
    // Input fields will be accessed via getElementById below

    if (!formTitle || !saveButton || !cancelButton || !editingBatchIdInput || !customQuestionsContainer) {
         console.error("Critical form elements missing. Cannot load batch.");
         displayError("Form error. Cannot load batch data.");
         return;
    }


    try {
        const batchRef = doc(db, "batches", batchId);
        const batchSnap = await getDoc(batchRef);

        if (batchSnap.exists()) {
            const data = batchSnap.data();

            // Populate Standard Fields
            document.getElementById('batch-name').value = data.batchName || '';
            document.getElementById('batch-style').value = data.style || '';
            document.getElementById('batch-abv').value = data.abv || '';
            document.getElementById('batch-ibu').value = data.ibu || '';
            document.getElementById('batch-description').value = data.description || '';
            document.getElementById('batch-brewers-notes').value = data.brewersNotes || '';
            document.getElementById('batch-incentive-text').value = data.incentiveText || '';
            document.getElementById('batch-introduction-text').value = data.batchIntroductionText || '';
            // Populate NEW Fields
            document.getElementById('batch-label-icon-url').value = data.batchLabelIconUrl || '';

            // Populate Custom Questions using addCustomQuestionRow
            customQuestionsContainer.innerHTML = ''; // Clear container first
            if (data.customQuestions && data.customQuestions.length > 0) {
                hideElement(noCustomQuestionsMessage);
                // Pass the existing question object which includes questionId and questionText
                data.customQuestions.forEach(q => addCustomQuestionRow(q));
            } else {
                 showElement(noCustomQuestionsMessage); // Show if no custom Qs loaded
            }

            // --- Logic for old surveyConfig REMOVED ---

            // Update UI for edit mode
            editingBatchIdInput.value = batchId;
            formTitle.textContent = `Edit Batch: ${data.batchName || 'Unnamed'}`;
            const saveButtonContent = saveButton.querySelector('.btn-content');
            if (saveButtonContent) saveButtonContent.innerHTML = `<span class="icon icon-save"></span>Update Batch`;
            showElement(cancelButton);

            // Scroll form into view
            batchForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            console.log(`Batch ${batchId} loaded into form.`);

        } else {
            console.error("Batch not found for editing:", batchId);
            displayError("Could not find the batch to edit.");
            resetBatchForm(); // Reset if batch disappeared
        }
    } catch (error) {
        console.error("Error loading batch for edit:", error);
        displayError(`Failed to load batch data: ${error.message}`);
        resetBatchForm(); // Reset on error
    }
}

/**
 * Saves batch data (handles both Create and Update).
 * Collects standard details, icon URL, and custom questions.
 * Returns true on success, false on failure.
 */
async function saveBatch() {
    clearError();
    const editingBatchId = editingBatchIdInput.value;
    const isEditing = !!editingBatchId;
    const saveButtonDefaultText = isEditing ? 'Update Batch' : 'Save Batch';
    setLoading(saveBatchBtn, true, saveButtonDefaultText);

    if (!currentBreweryId) {
        displayError("Cannot save batch: Brewery ID not found.");
        setLoading(saveBatchBtn, false, saveButtonDefaultText);
        return false;
    }

    // --- Basic Validation ---
    const batchNameInput = document.getElementById('batch-name');
    const batchName = batchNameInput?.value.trim();
    batchNameInput?.classList.remove('input-error'); // Clear previous error
    if (!batchName) {
        displayError("Batch Name is required.");
        batchNameInput?.classList.add('input-error');
        batchNameInput?.focus();
        setLoading(saveBatchBtn, false, saveButtonDefaultText);
        return false;
    }

    // --- Collect Custom Questions ---
    const customQuestions = [];
    let customQuestionsValid = true;
    const customQuestionItems = customQuestionsContainer.querySelectorAll('.custom-question-item');

    customQuestionItems.forEach((item) => {
        const input = item.querySelector('.custom-question-input');
        const questionText = input?.value.trim();
        // Get the actual DB ID if editing, otherwise it will be null/undefined
        const existingDbId = item.dataset.questionDbId;

        input?.classList.remove('input-error'); // Clear previous error state

        if (!questionText) {
             customQuestionsValid = false;
             input?.classList.add('input-error');
        } else {
             customQuestions.push({
                 // Generate a NEW unique ID only if one doesn't exist from loading
                 questionId: existingDbId || `custom_${Date.now()}_${customQuestions.length}`,
                 questionText: questionText,
                 // maxPoints: 5 // Points field removed as per requirement
             });
        }
    });

    if (!customQuestionsValid) {
         displayError("Please enter text for all custom questions or remove empty ones.");
         setLoading(saveBatchBtn, false, saveButtonDefaultText);
         return false;
    }

    // --- Construct Batch Data Object ---
    const batchData = {
        batchName: batchName,
        style: document.getElementById('batch-style').value.trim() || null,
        abv: parseFloat(document.getElementById('batch-abv').value) || null,
        ibu: parseInt(document.getElementById('batch-ibu').value, 10) || null,
        description: document.getElementById('batch-description').value.trim() || null,
        brewersNotes: document.getElementById('batch-brewers-notes').value.trim() || null,
        incentiveText: document.getElementById('batch-incentive-text').value.trim() || null,
        batchIntroductionText: document.getElementById('batch-introduction-text').value.trim() || null,
        // NEW Fields
        batchLabelIconUrl: document.getElementById('batch-label-icon-url').value.trim() || null,
        customQuestions: customQuestions, // Save collected custom questions
        // --- Field REMOVED: surveyConfig ---
        breweryId: currentBreweryId, // Crucial link
        lastUpdated: serverTimestamp(),
    };
    // Ensure numeric fields are null if not valid numbers
    if (isNaN(batchData.abv)) batchData.abv = null;
    if (isNaN(batchData.ibu)) batchData.ibu = null;

    // --- Firestore Operation (Create or Update) ---
    try {
        if (isEditing) {
            console.log(`Updating batch ${editingBatchId}`);
            const batchRef = doc(db, "batches", editingBatchId);
            // Preserve creation date and active status
            const existingSnap = await getDoc(batchRef);
            if(!existingSnap.exists()){ throw new Error("Batch to update not found."); }
            const existingData = existingSnap.data();
            batchData.isActive = existingData?.isActive ?? true; // Preserve status
            batchData.createdAt = existingData?.createdAt ?? serverTimestamp(); // Preserve create time

            await updateDoc(batchRef, batchData);
            console.log("Batch updated successfully:", editingBatchId);
        } else {
            console.log("Creating new batch");
            batchData.createdAt = serverTimestamp();
            batchData.isActive = true; // Default new batches to active
            const docRef = await addDoc(collection(db, "batches"), batchData);
            console.log("Batch created successfully with ID:", docRef.id);
        }
        resetBatchForm(); // Clear form after successful save
        loadBatches(); // Refresh the batch list
        return true; // Indicate success
    } catch (error) {
        console.error("Error saving batch:", error);
        displayError(`Failed to save batch: ${error.message}`);
        return false; // Indicate failure
    } finally {
        setLoading(saveBatchBtn, false, saveButtonDefaultText); // Re-enable button
    }
}

// --- END OF SECTION 7 ---

// --- START OF SECTION 8: Batch Listing and Actions ---
// Goal: Load, display, and manage batch list items and their feedback display.

/**
 * Load and display batches for the current brewery.
 */
async function loadBatches() {
    if (!currentBreweryId) {
         console.warn("loadBatches called without breweryId.");
         if(batchesListDiv) batchesListDiv.innerHTML = '<p>Cannot load batches: Brewery not identified.</p>';
         return;
    }
    console.log("Loading batches for brewery:", currentBreweryId);
    if(batchesListDiv) batchesListDiv.innerHTML = '<p class="loading-indicator">Loading your glorious brews...</p>';

    try {
        const q = query(
            collection(db, "batches"),
            where("breweryId", "==", currentBreweryId),
            orderBy("createdAt", "desc") // Order by creation time
        );
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            if(batchesListDiv) batchesListDiv.innerHTML = '<p>No batches found. Create your first batch above!</p>';
        } else {
            displayBatches(querySnapshot.docs);
        }
    } catch (error) {
        console.error("Error loading batches:", error);
        displayError(`Failed to load batches: ${error.message}`);
        if(batchesListDiv) batchesListDiv.innerHTML = '<p class="error-message">Could not load batches.</p>';
    }
}

/**
 * Renders the batch cards into the list container.
 * @param {Array} batchDocs - Array of Firestore document snapshots.
 */
function displayBatches(batchDocs) {
    if (!batchesListDiv) return;
    batchesListDiv.innerHTML = ''; // Clear previous list/loading
    const fragment = document.createDocumentFragment();
    batchDocs.forEach(docSnap => {
        const batchCard = createBatchCard(docSnap.id, docSnap.data()); // Pass ID and data
        if (batchCard) fragment.appendChild(batchCard);
    });
    batchesListDiv.appendChild(fragment);
    // Event listeners are now attached once in setupDashboardEventListeners using delegation
}

/**
 * Create HTML for a single batch card.
 * UPDATED: Shows standardized survey info + custom question count.
 * @param {string} id - Batch document ID.
 * @param {object} batch - Batch data object.
 * @returns {HTMLElement | null} The created article element or null if data missing.
 */
function createBatchCard(id, batch) {
    if (!batch || !id) return null; // Basic validation
    const div = document.createElement('article');
    div.className = `batch-item ${batch.isActive ? 'batch-active' : 'batch-inactive'}`;
    div.dataset.batchId = id; // Set dataset attribute for easy selection

    const createdAtTimestamp = batch.createdAt || batch.creationDate; // Handle potential old field name
    const createdAt = createdAtTimestamp instanceof Timestamp ? createdAtTimestamp.toDate().toLocaleDateString() : 'N/A';
    const statusText = batch.isActive ? 'Active' : 'Inactive';
    const statusClass = batch.isActive ? 'status-active' : 'status-inactive';

    // Display survey info based on custom questions count
    const customQuestionCount = batch.customQuestions?.length || 0;
    const surveyInfo = `Standard Survey ${customQuestionCount > 0 ? `(+ ${customQuestionCount} custom)` : ''}`;

    const feedbackDetailsId = `feedback-details-${id}`; // Unique ID for feedback area

    // Use template literal for cleaner HTML structure
    div.innerHTML = `
        <div class="batch-item-header">
            <h3>
                 <!-- Placeholder for Icon - Could display batch.batchLabelIconUrl here if desired -->
                 <span class="batch-icon"></span>
                 ${batch.batchName || 'Unnamed Batch'}
            </h3>
            <span class="batch-status ${statusClass}">${statusText}</span>
        </div>
        <div class="batch-info">
            <p class="batch-meta">
                ${batch.style ? `Style: ${batch.style}` : ''}
                ${batch.abv ? ` | ABV: ${batch.abv}%` : ''}
                ${batch.ibu ? ` | IBU: ${batch.ibu}` : ''}
            </p>
            <p class="batch-meta"><small>Created: ${createdAt}</small></p>
            ${batch.description ? `<p><strong>Internal Notes:</strong> ${batch.description}</p>` : ''}
            <p class="batch-survey-info"><strong>Survey Type:</strong> ${surveyInfo}</p>
            <!-- Optional: Re-add public link if needed -->
        </div>
        <div class="button-group">
            <button class="btn btn-secondary btn-small activate-deactivate-btn" data-action="${batch.isActive ? 'deactivate' : 'activate'}" title="${batch.isActive ? 'Stop collecting feedback' : 'Start collecting feedback'}">
                <span class="btn-content">${batch.isActive ? 'Deactivate' : 'Activate'}</span>
            </button>
            <button class="btn btn-secondary btn-small edit-batch-btn" title="Edit Batch Details & Custom Questions">
                <span class="btn-content">Edit Batch</span>
            </button>
            <button class="btn btn-secondary btn-small view-feedback-btn" title="View Submitted Feedback">
                 <span class="btn-content">View Feedback</span>
            </button>
            <button class="btn btn-danger btn-small delete-batch-btn" data-batch-name="${batch.batchName || 'Unnamed'}" title="Delete Batch">
                 <span class="btn-content">Delete</span>
            </button>
        </div>
        <div class="feedback-details" id="${feedbackDetailsId}" style="display: none;">
            <p class="loading-indicator"><i>Loading feedback...</i></p>
        </div>
    `;
    return div;
}

/**
 * Toggle batch active status in Firestore and update UI directly.
 * @param {string} batchId - The ID of the batch to toggle.
 * @param {boolean} activate - True to activate, false to deactivate.
 */
async function toggleBatchStatus(batchId, activate) {
    console.log(`${activate ? 'Activating' : 'Deactivating'} batch: ${batchId}`);
    const batchRef = doc(db, "batches", batchId);
    const batchCard = batchesListDiv.querySelector(`.batch-item[data-batch-id="${batchId}"]`);
    const toggleButton = batchCard?.querySelector('.activate-deactivate-btn'); // Find button within card

    if (toggleButton) toggleButton.disabled = true; // Disable immediately

    try {
        await updateDoc(batchRef, { isActive: activate, lastUpdated: serverTimestamp() });
        console.log("Batch status updated in Firestore.");

        // Update UI directly for instant feedback
         if (batchCard) {
             const statusSpan = batchCard.querySelector('.batch-status');
             const buttonSpan = toggleButton?.querySelector('.btn-content');

             batchCard.classList.toggle('batch-active', activate);
             batchCard.classList.toggle('batch-inactive', !activate);
             if (statusSpan) {
                 statusSpan.textContent = activate ? 'Active' : 'Inactive';
                 statusSpan.className = `batch-status ${activate ? 'status-active' : 'status-inactive'}`;
             }
             if (toggleButton) {
                 toggleButton.dataset.action = activate ? 'deactivate' : 'activate';
                 if (buttonSpan) buttonSpan.textContent = activate ? 'Deactivate' : 'Activate';
                 toggleButton.title = activate ? 'Stop collecting feedback' : 'Start collecting feedback';
             }
         }

    } catch (error) {
        console.error("Error updating batch status:", error);
        displayError(`Failed to update batch status: ${error.message}`);
        // Optionally revert UI changes on error
    } finally {
         if (toggleButton) toggleButton.disabled = false; // Re-enable button
    }
}

/**
 * Toggle feedback display area and fetch data if needed.
 */
async function toggleFeedbackDisplay(batchId, button) {
     const feedbackDetailsDiv = document.getElementById(`feedback-details-${batchId}`);
     if (!feedbackDetailsDiv) return;

     const isVisible = feedbackDetailsDiv.style.display === 'block';
     const buttonSpan = button.querySelector('.btn-content');

     if (isVisible) {
         hideElement(feedbackDetailsDiv);
         if (buttonSpan) buttonSpan.textContent = 'View Feedback';
     } else {
         showElement(feedbackDetailsDiv);
         if (buttonSpan) buttonSpan.textContent = 'Hide Feedback';
         // Fetch only if not currently loading and not already loaded
         if (feedbackDetailsDiv.dataset.loading !== 'true' && feedbackDetailsDiv.dataset.loaded !== 'true') {
             feedbackDetailsDiv.dataset.loading = 'true';
             feedbackDetailsDiv.dataset.loaded = 'false';
             button.disabled = true;
             if(buttonSpan) buttonSpan.textContent = 'Loading...';

             await displayFeedbackForBatch(batchId, feedbackDetailsDiv); // Fetch and display

             feedbackDetailsDiv.dataset.loading = 'false';
             feedbackDetailsDiv.dataset.loaded = 'true'; // Mark loaded after attempt
             button.disabled = false;
             if(buttonSpan) buttonSpan.textContent = 'Hide Feedback'; // Ensure text is Hide
         }
     }
}


/**
 * Fetch and display aggregated feedback summary for a batch.
 * UPDATED: Displays calculated score & handles standard/custom answers.
 */
async function displayFeedbackForBatch(batchId, targetDiv) {
    targetDiv.innerHTML = '<p class="loading-indicator"><i>Loading feedback...</i></p>';
    try {
        const feedbackQuery = query(
            collection(db, "feedback"),
            where("batchId", "==", batchId),
            orderBy("timestamp", "desc")
        );
        const feedbackSnapshot = await getDocs(feedbackQuery);

        if (feedbackSnapshot.empty) {
            targetDiv.innerHTML = '<p><i>No feedback submitted for this batch yet.</i></p>';
            return;
        }

        let feedbackHTML = '';
        let totalScoreSum = 0;
        let scoreCount = 0; // Count submissions WITH a score
        const comments = [];
        // Add structures for potential detailed breakdowns later if needed
        // const standardRatingsAgg = {}; // { clarity: { sum: X, count: Y }, ... }
        // const customRatingsAgg = {}; // { customQId1: { sum: X, count: Y }, ... }

        feedbackSnapshot.forEach(docSnap => {
            const feedback = docSnap.data();
            const score = feedback.calculatedScore; // Get pre-calculated score

            if (typeof score === 'number' && !isNaN(score)) {
                totalScoreSum += score;
                scoreCount++;
            }

            if (feedback.comment) {
                 const ts = feedback.timestamp instanceof Timestamp ? feedback.timestamp.toDate().toLocaleDateString() : 'N/A';
                 comments.push(`<li>"${feedback.comment}" <span class="feedback-meta">(${ts})</span></li>`);
            }

            // --- Example: Aggregating Individual Ratings (More complex view) ---
            // if (feedback.ratings && Array.isArray(feedback.ratings)) {
            //     feedback.ratings.forEach(r => {
            //         if (r.isCustom && r.ratingValue != null) { // Custom question score
            //             const qId = r.questionId;
            //             if (!customRatingsAgg[qId]) customRatingsAgg[qId] = { sum: 0, count: 0, text: r.descriptor };
            //             customRatingsAgg[qId].sum += r.ratingValue;
            //             customRatingsAgg[qId].count++;
            //         } else if (!r.isCustom && r.metricValue) { // Standard question score (needs mapping)
            //              const metricKey = r.metricValue;
            //              // Requires mapping text answer back to score here if needed for avg metric score
            //              // This might be redundant if cloud function already calculates category scores
            //         }
            //     });
            // }
        });

        // --- Display Summary ---
        const averageScore = scoreCount > 0 ? (totalScoreSum / scoreCount).toFixed(1) : 'N/A';
        feedbackHTML += `<h4>Feedback Summary:</h4>`;
        feedbackHTML += `<p class="feedback-summary"><strong>Average Score:</strong> <span class="score">${averageScore} / 50</span> <span class="score-label">(${scoreCount} rated submission${scoreCount !== 1 ? 's' : ''} of ${feedbackSnapshot.size} total)</span></p>`;

        // Display Comments
        feedbackHTML += '<h5>Comments:</h5>';
        if (comments.length > 0) {
             feedbackHTML += `<ul>${comments.join('')}</ul>`;
        } else {
             feedbackHTML += '<p><i>No comments submitted.</i></p>';
        }

        // --- Placeholder for Detailed Breakdown Display ---
        // feedbackHTML += '<h5>Average Metric Ratings (Example):</h5>';
        // // ... Iterate through standardRatingsAgg and customRatingsAgg to display averages ...


        targetDiv.innerHTML = feedbackHTML;

    } catch (error) {
        console.error(`Error fetching feedback for batch ${batchId}:`, error);
        targetDiv.innerHTML = `<p class="error-message">Could not load feedback: ${error.message}</p>`;
    }
}


// --- END OF SECTION 8 ---

// --- START OF SECTION 9: Event Listener Setup ---
// Goal: Attach event listeners for dashboard interactions.

/** Consolidated Setup for Dashboard & Batch Item Listeners */
function setupDashboardEventListeners(user) {
    console.log("Setting up dashboard event listeners.");
    // Ensure user object is valid
    if (!user) {
        console.error("Cannot setup listeners: User object is missing.");
        return;
    }

    // Get static elements once
    const batchForm = document.getElementById('batch-form');
    const logoutButton = document.getElementById('logout-btn');
    const listEl = document.getElementById('batches-list'); // Target for batch actions
    const cancelEditButton = document.getElementById('cancel-edit-btn');
    const addCustomQButton = document.getElementById('add-custom-q-btn'); // Renamed from Section 6 reference
    const customQContainer = document.getElementById('custom-questions-container'); // Renamed from Section 6 reference


    // --- Batch Form Submit Listener ---
    // Use flag to prevent attaching multiple times if initDashboard is called again
    if (batchForm && !batchForm.dataset.submitListenerAttached) {
        batchForm.dataset.submitListenerAttached = 'true';
        console.log("Attaching form submit listener.");
        batchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentUserId) { // Check global userId instead of passed user
                 displayError("Authentication error. Please refresh.");
                 return;
             }
            // saveBatch now returns true/false for success/failure
            await saveBatch(); // Call the refactored saveBatch function
        });
    }

    // --- "Add Custom Question" Button Listener ---
    if (addCustomQButton && !addCustomQButton.dataset.clickListenerAttached) {
        addCustomQButton.dataset.clickListenerAttached = 'true';
        addCustomQButton.addEventListener('click', handleAddCustomQuestionClick); // Use handler defined in Sec 6
        console.log("Add custom question listener attached.");
    }

    // --- Custom Question Container Listener (Remove Button - Delegation) ---
     if (customQContainer && !customQContainer.dataset.removeListenerAttached) {
         customQContainer.dataset.removeListenerAttached = 'true';
         customQContainer.addEventListener('click', (e) => {
             if (e.target && e.target.classList.contains('remove-custom-q-btn')) {
                 const itemToRemove = e.target.closest('.custom-question-item');
                 if (itemToRemove) {
                     itemToRemove.remove();
                     renumberCustomQuestions(); // Renumber remaining questions
                 }
             }
         });
         console.log("Custom question remove listener attached.");
     }


    // --- Batch Action Listener (Delegated on List) ---
     if (listEl && !listEl.dataset.batchActionListenerAttached) {
         listEl.dataset.batchActionListenerAttached = 'true';
         console.log("Attaching batch action listener.");
         listEl.addEventListener('click', async (e) => {
             const button = e.target.closest('button');
             if (!button) return; // Ignore clicks not on buttons

             const batchItem = button.closest('.batch-item');
             const batchId = batchItem?.dataset.batchId; // Use optional chaining
             if (!batchId) return; // Ignore if no batch ID found

             // --- Activate/Deactivate ---
             if (button.classList.contains('activate-deactivate-btn') && !button.disabled) {
                  const action = button.dataset.action;
                  // Disable handled within toggleBatchStatus now
                  await toggleBatchStatus(batchId, action === 'activate');
             }
             // --- Edit Batch ---
             else if (button.classList.contains('edit-batch-btn')) {
                  await loadBatchDataIntoForm(batchId);
             }
              // --- View/Hide Feedback ---
             else if (button.classList.contains('view-feedback-btn') && !button.disabled) {
                  await toggleFeedbackDisplay(batchId, button);
             }
              // --- Delete Batch ---
             else if (button.classList.contains('delete-batch-btn') && !button.disabled) {
                  const batchName = button.dataset.batchName || 'this batch';
                  if (confirm(`DELETE BATCH\n\n"${batchName}"\n\nConfirm permanent deletion? This action cannot be undone.`)) {
                       button.disabled = true;
                       try {
                           console.log(`Deleting batch: ${batchId}`);
                           await deleteDoc(doc(db, "batches", batchId));
                           alert(`Batch "${batchName}" deleted.`);
                           batchItem.remove(); // Remove card from UI immediately
                       } catch (err) {
                           console.error(`Delete error for batch ${batchId}:`, err);
                           alert(`Delete error: ${err.message}`);
                           button.disabled = false; // Re-enable on failure
                       }
                  }
             }
             // --- Copy URL (If re-enabled) ---
             // else if (button.classList.contains('copy-public-url-btn')) { /* ... */ }
         });
     } else if (listEl) {
          console.log("Batch action listener already attached.");
     } else {
          console.error("Batches list element not found for listener setup.");
     }


    // --- "Cancel Edit" Button Listener ---
     if (cancelEditButton && !cancelEditButton.dataset.clickListenerAttached) {
         cancelEditButton.dataset.clickListenerAttached = 'true';
         cancelEditButton.addEventListener('click', resetBatchForm);
         console.log("Cancel edit listener attached.");
     }

    // --- Logout Button Listener ---
    if (logoutButton && !logoutButton.dataset.clickListenerAttached) {
         logoutButton.dataset.clickListenerAttached = 'true';
         logoutButton.addEventListener('click', async () => {
             try {
                 await signOut(auth);
                 console.log("Logout successful");
                 // Auth listener will handle redirect/UI changes
             } catch (err) {
                 console.error("Logout error:", err);
                 displayError(`Logout failed: ${err.message}`);
             }
         });
         console.log("Logout listener attached.");
     }
}

// --- END OF SECTION 9 ---

// --- START OF SECTION 10: Initialization ---
// Goal: Initialize the dashboard UI and listeners once auth/brewery context is ready.

/** Initialize dashboard page after user and brewery context are established */
function initDashboard() {
    // This function relies on global currentUserId and currentBreweryId being set
    if (!currentUserId || !currentBreweryId) {
        console.error("initDashboard called without user/brewery context.");
        displayError("Failed to initialize dashboard properly.");
        return;
    }
    console.log(`Initializing dashboard UI for user ${currentUserId}, brewery ${currentBreweryId}`);

    // Ensure the main content div exists and hasn't already been initialized
    if (dashboardContentDiv && dashboardContentDiv.dataset.initialized !== 'true') {
        dashboardContentDiv.dataset.initialized = 'true'; // Mark as initialized
        showElement(dashboardContentDiv);

        updateBreweryPublicUrl(); // Setup the URL/QR section (uses global currentBreweryId)
        setupDashboardEventListeners(auth.currentUser); // Setup FORM and LIST listeners
        resetBatchForm(); // Start with a clean batch creation form
        loadBatches(); // Load initial batch list (which will trigger displayBatches)

        console.log("Dashboard initialized.");
    } else if (dashboardContentDiv?.dataset.initialized === 'true') {
         console.log("Dashboard already initialized, skipping init function.");
    } else {
         console.error("Dashboard content element missing during init.");
    }
}

// --- The main onAuthStateChanged listener from Section 4 remains the same ---
// It handles the overall auth flow and calls fetchUserBreweryId,
// which in turn calls initDashboard once the breweryId is confirmed.

// --- END OF SECTION 10 ---
// --- END OF FILE app.js ---