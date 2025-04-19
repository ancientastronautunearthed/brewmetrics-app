// public/assets/js/app.js
// Handles logic specifically for the brewery dashboard page

import { auth, db } from './firebase-config.js';
import { flavorCategories } from './flavor-data.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";
// Import necessary Firestore functions including updateDoc and Timestamp
import { collection, addDoc, query, where, getDocs, doc, getDoc, serverTimestamp, orderBy, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// --- Core Logic Functions (Dashboard Related) ---

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
            breweryId: user.uid,
            batchName: batchName,
            creationDate: serverTimestamp(),
            isActive: true,
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


// List batches for current brewery (Displays enhanced info + activation toggle)
async function listBatches(user) {
    if (!user) { console.error("listBatches called without user object."); return []; }
    console.log(`Listing batches for user ${user.uid}`);
    const batchesListElement = document.getElementById('batches-list');
    if (!batchesListElement) { console.error('Batches list container element not found!'); return []; }
    batchesListElement.innerHTML = '<p>Loading batches...</p>';

    try {
        const batchesRef = collection(db, "batches");
        const qBatches = query(batchesRef, where("breweryId", "==", user.uid), orderBy("creationDate", "desc"));
        const batchesSnapshot = await getDocs(qBatches);
        batchesListElement.innerHTML = ''; // Clear loading

        if (batchesSnapshot.empty) { batchesListElement.innerHTML = '<p>No batches found. Create your first batch above.</p>'; return []; }

        batchesSnapshot.forEach(batchDoc => {
            const batchData = batchDoc.data(); const batchId = batchDoc.id; const isActive = batchData.isActive === true; const feedbackUrl = `${window.location.origin}/feedback/index.html?batchId=${batchId}`;
            const batchItemContainer = document.createElement('div'); batchItemContainer.className = 'batch-item'; batchItemContainer.classList.add(isActive ? 'batch-active' : 'batch-inactive'); batchItemContainer.dataset.batchId = batchId;
            const batchInfoDiv = document.createElement('div'); batchInfoDiv.className = 'batch-info';
            let detailsHtml = ''; if (batchData.style) detailsHtml += `<span> | Style: ${batchData.style}</span>`; if (batchData.abv) detailsHtml += `<span> | ABV: ${batchData.abv}%</span>`; if (batchData.ibu) detailsHtml += `<span> | IBU: ${batchData.ibu}</span>`;
            const activeStatusText = isActive ? 'Active for Feedback' : 'Inactive'; const toggleButtonText = isActive ? 'Deactivate' : 'Activate';
            batchInfoDiv.innerHTML = `<h3>${batchData.batchName || 'Unnamed Batch'} <span class="batch-status">(${activeStatusText})</span></h3><p style="margin-bottom: 5px;"><small>Created: ${batchData.creationDate?.toDate().toLocaleString() || 'N/A'}${detailsHtml}</small></p><p style="margin-bottom: 5px;">Feedback URL: <a href="${feedbackUrl}" target="_blank" rel="noopener noreferrer">${feedbackUrl}</a></p>${batchData.description ? `<p style="font-size: 0.9em; color: #555; margin-top: 5px;">Desc: ${batchData.description}</p>` : ''}<button class="toggle-active-btn" data-batch-id="${batchId}" data-current-state="${isActive}">${toggleButtonText}</button>`;
            batchItemContainer.appendChild(batchInfoDiv);
            const viewFeedbackButton = document.createElement('button'); viewFeedbackButton.className = 'view-feedback-btn'; viewFeedbackButton.textContent = 'View Feedback'; batchInfoDiv.insertAdjacentElement('afterend', viewFeedbackButton);
            const feedbackDetailsDiv = document.createElement('div'); feedbackDetailsDiv.className = 'feedback-details'; feedbackDetailsDiv.style.display = 'none'; feedbackDetailsDiv.innerHTML = '<p><i>Click "View Feedback" to load.</i></p>'; batchItemContainer.appendChild(feedbackDetailsDiv);
            batchesListElement.appendChild(batchItemContainer);
        });
        console.log("Batches listed. Setting up ALL toggle listeners.");
        setupFeedbackToggleListeners(); setupActivationToggleListeners(user);
    } catch (error) { console.error("Error listing batches:", error); batchesListElement.innerHTML = `<p style="color: red;">Error loading batches: ${error.message}</p>`; }
}

// Setup Listeners for Activation Toggle Buttons
function setupActivationToggleListeners(user) {
    console.log("Setting up activation toggle listeners...");
    document.querySelectorAll('.toggle-active-btn').forEach(button => {
        if (button.dataset.listenerAttached === 'true') return; button.dataset.listenerAttached = 'true';
        button.addEventListener('click', async (e) => { const batchId = e.target.dataset.batchId; const currentState = e.target.dataset.currentState === 'true'; e.target.disabled = true; e.target.textContent = 'Updating...'; const success = await toggleBatchActiveState(batchId, currentState); if (success) { await listBatches(user); } else { e.target.disabled = false; e.target.textContent = currentState ? 'Deactivate' : 'Activate'; } }); }); }

// Setup Listeners for Feedback Toggle Buttons (Includes Aggregation Logic)
function setupFeedbackToggleListeners() {
    console.log("Setting up feedback toggle listeners...");
    document.querySelectorAll('.batch-item').forEach(batchItemElement => {
        const batchId = batchItemElement.dataset.batchId; const feedbackContainer = batchItemElement.querySelector('.feedback-details'); const toggleButton = batchItemElement.querySelector('.view-feedback-btn');
        if (!feedbackContainer || !toggleButton) { return; } if (toggleButton.dataset.feedbackListenerAttached === 'true') return; toggleButton.dataset.feedbackListenerAttached = 'true';
        toggleButton.addEventListener('click', async () => {
            console.log(`View Feedback toggle clicked for batch: ${batchId}`); const isCurrentlyHidden = feedbackContainer.style.display === 'none'; const isLoading = feedbackContainer.dataset.loading === 'true'; const isLoaded = feedbackContainer.dataset.loaded === 'true'; if (isLoading) return;
            if (isCurrentlyHidden) { feedbackContainer.style.display = 'block'; toggleButton.textContent = 'Hide Feedback';
                if (!isLoaded) { feedbackContainer.innerHTML = '<p><i>Loading feedback analysis...</i></p>'; feedbackContainer.dataset.loading = 'true';
                    try {
                        const feedbackRef = collection(db, "feedback"); const qFeedback = query(feedbackRef, where("batchId", "==", batchId)); const feedbackSnapshot = await getDocs(qFeedback); feedbackContainer.innerHTML = ''; // Clear loading message
                        if (feedbackSnapshot.empty) { feedbackContainer.innerHTML = '<p><i>No feedback submitted yet.</i></p>'; }
                        else {
                            // --- START: AGGREGATION LOGIC ---
                            let feedbackCount = 0; let totalOverallRating = 0; const comments = []; const flavorAggregates = {};
                            feedbackSnapshot.forEach(doc => {
                                feedbackCount++;
                                const data = doc.data();
                                if (typeof data.overallRating === 'number') { totalOverallRating += data.overallRating; }
                                if (data.comment?.trim()) { comments.push({ text: data.comment, timestamp: data.timestamp?.toDate() }); }
                                if (data.flavorSelections && typeof data.flavorSelections === 'object') {
                                    for (const categoryId in data.flavorSelections) {
                                        if (!flavorAggregates[categoryId]) flavorAggregates[categoryId] = {};
                                        const descriptors = data.flavorSelections[categoryId];
                                        if (typeof descriptors === 'object') {
                                            for (const descriptorId in descriptors) {
                                                if (!flavorAggregates[categoryId][descriptorId]) flavorAggregates[categoryId][descriptorId] = { sum: 0, count: 0 };
                                                if (typeof descriptors[descriptorId] === 'number') {
                                                    flavorAggregates[categoryId][descriptorId].sum += descriptors[descriptorId];
                                                    flavorAggregates[categoryId][descriptorId].count++;
                                                } } } } } });
                            // --- END: AGGREGATION LOGIC ---

                            // --- START: RENDER AGGREGATED RESULTS ---
                            const avgOverall = feedbackCount > 0 ? (totalOverallRating / feedbackCount).toFixed(1) : 'N/A';
                            let summaryHtml = `<h4>Feedback Summary (${feedbackCount} Entries)</h4><p><strong>Average Overall Rating:</strong> ${avgOverall} / 5</p><h5>Average Flavor Ratings:</h5><ul style="padding-left: 20px; list-style: disc;">`;
                            for (const categoryId in flavorCategories) { // Iterate defined categories for order
                                const category = flavorCategories[categoryId];
                                if (flavorAggregates[categoryId]) { // Check if data exists for category
                                    let categoryHtml = `<li><strong>${category.name}:</strong> `;
                                    let descParts = [];
                                    category.descriptors.forEach(desc => { // Iterate defined descriptors
                                        const descId = desc.id;
                                        const aggregate = flavorAggregates[categoryId]?.[descId];
                                        if (aggregate && aggregate.count > 0) {
                                            descParts.push(`${desc.name}: ${(aggregate.sum / aggregate.count).toFixed(1)}`);
                                        } });
                                    if (descParts.length > 0) { categoryHtml += descParts.join(' | '); categoryHtml += '</li>'; summaryHtml += categoryHtml; } } }
                            summaryHtml += '</ul><h5>Comments:</h5>';
                            if (comments.length > 0) { summaryHtml += '<ul style="max-height: 150px; overflow-y: auto; border: 1px solid #eee; padding: 10px; list-style: none; margin-top: 5px;">'; comments.forEach(comment => { const commentDate = comment.timestamp ? `<small>(${comment.timestamp.toLocaleString()})</small>` : ''; summaryHtml += `<li style="border-bottom: 1px dotted #ccc; margin-bottom: 5px; padding-bottom: 5px;">${comment.text} ${commentDate}</li>`; }); summaryHtml += '</ul>'; } else { summaryHtml += '<p><i>No comments submitted.</i></p>'; }
                            feedbackContainer.innerHTML = summaryHtml;
                            // --- END: RENDER AGGREGATED RESULTS ---
                        }
                        feedbackContainer.dataset.loaded = 'true';
                    } catch (feedbackError) { console.error(`Error fetching/aggregating feedback for batch ${batchId}:`, feedbackError); const errorMsg = feedbackError.message?.includes("breweryId is undefined") ? "Permission denied. Emulator rule issue suspected." : `Error loading feedback. (${feedbackError.message || 'Unknown error'})`; feedbackContainer.innerHTML = `<p style="color: red;"><i>${errorMsg}</i></p>`; feedbackContainer.dataset.loaded = 'false'; }
                    finally { feedbackContainer.dataset.loading = 'false'; } }
            } else { feedbackContainer.style.display = 'none'; toggleButton.textContent = 'View Feedback'; } }); }); }

// Get feedback count for a batch
async function getFeedbackCount(batchId) {
   try { const feedbackRef = collection(db, "feedback"); const q = query(feedbackRef, where("batchId", "==", batchId)); const querySnapshot = await getDocs(q); return querySnapshot.size; } catch (error) { console.error("Error getting feedback count for batch " + batchId + ":", error); return 0; }
}

// Setup dashboard event listeners (for batch creation form)
function setupDashboardEventListeners(user) {
    console.log("Setting up dashboard event listeners."); const batchForm = document.getElementById('batch-form'); const createBatchButton = batchForm ? batchForm.querySelector('button[type="submit"]') : null; const batchNameInput = document.getElementById('batch-name'); const batchStyleInput = document.getElementById('batch-style'); const batchAbvInput = document.getElementById('batch-abv'); const batchIbuInput = document.getElementById('batch-ibu'); const batchDescriptionInput = document.getElementById('batch-description'); const batchBrewersNotesInput = document.getElementById('batch-brewers-notes'); const batchIncentiveTextInput = document.getElementById('batch-incentive-text');
    if (batchForm && createBatchButton) { if (batchForm.dataset.listenerAttached === 'true') { return; } batchForm.dataset.listenerAttached = 'true'; console.log("Attaching batch form submit listener."); const handleBatchSubmit = async (e) => { e.preventDefault(); console.log("Batch form submitted."); const batchDetails = { batchName: batchNameInput.value, style: batchStyleInput.value, abv: batchAbvInput.value, ibu: batchIbuInput.value, description: batchDescriptionInput.value, brewersNotes: batchBrewersNotesInput.value, incentiveText: batchIncentiveTextInput.value }; createBatchButton.disabled = true; createBatchButton.textContent = 'Creating...'; try { await createBatch(user, batchDetails); batchForm.reset(); } catch (error) { console.error("Error occurred during batch creation process:", error); } finally { createBatchButton.disabled = false; createBatchButton.textContent = 'Create Batch'; } }; batchForm.addEventListener('submit', handleBatchSubmit);
    } else { console.error("Could not find batch form or button needed for event listeners."); } }

// Initialize dashboard page
function initDashboard(user) {
    console.log("Initializing dashboard components for user:", user.uid); if (!user) { return; }
    setupDashboardEventListeners(user); listBatches(user);
}

// --- START: Public URL & QR Code Functions ---

function updateBreweryPublicUrl(userId) {
    const breweryPublicUrlContainer = document.getElementById('brewery-public-url'); if (!breweryPublicUrlContainer) { console.warn("Element with ID 'brewery-public-url' not found."); return; }
    const baseUrl = window.location.origin; const selectBatchUrl = `${baseUrl}/select-batch/index.html?breweryId=${userId}`;
    breweryPublicUrlContainer.innerHTML = `<h3>Your Public Batch Selection URL</h3><p>Share this URL or create a QR code for customers to access your active batches:</p><div class="url-container" style="display: flex; align-items: center; gap: 10px; margin-top: 5px;"><input type="text" id="public-url-input" value="${selectBatchUrl}" readonly style="flex-grow: 1; padding: 5px;"><button id="copy-url-btn" class="copy-btn" style="padding: 5px 10px; cursor: pointer;">Copy</button></div><div id="copy-success" class="copy-success" style="display: none; color: green; font-size: 0.9em; margin-top: 5px;">URL copied!</div><div style="margin-top: 15px;"><button id="generate-qr-btn" style="padding: 5px 10px; cursor: pointer;" disabled>Show QR Code</button><button id="hide-qr-btn" style="padding: 5px 10px; cursor: pointer; display: none; margin-left: 5px;">Hide QR Code</button></div><div id="qr-code-display" style="margin-top: 15px; background: white; padding: 10px; border: 1px solid #ccc; display: none; width: fit-content;"><p>QR Code will appear here.</p></div>`;
    const copyButton = document.getElementById('copy-url-btn'); const urlInput = document.getElementById('public-url-input'); const copySuccess = document.getElementById('copy-success');
    if (copyButton && urlInput && copySuccess) { copyButton.addEventListener('click', function() { urlInput.select(); urlInput.setSelectionRange(0, 99999); try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(urlInput.value).then(() => { console.log('URL copied (API)'); copySuccess.style.display = 'block'; setTimeout(() => { copySuccess.style.display = 'none'; }, 2000); }).catch(err => { console.error('Copy API failed:', err); copyUsingExecCommand(urlInput, copySuccess); }); } else { copyUsingExecCommand(urlInput, copySuccess); } } catch (err) { console.error('Error copying:', err); alert('Failed to copy.'); } });
    } else { console.error("Copy elements not found."); }
    setupQrCodeGeneration(); // Setup QR button listeners
}

