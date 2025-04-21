

import { db } from './firebase-config.js';
import { collection, query, where, getDocs, doc, getDoc, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // Added Timestamp import

// --- DOM Elements ---
const batchListContainer = document.getElementById('batch-list-container');
const loadingIndicator = document.getElementById('loading-indicator');
const errorArea = document.getElementById('error-area');
const noBatchesMessage = document.getElementById('no-batches-message');
const breweryNameElement = document.getElementById('brewery-name');
const pageInstructionsElement = document.getElementById('page-instructions');

// --- Helper Functions ---

/**
 * Displays an error message on the page.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
    console.error("Displaying Error:", message);
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (noBatchesMessage) noBatchesMessage.style.display = 'none';
    if (batchListContainer) batchListContainer.innerHTML = ''; // Clear any partial list
    if (errorArea) {
        errorArea.textContent = `Error: ${message}`;
        errorArea.style.display = 'block';
    }
    if (pageInstructionsElement) pageInstructionsElement.style.display = 'none'; // Hide instructions on error
    if (breweryNameElement) breweryNameElement.textContent = 'Error'; // Update title on error
}

/**
 * Fetches brewery details (just name for now).
 * @param {string} breweryId - The ID of the brewery.
 * @returns {Promise<string|null>} The brewery name or null if not found/error.
 */
async function fetchBreweryName(breweryId) {
    try {
        const breweryRef = doc(db, "breweries", breweryId);
        const brewerySnap = await getDoc(breweryRef);

        if (brewerySnap.exists()) {
            return brewerySnap.data().breweryName || `Brewery ${breweryId.substring(0, 6)}...`;
        } else {
            console.warn(`Brewery document ${breweryId} not found.`);
            return `Brewery (ID: ${breweryId.substring(0, 6)}...)`;
        }
    } catch (error) {
        console.error("Error fetching brewery name:", error);
        return `Brewery (ID: ${breweryId.substring(0, 6)}...)`; // Fallback on error
    }
}

/**
 * Fetches active batches for a given brewery ID.
 * @param {string} breweryId - The ID of the brewery.
 * @returns {Promise<Array<object>>} A promise resolving to an array of batch data objects.
 */
async function fetchActiveBatches(breweryId) {
    console.log(`Fetching active batches for brewery: ${breweryId}`);
    const batches = [];
    try {
        const batchesRef = collection(db, "batches");
        // Query for documents where breweryId matches AND isActive is true
        const q = query(batchesRef,
            where("breweryId", "==", breweryId),
            where("isActive", "==", true),
            // *** UPDATED TO USE CORRECT FIELD NAME ***
            orderBy("createdAt", "desc") // Use the correct field name: createdAt
        );

        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            batches.push({ id: doc.id, ...doc.data() });
        });
        console.log(`Found ${batches.length} active batches.`);
        return batches;
    } catch (error) {
        console.error("Error fetching active batches:", error);
         // Check for missing Firestore index error
        if (error.code === 'failed-precondition') {
             console.error("Firestore Index Required! Check the developer console for a link to create the necessary composite index for this query (filtering on breweryId/isActive and ordering by createdAt).");
             // Display a more user-friendly message specific to the index issue
             throw new Error(`Database configuration needed. Please contact support (Index Error).`);
        }
        // Throw other errors
        throw new Error(`Could not fetch batches. ${error.message}`);
    }
}

/**
 * Renders the list of active batches onto the page.
 * @param {Array<object>} batches - An array of batch data objects.
 */
function renderBatchList(batches) {
    if (!batchListContainer) return;
    batchListContainer.innerHTML = ''; // Clear previous content or loading indicator

    if (batches.length === 0) {
        if (noBatchesMessage) noBatchesMessage.style.display = 'block';
        return;
    } else {
         if (noBatchesMessage) noBatchesMessage.style.display = 'none'; // Ensure 'no batches' is hidden
    }

    const fragment = document.createDocumentFragment();
    batches.forEach(batch => {
        const batchElement = document.createElement('a'); // Use <a> for easy navigation
        batchElement.className = 'batch-list-item';
        // Set the href directly to the feedback page URL
        batchElement.href = `/feedback/index.html?batchId=${batch.id}`;
        batchElement.dataset.batchId = batch.id; // Store ID for potential JS use

        const metaParts = [
            batch.style ? batch.style : '',
            batch.abv ? `${batch.abv}% ABV` : '',
            batch.ibu ? `${batch.ibu} IBU` : ''
        ].filter(Boolean).join(' · '); // Filter out empty parts and join with ' · '

        batchElement.innerHTML = `
            <h3>${batch.batchName || 'Unnamed Batch'}</h3>
            ${metaParts ? `<p class="batch-meta">${metaParts}</p>` : ''}
            ${batch.brewersNotes ? `<p>${batch.brewersNotes}</p>` : ''}
        `;
        // Add click listener (though href handles navigation, useful for potential analytics)
        batchElement.addEventListener('click', (e) => {
             // Optional: Prevent default if doing something else first,
             // but usually just letting the href work is fine.
             // e.preventDefault();
             console.log(`Batch selected: ${batch.id}`);
             // window.location.href = batchElement.href; // Redundant if href is set
        });

        fragment.appendChild(batchElement);
    });

    batchListContainer.appendChild(fragment);
}


// --- Main Execution ---

/**
 * Initializes the batch selection page.
 */
async function initPage() {
    // 1. Get breweryId from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const breweryId = urlParams.get('breweryId');

    if (!breweryId) {
        displayError("Brewery ID is missing in the URL.");
        return;
    }

    if (!breweryNameElement || !batchListContainer || !loadingIndicator || !errorArea) {
         console.error("Critical page elements are missing. Cannot initialize.");
         // Display error in body if possible
         document.body.innerHTML = '<p class="error-message" style="padding: 20px;">Error: Page structure is broken.</p>';
         return;
    }

    // Show loading initially
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (noBatchesMessage) noBatchesMessage.style.display = 'none'; // Hide no batches msg initially
    if (errorArea) errorArea.style.display = 'none'; // Hide errors initially

    try {
        // 2. Fetch Brewery Name (optional but nice)
        const name = await fetchBreweryName(breweryId);
        if (breweryNameElement) breweryNameElement.textContent = name || 'Select a Batch';

        // 3. Fetch Active Batches
        const activeBatches = await fetchActiveBatches(breweryId);

        // 4. Hide loading indicator AFTER fetching
        if (loadingIndicator) loadingIndicator.style.display = 'none';

        // 5. Render the list (this will show the "no batches" message if needed)
        renderBatchList(activeBatches);

    } catch (error) {
        // Errors from fetch functions are caught here
        // Ensure loading is hidden before displaying the error
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        displayError(error.message || "An unexpected error occurred.");
    }
}

// --- Run Initialization ---
// Ensure DOM is ready (though modules usually defer)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
} else {
    initPage();
}