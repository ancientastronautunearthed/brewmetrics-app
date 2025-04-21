// public/assets/js/app.js
// UPDATED: Includes email verification checks

import { auth, db } from './firebase-config.js';
// Assuming flavorCategories is still needed for feedback aggregation display
// import { flavorCategories } from './flavor-data.js'; // Uncomment if full aggregation logic is pasted back in
import { onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js"; // Added signOut and sendEmailVerification
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp, orderBy, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// --- Core Logic Functions (Dashboard Related) ---
// (Keep createBatch, toggleBatchActiveState, listBatches, setupBatchActionListeners,
//  getFeedbackCount, setupDashboardEventListeners, initDashboard,
//  updateBreweryPublicUrl, copyUsingExecCommand, setupQrCodeGeneration
//  functions exactly as they were in the previous correct version of app.js)
// --- PASTE ALL THOSE FUNCTIONS HERE ---

// Create a new batch (Handles enhanced fields)
async function createBatch(user, batchDetails) {
    if (!user) {
        console.error("createBatch called without user object.");
        alert("Error: Not authenticated. Please log in again.");
        return;
    }
    const batchName = (batchDetails.batchName || '').trim();
    if (batchName === '') {
        alert("Error: Batch name cannot be empty.");
        return;
    }

    console.log(`Creating batch "${batchName}" for user ${user.uid}`);
    console.log("Batch details received:", batchDetails);

    try {
        const batchData = {
            breweryId: user.uid, batchName: batchName, creationDate: serverTimestamp(), isActive: true,
            ...(batchDetails.style?.trim() && { style: batchDetails.style.trim() }),
            ...(batchDetails.abv && !isNaN(parseFloat(batchDetails.abv)) && { abv: parseFloat(batchDetails.abv) }),
            ...(batchDetails.ibu && !isNaN(parseInt(batchDetails.ibu, 10)) && { ibu: parseInt(batchDetails.ibu, 10) }),
            ...(batchDetails.description?.trim() && { description: batchDetails.description.trim() }),
            ...(batchDetails.brewersNotes?.trim() && { brewersNotes: batchDetails.brewersNotes.trim() }),
            ...(batchDetails.incentiveText?.trim() && { incentiveText: batchDetails.incentiveText.trim() }),
        };

        console.log("Data being written to Firestore:", batchData);
        const docRef = await addDoc(collection(db, "batches"), batchData);
        console.log("Batch created with ID: ", docRef.id);
        alert(`Batch "${batchData.batchName}" created successfully!`);
        await listBatches(user); // Refresh list
        return docRef.id;

    } catch (error) {
        console.error("Error creating batch:", error);
        alert(`Error creating batch: ${error.message}`);
    }
}

// Toggle isActive state for a batch
async function toggleBatchActiveState(batchId, currentState) {
    console.log(`Toggling active state for batch ${batchId} from ${currentState}`);
    const batchRef = doc(db, "batches", batchId);
    const newState = !currentState;
    try {
        await updateDoc(batchRef, { isActive: newState });
        console.log(`Batch ${batchId} active state updated to ${newState}`);
        return true;
    } catch (error) {
        console.error(`Error updating batch ${batchId} active state:`, error);
        alert(`Failed to update batch status: ${error.message}`);
        return false;
    }
}


// List batches for current brewery
async function listBatches(user) {
    if (!user) { console.error("listBatches called without user object."); return []; }
    console.log(`Listing batches for user ${user.uid}`);
    const batchesListElement = document.getElementById('batches-list');
    if (!batchesListElement) { console.error('Batches list container element not found!'); return []; }
    batchesListElement.innerHTML = '<p class="loading-indicator"><i>Loading your glorious brews...</i></p>'; // Use class

    try {
        const batchesRef = collection(db, "batches");
        const qBatches = query(batchesRef, where("breweryId", "==", user.uid), orderBy("creationDate", "desc"));
        const batchesSnapshot = await getDocs(qBatches);
        batchesListElement.innerHTML = ''; // Clear loading

        if (batchesSnapshot.empty) { batchesListElement.innerHTML = '<p>No batches found. Create your first batch above.</p>'; return []; }

        const fragment = document.createDocumentFragment(); // Use fragment

        batchesSnapshot.forEach(batchDoc => {
            const batchData = batchDoc.data();
            const batchId = batchDoc.id;
            const isActive = batchData.isActive === true;
            const feedbackUrl = `${window.location.origin}/feedback/index.html?batchId=${batchId}`;
            const publicSelectUrl = `${window.location.origin}/select-batch/index.html?breweryId=${user.uid}`;

            const batchItemContainer = document.createElement('article'); // Use article
            batchItemContainer.className = `batch-item ${isActive ? 'batch-active' : 'batch-inactive'}`;
            batchItemContainer.dataset.batchId = batchId;

            const creationDateString = batchData.creationDate?.toDate ? batchData.creationDate.toDate().toLocaleDateString() : 'N/A';
            const detailsHtml = [
                batchData.style ? `<span>Style: ${batchData.style}</span>` : '',
                batchData.abv ? `<span>ABV: ${batchData.abv}%</span>` : '',
                batchData.ibu ? `<span>IBU: ${batchData.ibu}</span>` : '',
            ].filter(Boolean).join(' · ');

            batchItemContainer.innerHTML = `
                <div class="batch-item-header">
                    <h3>
                        <span class="icon batch-icon"></span>
                        ${batchData.batchName || 'Unnamed Batch'}
                    </h3>
                    <span class="batch-status">${isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div class="batch-info">
                    <p class="batch-meta"><small>Created: ${creationDateString}${detailsHtml ? ' · ' + detailsHtml : ''}</small></p>
                    ${batchData.description ? `<p class="batch-description">${batchData.description}</p>` : ''}
                    <p class="batch-url">
                         <label for="url-${batchId}">Public Link:</label>
                         <div class="input-group">
                            <input type="text" id="url-${batchId}" value="${publicSelectUrl}" readonly>
                            <button class="btn btn-secondary copy-public-url-btn" data-url="${publicSelectUrl}" type="button">
                                 <span class="btn-content">Copy</span>
                            </button>
                         </div>
                    </p>
                </div>
                <div class="button-group">
                    <button class="btn toggle-active-btn" data-batch-id="${batchId}" data-current-state="${isActive}" type="button">
                        <span class="btn-content">${isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>
                    <button class="btn view-feedback-btn" data-batch-id="${batchId}" type="button">
                         <span class="btn-content">View Feedback</span>
                    </button>
                </div>
                <div class="feedback-details" id="feedback-${batchId}" style="display: none;">
                    <p class="loading-indicator"><i>Loading feedback...</i></p>
                </div>
            `;
            fragment.appendChild(batchItemContainer);
        });

        batchesListElement.appendChild(fragment); // Append all at once

        console.log("Batches listed. Setting up ALL action listeners.");
        setupBatchActionListeners(user); // Call consolidated listener setup

    } catch (error) {
        console.error("Error listing batches:", error);
        batchesListElement.innerHTML = `<p class="error-message">Error loading batches: ${error.message}</p>`; // Use class
    }
}

// Consolidated Setup for Batch Item Listeners (Event Delegation)
function setupBatchActionListeners(user) {
    console.log("🚀 Setting up ALL batch action listeners using event delegation...");
    const batchesListElement = document.getElementById('batches-list');
    if (!batchesListElement) {
        console.error("❌ Batches list element not found. Cannot attach listeners.");
        return;
    }

    // Define the single handler function
    const handleBatchActionClick = async (e) => {
        const target = e.target; // The element that was actually clicked

        // --- Toggle Active State ---
        const toggleButton = target.closest('.toggle-active-btn');
        if (toggleButton && !toggleButton.disabled) {
            const batchId = toggleButton.dataset.batchId;
            const currentState = toggleButton.dataset.currentState === 'true';
            const buttonContentSpan = toggleButton.querySelector('.btn-content');
            if (!buttonContentSpan) return; // Safety check

            console.log(`[Listener] Toggle Active clicked for batch ${batchId}`);
            toggleButton.disabled = true;
            const originalText = buttonContentSpan.textContent;
            buttonContentSpan.textContent = 'Updating...';

            try {
                await toggleBatchActiveState(batchId, currentState);
                await listBatches(user); // Refresh the list
            } catch (error) {
                console.error(`[Listener] Error toggling state for ${batchId}:`, error);
                alert(`Failed to update status: ${error.message}`);
                toggleButton.disabled = false;
                buttonContentSpan.textContent = originalText;
            }
            return;
        }

        // --- View/Hide Feedback ---
        const feedbackButton = target.closest('.view-feedback-btn');
        if (feedbackButton && !feedbackButton.disabled) {
            const batchId = feedbackButton.dataset.batchId;
            const batchItemElement = feedbackButton.closest('.batch-item');
            const feedbackContainer = batchItemElement?.querySelector('.feedback-details');
            const buttonContentSpan = feedbackButton.querySelector('.btn-content');
            if (!feedbackContainer || !batchId || !buttonContentSpan) return;

            console.log(`[Listener] View/Hide Feedback clicked for batch: ${batchId}`);
            const isCurrentlyHidden = feedbackContainer.style.display === 'none';
            const isLoading = feedbackContainer.dataset.loading === 'true';
            const isLoaded = feedbackContainer.dataset.loaded === 'true';

            if (isLoading) return;

            if (isCurrentlyHidden) {
                feedbackContainer.style.display = 'block';
                buttonContentSpan.textContent = 'Hide Feedback';
                if (!isLoaded) {
                    feedbackContainer.innerHTML = '<p class="loading-indicator"><i>Loading feedback analysis...</i></p>';
                    feedbackContainer.dataset.loading = 'true';
                    feedbackButton.disabled = true;
                    try {
                        const feedbackRef = collection(db, "feedback");
                        const qFeedback = query(feedbackRef, where("batchId", "==", batchId), orderBy("timestamp", "desc"));
                        const feedbackSnapshot = await getDocs(qFeedback);
                        feedbackContainer.innerHTML = '';

                        if (feedbackSnapshot.empty) {
                            feedbackContainer.innerHTML = '<p><i>No feedback submitted yet.</i></p>';
                        } else {
                             // --- PASTE YOUR FULL AGGREGATION/RENDERING LOGIC HERE ---
                             // Example simplified rendering:
                            let feedbackCount = feedbackSnapshot.size; let totalOverallRating = 0; const comments = [];
                            feedbackSnapshot.forEach(doc => { const data = doc.data(); if (typeof data.overallRating === 'number') totalOverallRating += data.overallRating; if (data.comment?.trim()) comments.push({ text: data.comment, timestamp: data.timestamp?.toDate() }); });
                            const avgOverall = feedbackCount > 0 ? (totalOverallRating / feedbackCount).toFixed(1) : 'N/A';
                            let summaryHtml = `<h4>Summary (${feedbackCount})</h4><p>Avg Rating: ${avgOverall}/5</p>`;
                            summaryHtml += `<h5>Comments:</h5>`; if (comments.length > 0) { summaryHtml += `<ul>`; comments.forEach(c => summaryHtml += `<li>${c.text}</li>`); summaryHtml += `</ul>`;} else { summaryHtml += `<p><i>No comments.</i></p>`;}
                            feedbackContainer.innerHTML = summaryHtml;
                             // --- End aggregation/rendering ---
                        }
                        feedbackContainer.dataset.loaded = 'true';
                    } catch (feedbackError) {
                        console.error(`[Listener] Error fetching feedback for ${batchId}:`, feedbackError);
                        const errorMsg = feedbackError.code === "permission-denied" ? "Permission denied. (Check Rules)" : `Error loading feedback. (${feedbackError.message || 'Unknown'})`;
                        feedbackContainer.innerHTML = `<p class="error-message"><i>${errorMsg}</i></p>`;
                        feedbackContainer.dataset.loaded = 'false';
                    } finally {
                        feedbackContainer.dataset.loading = 'false';
                        feedbackButton.disabled = false;
                    }
                }
            } else {
                feedbackContainer.style.display = 'none';
                buttonContentSpan.textContent = 'View Feedback';
            }
            return;
        }

        // --- Copy Public URL ---
        const copyUrlButton = target.closest('.copy-public-url-btn');
        if (copyUrlButton && !copyUrlButton.disabled) {
            const urlToCopy = copyUrlButton.dataset.url;
            const buttonContentSpan = copyUrlButton.querySelector('.btn-content');
            if (!urlToCopy || !buttonContentSpan) return;

            console.log(`[Listener] Copy URL clicked. URL: ${urlToCopy}`);
            copyUrlButton.disabled = true;
            const originalText = buttonContentSpan.textContent;
            buttonContentSpan.textContent = 'Copied!';

            try {
                await navigator.clipboard.writeText(urlToCopy);
                console.log('[Listener] URL copied successfully.');
            } catch (err) {
                console.error('❌ [Listener] Failed to copy URL:', err);
                 buttonContentSpan.textContent = 'Error';
                 alert('Failed to copy URL automatically.');
            } finally {
                setTimeout(() => {
                    buttonContentSpan.textContent = originalText;
                    copyUrlButton.disabled = false;
                }, 1500);
            }
            return;
        }
    };

    // Attach the single listener (consider removing previous if listBatches is called multiple times)
    batchesListElement.addEventListener('click', handleBatchActionClick);

    console.log("✅ Consolidated batch action listener attached.");
}

// Get feedback count (kept simple)
async function getFeedbackCount(batchId) {
   try { const feedbackRef = collection(db, "feedback"); const q = query(feedbackRef, where("batchId", "==", batchId)); const querySnapshot = await getDocs(q); return querySnapshot.size; } catch (error) { console.error("Error getting feedback count for batch " + batchId + ":", error); return 0; }
}

// Setup dashboard event listeners (form, logout)
function setupDashboardEventListeners(user) {
    console.log("Setting up dashboard event listeners (Form, Logout).");
    const batchForm = document.getElementById('batch-form');
    const createBatchButton = document.getElementById('create-batch-btn');
    const logoutButton = document.getElementById('logout-btn');

    // --- Batch Form Listener ---
    if (batchForm && createBatchButton) {
        if (batchForm.dataset.listenerAttached !== 'true') {
            batchForm.dataset.listenerAttached = 'true';
            console.log("Attaching batch form submit listener.");
            const createBtnSpan = createBatchButton.querySelector('.btn-content');
            if (!createBtnSpan) { console.error("Create batch button missing .btn-content span!"); }

            const handleBatchSubmit = async (e) => {
                e.preventDefault();
                const batchDetails = { batchName: document.getElementById('batch-name')?.value, style: document.getElementById('batch-style')?.value, abv: document.getElementById('batch-abv')?.value, ibu: document.getElementById('batch-ibu')?.value, description: document.getElementById('batch-description')?.value, brewersNotes: document.getElementById('batch-brewers-notes')?.value, incentiveText: document.getElementById('batch-incentive-text')?.value };
                createBatchButton.disabled = true;
                const contentSpan = createBatchButton.querySelector('.btn-content');
                const originalText = contentSpan ? contentSpan.textContent : 'Create Batch';
                const iconHTML = contentSpan?.querySelector('.icon')?.outerHTML || '';
                if (contentSpan) contentSpan.innerHTML = `${iconHTML} Creating...`;

                try { await createBatch(user, batchDetails); batchForm.reset(); }
                catch (error) { console.error("Error occurred during batch creation process:", error); }
                finally { createBatchButton.disabled = false; if (contentSpan) contentSpan.innerHTML = `${iconHTML}${originalText}`; }
            };
            batchForm.addEventListener('submit', handleBatchSubmit);
            console.log("Batch form listener attached.");
        }
    } else { console.error("Could not find batch form or create button."); }

    // --- Logout Button Listener ---
    if (logoutButton) {
         if (logoutButton.dataset.listenerAttached !== 'true') {
             logoutButton.dataset.listenerAttached = 'true';
             console.log("Attaching logout button listener.");
             const logoutBtnSpan = logoutButton.querySelector('.btn-content');
             if (!logoutBtnSpan) { console.error("Logout button missing .btn-content span!"); }

             logoutButton.addEventListener('click', async () => {
                 const contentSpan = logoutButton.querySelector('.btn-content');
                 const originalText = contentSpan ? contentSpan.textContent : 'Log Out';
                 logoutButton.disabled = true;
                 if (contentSpan) contentSpan.textContent = 'Logging out...';
                 try { await signOut(auth); console.log("User signed out successfully via Firebase."); }
                 catch (error) { console.error("Error signing out:", error); alert(`Error signing out: ${error.message}`); logoutButton.disabled = false; if (contentSpan) contentSpan.textContent = originalText; }
             });
             console.log("Logout listener attached.");
         }
    } else { console.error("Logout button not found."); }
}

// Initialize dashboard page
function initDashboard(user) {
    console.log("Initializing dashboard components for user:", user.uid); if (!user) { return; }
    const dashboardContentEl = document.getElementById('dashboard-content');
    const batchesListElement = document.getElementById('batches-list');
    const breweryPublicUrlContainer = document.getElementById('brewery-public-url');
    if (!dashboardContentEl || !batchesListElement || !breweryPublicUrlContainer) { console.error("Cannot initialize dashboard - critical elements missing."); return; }

    dashboardContentEl.style.display = 'block'; // Show main content
    updateBreweryPublicUrl(user.uid);
    setupDashboardEventListeners(user);
    listBatches(user);
}

// --- Public URL & QR Code Functions ---
function updateBreweryPublicUrl(userId) {
    const breweryPublicUrlContainer = document.getElementById('brewery-public-url'); if (!breweryPublicUrlContainer) return;
    const baseUrl = window.location.origin;
    const selectBatchUrl = `${baseUrl}/select-batch/index.html?breweryId=${userId}`;
    breweryPublicUrlContainer.innerHTML = `<h3>Your Public Link & QR Code</h3><p>Share this link or QR code...</p><div class="url-container form-group"><label for="public-url-input">Public Link:</label><div class="input-group"><input type="text" id="public-url-input" value="${selectBatchUrl}" readonly><button id="copy-url-btn" class="btn btn-secondary copy-btn" type="button"><span class="btn-content">Copy</span></button></div><div id="copy-success" class="copy-success-msg" style="display: none;">Link copied!</div></div><div class="qr-controls form-group"><label>QR Code:</label><button id="generate-qr-btn" class="btn btn-primary" type="button" disabled><span class="btn-content"><span class="icon icon-qr"></span>Show QR Code</span></button><button id="hide-qr-btn" class="btn btn-secondary" type="button" style="display: none;"><span class="btn-content">Hide QR Code</span></button></div><div id="qr-code-display" class="qr-code-display" style="display: none;"></div>`;
    const copyButton = document.getElementById('copy-url-btn'); const urlInput = document.getElementById('public-url-input'); const copySuccessMsg = document.getElementById('copy-success');
    if (copyButton && urlInput && copySuccessMsg) { copyButton.addEventListener('click', async function() { const urlToCopy = urlInput.value; const contentSpan = copyButton.querySelector('.btn-content'); const originalText = contentSpan ? contentSpan.textContent : 'Copy'; copyButton.disabled = true; copySuccessMsg.style.display = 'none'; try { await navigator.clipboard.writeText(urlToCopy); copySuccessMsg.style.display = 'block'; if(contentSpan) contentSpan.textContent = 'Copied!'; } catch (err) { console.error('Failed to copy URL:', err); if(contentSpan) contentSpan.textContent = 'Error'; alert('Failed to copy automatically.'); } finally { setTimeout(() => { if(contentSpan) contentSpan.textContent = originalText; copyButton.disabled = false; copySuccessMsg.style.display = 'none'; }, 2000); } }); } else { console.error("Copy URL elements missing."); }
    setupQrCodeGeneration();
}
function setupQrCodeGeneration() {
    console.log("Setting up QR Code listeners..."); const generateBtn = document.getElementById('generate-qr-btn'); const hideBtn = document.getElementById('hide-qr-btn'); const qrCodeContainer = document.getElementById('qr-code-display'); const urlInput = document.getElementById('public-url-input'); if (!generateBtn || !hideBtn || !qrCodeContainer || !urlInput) { console.error("QR Code elements not found."); return; }
    if (typeof QRCode === 'undefined') { console.error("QRCode library not loaded."); generateBtn.title = "QR Code library failed to load."; generateBtn.disabled = true; return; } else { generateBtn.disabled = false; generateBtn.title = ""; console.log("QRCode library found."); }
    if (generateBtn.dataset.listenerAttached !== 'true') { generateBtn.dataset.listenerAttached = 'true'; generateBtn.addEventListener('click', () => { const urlToEncode = urlInput.value; if (!urlToEncode) { alert("URL missing."); return; } qrCodeContainer.innerHTML = ''; qrCodeContainer.style.display = 'block'; hideBtn.style.display = 'inline-block'; generateBtn.style.display = 'none'; try { new QRCode(qrCodeContainer, { text: urlToEncode, width: 160, height: 160, colorDark : "#2C1B18", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H }); } catch (error) { console.error("Error generating QR Code:", error); qrCodeContainer.innerHTML = `<p class="error-message">Error: ${error.message}</p>`; hideBtn.style.display = 'none'; generateBtn.style.display = 'inline-block'; } }); }
    if (hideBtn.dataset.listenerAttached !== 'true') { hideBtn.dataset.listenerAttached = 'true'; hideBtn.addEventListener('click', () => { qrCodeContainer.style.display = 'none'; qrCodeContainer.innerHTML = ''; hideBtn.style.display = 'none'; generateBtn.style.display = 'inline-block'; }); }
    console.log("QR Code listeners attached.");
}
// --- END: Public URL & QR Code Functions ---


// --- Primary Execution Logic (Auth Listener with Email Verification) ---
onAuthStateChanged(auth, (user) => {
    const currentPath = window.location.pathname;
    console.log("[app.js onAuthStateChanged] Fired. User:", user ? user.uid : 'None', "Path:", currentPath);

    // Re-select elements within callback
    const authStatusEl = document.getElementById('auth-status'); // Optional: for loading state
    const dashboardContentEl = document.getElementById('dashboard-content');
    const userEmailEl = document.getElementById('user-email'); // In header
    const verifyNoticeEl = document.getElementById('verify-email-notice'); // Add to header HTML

    if (user) { // User is potentially SIGNED IN
      console.log("[app.js onAuthStateChanged] User detected.");

      // *** CHECK VERIFICATION STATUS ***
      if (!user.emailVerified) {
          console.warn(`[app.js onAuthStateChanged] User ${user.uid} email NOT verified.`);
          if (userEmailEl) userEmailEl.textContent = `${user.email || 'Account'} (Unverified)`;

          // Show a notice if the element exists
          if (verifyNoticeEl) {
              verifyNoticeEl.innerHTML = `Please verify your email to access all features. <button id="resend-verify-header-btn" class="btn btn-secondary btn-small">Resend Email</button>`; // Added classes to button
              verifyNoticeEl.style.display = 'block'; // Or appropriate display style

              // Add listener for resend button within the notice (ensure button ID is unique)
              const resendBtnHeader = document.getElementById('resend-verify-header-btn');
              if (resendBtnHeader && !resendBtnHeader.dataset.listenerAttached) { // Prevent multiple listeners
                  resendBtnHeader.dataset.listenerAttached = 'true';
                  resendBtnHeader.onclick = async () => {
                      resendBtnHeader.textContent = 'Sending...'; // Provide feedback
                      resendBtnHeader.disabled = true;
                      try {
                          await sendEmailVerification(user);
                          alert('Verification email resent. Please check your inbox (and spam folder).');
                          verifyNoticeEl.innerHTML = `Verification email resent to ${user.email}.`; // Update notice
                      } catch (e) {
                          console.error("Error resending verification email:", e);
                          alert('Error resending email. Please try again later.');
                          verifyNoticeEl.innerHTML = `Error resending email. Please try again later. <button id="resend-verify-header-btn" class="btn btn-secondary btn-small">Resend Email</button>`; // Restore button
                          resendBtnHeader.textContent = 'Resend Email'; // Restore text on error
                          resendBtnHeader.disabled = false;
                      }
                  };
              }
          }

          // If they try to access the dashboard directly, redirect them
          if (currentPath.includes('/brewery/dashboard.html')) {
              console.log("[app.js onAuthStateChanged] Unverified user on dashboard path. Redirecting to login.");
              // It's often better *not* to sign them out here, let them verify then log back in easily.
              window.location.replace('/login.html?reason=unverified'); // Redirect
              return; // Stop further processing for this unverified state
          }
          // Allow access to login, signup, or maybe a dedicated verify page
          else if (currentPath.includes('/login.html') || currentPath.includes('/signup') /* || currentPath.includes('/verify-email.html') */ ) {
               console.log("[app.js onAuthStateChanged] Unverified user on allowed page.");
               // Stay on the current page
          }
          // Optionally redirect other protected pages if necessary
          // else if (currentPath.includes('/some-other-protected-page.html')) {
          //      window.location.replace('/login.html?reason=unverified');
          //      return;
          // }

          // Ensure dashboard content is hidden if they land on a non-redirected page while unverified
          if (dashboardContentEl) dashboardContentEl.style.display = 'none';
          if (authStatusEl) authStatusEl.style.display = 'none'; // Hide loading if it was visible

      } else {
          // *** USER IS VERIFIED ***
          console.log(`[app.js onAuthStateChanged] User ${user.uid} IS verified.`);
          if (userEmailEl) userEmailEl.textContent = user.email || 'Account'; // Display normal email
          if (authStatusEl) authStatusEl.style.display = 'none'; // Hide loading status
          if (verifyNoticeEl) verifyNoticeEl.style.display = 'none'; // Hide verification notice

          // Proceed with dashboard initialization or redirect checks
          if (currentPath.includes('/brewery/dashboard.html')) {
                console.log("[app.js onAuthStateChanged] Path is dashboard. Initializing...");
                if (dashboardContentEl) {
                    // Use a flag to prevent re-initialization which attaches duplicate listeners
                    if (dashboardContentEl.dataset.initialized !== 'true') {
                        dashboardContentEl.dataset.initialized = 'true'; // Set flag
                        initDashboard(user);
                    } else {
                        console.log("[app.js onAuthStateChanged] Dashboard already initialized (verified user).");
                    }
                } else {
                    console.error("[app.js onAuthStateChanged] Dashboard content element not found (verified user)!");
                }
          } else if (currentPath.includes('/login.html') || currentPath === '/' || currentPath === '/index.html' || currentPath.includes('/signup')) {
                // If a verified user somehow lands on login/index/signup, send them to the dashboard
                console.log("[app.js onAuthStateChanged] Path is login/index/signup. Redirecting verified user to dashboard...");
                window.location.replace('/brewery/dashboard.html');
          } else {
                console.log("[app.js onAuthStateChanged] Verified user, on other page:", currentPath);
                // Allow access to other pages if needed, or add redirects
          }
      } // End emailVerified check

    } else { // User is SIGNED OUT
       console.log("[app.js onAuthStateChanged] No user detected.");
       if (userEmailEl) userEmailEl.textContent = ''; // Clear email
       if (verifyNoticeEl) verifyNoticeEl.style.display = 'none'; // Hide verification notice
       if (dashboardContentEl) {
           dashboardContentEl.style.display = 'none'; // Hide dashboard
           dashboardContentEl.dataset.initialized = 'false'; // Reset initialization flag
       }
       if (authStatusEl) authStatusEl.style.display = 'none'; // Hide loading status

       // If not logged in and trying to access dashboard, redirect to login
       if (currentPath.includes('/brewery/dashboard.html')) {
            console.log("[app.js onAuthStateChanged] Path is dashboard. Redirecting signed-out user to login...");
            window.location.replace('/login.html');
       }
       // If not logged in and on other pages (like login/signup/index), just stay there
       else {
            console.log("[app.js onAuthStateChanged] Not logged in, current page:", currentPath);
       }
    }
});

// --- Exports (If needed by other modules - likely not for app.js) ---
// export { createBatch, listBatches, getFeedbackCount };