function copyUsingExecCommand(urlInput, copySuccess) {
    try { urlInput.select(); urlInput.setSelectionRange(0, 99999); const successful = document.execCommand('copy'); if (successful) { console.log('URL copied (execCommand)'); copySuccess.style.display = 'block'; setTimeout(() => { copySuccess.style.display = 'none'; }, 2000); } else { console.error('execCommand copy failed'); alert('Failed to copy (execCommand).'); } } catch (err) { console.error('Error using execCommand:', err); alert('Failed to copy (execCommand).'); } window.getSelection()?.removeAllRanges();
}

function setupQrCodeGeneration() {
    console.log("Setting up QR Code listeners..."); const generateBtn = document.getElementById('generate-qr-btn'); const hideBtn = document.getElementById('hide-qr-btn'); const qrCodeContainer = document.getElementById('qr-code-display'); const urlInput = document.getElementById('public-url-input');
    if (!generateBtn || !hideBtn || !qrCodeContainer || !urlInput) { console.error("QR Code elements not found."); return; }
    generateBtn.disabled = false; // Enable button
    generateBtn.addEventListener('click', () => { const urlToEncode = urlInput.value; if (!urlToEncode) { alert("URL missing."); return; } console.log("Generating QR code for:", urlToEncode); qrCodeContainer.innerHTML = ''; qrCodeContainer.style.display = 'block'; hideBtn.style.display = 'inline-block'; generateBtn.style.display = 'none'; try { if (typeof QRCode === 'undefined') throw new Error("QRCode library not loaded."); new QRCode(qrCodeContainer, { text: urlToEncode, width: 128, height: 128, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H }); } catch (error) { console.error("Error generating QR Code:", error); qrCodeContainer.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`; hideBtn.style.display = 'none'; generateBtn.style.display = 'inline-block'; } });
    hideBtn.addEventListener('click', () => { qrCodeContainer.style.display = 'none'; qrCodeContainer.innerHTML = ''; hideBtn.style.display = 'none'; generateBtn.style.display = 'inline-block'; });
}

// --- END: Public URL & QR Code Functions ---


// --- Primary Execution Logic ---

onAuthStateChanged(auth, (user) => {
  setTimeout(() => {
    const currentPath = window.location.pathname; console.log("[app.js onAuthStateChanged] Fired. User:", user ? user.uid : 'None', "Path:", currentPath);
    if (user) { // User is SIGNED IN
      console.log("[app.js onAuthStateChanged] User detected.");
      if (currentPath.includes('/brewery/dashboard.html')) { console.log("[app.js onAuthStateChanged] Path is dashboard. Initializing..."); const authStatusEl = document.getElementById('auth-status'); const dashboardContentEl = document.getElementById('dashboard-content'); if (authStatusEl) authStatusEl.style.display = 'none'; if (dashboardContentEl) dashboardContentEl.style.display = 'block'; updateBreweryPublicUrl(user.uid); initDashboard(user); }
      else if (currentPath.includes('/login.html') || currentPath === '/' || currentPath === '/index.html' || currentPath.includes('/signup.html')) { console.log("[app.js onAuthStateChanged] Path is login/index/signup. Redirecting..."); window.location.replace('/brewery/dashboard.html'); }
      else { console.log("[app.js onAuthStateChanged] Logged in, on other page:", currentPath); }
    } else { // User is SIGNED OUT
       console.log("[app.js onAuthStateChanged] No user detected.");
      if (currentPath.includes('/brewery/dashboard.html')) { console.log("[app.js onAuthStateChanged] Path is dashboard. Redirecting to login..."); window.location.replace('/login.html'); }
      else { console.log("[app.js onAuthStateChanged] Not logged in, current page:", currentPath); const dashboardContentEl = document.getElementById('dashboard-content'); if (dashboardContentEl) dashboardContentEl.style.display = 'none'; } }
  }, 50); });

// --- Exports ---
export { createBatch, listBatches, getFeedbackCount };