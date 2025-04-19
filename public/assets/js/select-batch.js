// public/assets/js/select-batch.js
// Handles logic for the select-batch/index.html page

// Import db instance from firebase-config.js and necessary v9 modular functions
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI elements
    const activeBatchesList = document.getElementById('active-batches-list');
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const noBatchesMessage = document.getElementById('no-batches-message');
    // Brewery name display removed for simplicity for now

    // Get breweryId from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const breweryId = urlParams.get('breweryId');

    // Function to show error message
    function showError(message) {
        loadingIndicator.style.display = 'none'; // Hide loading
        activeBatchesList.innerHTML = ''; // Clear any partial list
        noBatchesMessage.style.display = 'none'; // Hide no batches message
        errorMessage.textContent = message;
        errorMessage.style.display = 'block'; // Show error
    }

    // Check if breweryId is provided
    if (!breweryId) {
        showError('Brewery not specified. Please use the link or QR code provided by the brewery.');
        return; // Stop execution
    }

    // Function to redirect to feedback form
    function selectBatch(batchId) {
        console.log(`Redirecting to feedback for batchId: ${batchId}`);
        // Using replace is slightly better, but href works too
        window.location.href = `/feedback/index.html?batchId=${batchId}`;
    }

    // --- Main Function to Load and Display Active Batches ---
    async function loadActiveBatches() {
        // Clear previous state
        activeBatchesList.innerHTML = '';
        errorMessage.style.display = 'none';
        noBatchesMessage.style.display = 'none';
        loadingIndicator.style.display = 'block'; // Show loading indicator

        try {
            // Construct the v9 Firestore query
            const batchesRef = collection(db, 'batches');
            const q = query(batchesRef,
                            where('breweryId', '==', breweryId),
                            where('isActive', '==', true), // Only get active batches
                            orderBy('creationDate', 'desc')); // Order by newest first

            const querySnapshot = await getDocs(q);

            loadingIndicator.style.display = 'none'; // Hide loading indicator

            if (querySnapshot.empty) {
                console.log("No active batches found for brewery:", breweryId);
                noBatchesMessage.style.display = 'block'; // Show 'no batches' message
                return;
            }

            // Process each batch and create UI elements
            querySnapshot.forEach((doc) => {
                const batchData = doc.data();
                const batchId = doc.id;

                // Create batch element (e.g., a clickable div)
                const batchElement = document.createElement('div');
                batchElement.className = 'batch-item'; // Use same class as dashboard? Or specific one?
                // Set data attribute for easy ID retrieval on click
                batchElement.setAttribute('data-batch-id', batchId);

                // Prepare batch details for display
                const batchName = batchData.batchName || 'Unnamed Batch';
                // Use optional chaining ?. and nullish coalescing ?? ''
                const batchStyle = batchData.style ? `<span class="batch-style">Style: ${batchData.style}</span>` : '';
                const batchAbv = batchData.abv ? `<span class="batch-abv">ABV: ${batchData.abv}%</span>` : '';
                const batchIbu = batchData.ibu ? `<span class="batch-ibu">IBU: ${batchData.ibu}</span>` : '';
                // Note: Description might be too long for this list view

                // Build the HTML content for the list item
                batchElement.innerHTML = `
                    <h3>${batchName}</h3>
                    <div class="batch-details" style="display: flex; gap: 10px; margin-top: 5px;">
                        ${batchStyle}
                        ${batchAbv}
                        ${batchIbu}
                    </div>
                    <!-- Removed description display for brevity -->
                    <!-- Removed button, making whole div clickable -->
                `;

                // Add click event listener to the whole batch item div
                batchElement.addEventListener('click', () => {
                    selectBatch(batchId); // Redirect on click
                });
                 batchElement.style.cursor = 'pointer'; // Indicate it's clickable

                // Add the created element to the list container
                activeBatchesList.appendChild(batchElement);
            });

        } catch (error) {
            console.error("Error fetching active batches:", error);
            showError('Could not load the list of beers. Please ensure you used the correct link and try again.');
        }
    }

    // --- Initialize the page ---
    loadActiveBatches();

}); // End DOMContentLoaded