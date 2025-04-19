// public/assets/js/feedback-form.js
// Handles logic specifically for the feedback/index.html page

import { db } from './firebase-config.js'; // Import the initialized db instance
import { flavorCategories } from './flavor-data.js'; // Import our flavor definitions
import { collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js"; // Import needed Firestore functions

// --- ADDED START ---
// Data structure for the "No BS" slider anchor text
// Keys should match the category IDs used in flavor-data.js
const sliderAnchorLabels = {
    hoppy: { // Example: Assuming 'hoppy' is a categoryId from flavor-data.js
        1: "Barely There", // Corresponds to slider value 1
        3: "Yep, Hoppy",     // Corresponds to slider value 3
        5: "Face Full"       // Corresponds to slider value 5
    },
    malty: {
        1: "Ghost Malt",
        3: "Solid",
        5: "Liquid Bread"
    },
    yeasty: { // Adapt key if your categoryId is different (e.g., 'esters_phenols')
        1: "Clean",
        3: "Present",
        5: "Yeast Party"
    },
    bitterness: { // Assuming 'bitterness' is a category or descriptor ID used uniquely
        1: "Zero Bite",
        3: "Balanced",
        5: "Enamel Issues"
    },
    sweetness: {
        1: "Bone Dry",
        3: "Noticeable",
        5: "Syrup Zone"
    },
    body: {
        1: "Watery",
        3: "Medium",
        5: "Chewy"
    }
    // Add/remove/modify entries to match the categoryIds in your flavor-data.js
    // Ensure the keys (e.g., 'hoppy', 'malty') exactly match the categoryId variable in the buildFlavorInputs loop
};

// Define the slider values for which we want to display labels (must be within the 1-5 range)
const anchorPoints = [1, 3, 5]; // Display labels for the start, middle, and end points
// --- ADDED END ---


// --- Helper Functions ---

// Fetches Batch Details (Name and Brewer's Notes) from Firestore
async function getBatchDetails(batchId) {
    console.log(`Getting batch details for ID: ${batchId}`);
    if (!batchId) throw new Error("batchId is required for getBatchDetails");
    try {
        const batchRef = doc(db, "batches", batchId);
        const batchSnap = await getDoc(batchRef);
        if (batchSnap.exists()) {
            const batchData = batchSnap.data();
            console.log("Batch details found:", batchData);
            return {
                batchName: batchData.batchName,
                brewersNotes: batchData.brewersNotes
                // Add incentiveText here if needed elsewhere initially
            };
        } else {
            console.error("Batch document not found for ID:", batchId);
            throw new Error("Batch not found");
        }
    } catch (error) {
        console.error(`Error getting batch details for ${batchId}:`, error);
        throw error;
    }
}

// Dynamically builds the HTML for flavor inputs based on flavor-data.js
function buildFlavorInputs() {
    console.log("Building flavor inputs...");
    const container = document.getElementById('dynamic-flavor-section');
    if (!container) {
        console.error("Dynamic flavor section container not found!");
        return;
    }
    container.innerHTML = ''; // Clear loading message

    // --- Loop through categories ---
    for (const categoryId in flavorCategories) {
        if (flavorCategories.hasOwnProperty(categoryId)) { // Good practice for for...in
            const category = flavorCategories[categoryId];

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'flavor-category';

            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = category.name;
            const categoryDesc = document.createElement('p');
            categoryDesc.className = 'category-description';
            categoryDesc.textContent = category.description;
            categoryDiv.appendChild(categoryTitle);
            categoryDiv.appendChild(categoryDesc);

            // --- Loop through descriptors for the category ---
            category.descriptors.forEach(desc => {
                const blockDiv = document.createElement('div');
                blockDiv.className = 'descriptor-block';

                const label = document.createElement('label');
                const ratingValueSpan = document.createElement('span');
                const educationSpan = document.createElement('span');
                const sliderInput = document.createElement('input');

                const inputId = `rating-${categoryId}-${desc.id}`;
                const valueSpanId = `${inputId}-value`;

                label.htmlFor = inputId;
                label.textContent = `${desc.name}: `; // Add colon and space

                ratingValueSpan.id = valueSpanId;
                ratingValueSpan.className = 'rating-value';
                ratingValueSpan.textContent = '3'; // Default value (matches slider default)

                educationSpan.className = 'education-tip';
                educationSpan.title = desc.education; // Tooltip text
                educationSpan.textContent = '(?)'; // Indicator
                educationSpan.style.cursor = 'help'; // Indicate hover is useful
                educationSpan.style.marginLeft = '5px';

                label.appendChild(ratingValueSpan); // Add value span to label
                label.appendChild(educationSpan);  // Add tip span to label

                sliderInput.type = 'range';
                sliderInput.id = inputId;
                sliderInput.name = inputId; // Use name for potential form submission without JS
                sliderInput.min = '1';
                sliderInput.max = '5';
                sliderInput.value = '3'; // Default value
                sliderInput.setAttribute('aria-labelledby', valueSpanId); // Accessibility hint

                blockDiv.appendChild(label);
                blockDiv.appendChild(sliderInput);

                // --- ADDED START ---
                // Add the anchor labels below the slider
                const anchors = sliderAnchorLabels[categoryId]; // Get anchors based on CATEGORY ID

                // If anchors are defined for this category, create the label container
                // NOTE: This assumes anchors are defined per-category.
                // If you need anchors per-DESCRIPTOR, you'd use `desc.id` as the key
                // and adjust the `sliderAnchorLabels` structure accordingly.
                if (anchors) {
                    const anchorContainer = document.createElement('div');
                    anchorContainer.className = 'slider-anchor-labels'; // Class for CSS styling

                    anchorPoints.forEach(point => { // Loop through points [1, 3, 5]
                        const labelSpan = document.createElement('span');
                        labelSpan.textContent = anchors[point] || ''; // Get text for 1, 3, 5
                        anchorContainer.appendChild(labelSpan);
                    });

                    // Append the anchor labels container BELOW the slider element within the block
                    blockDiv.appendChild(anchorContainer);
                } else {
                     // Optional: Log if anchors are missing for a category being rendered
                     // console.warn(`Slider anchors not defined for categoryId: ${categoryId}`);
                }
                // --- ADDED END ---


                categoryDiv.appendChild(blockDiv);
            }); // --- End descriptor loop ---

            container.appendChild(categoryDiv);
        } // End hasOwnProperty check
    } // --- End category loop ---

    console.log("Flavor inputs built.");
}


// Sets up listeners to update the displayed value next to sliders
function setupSliderValueDisplay() {
   console.log("Setting up slider displays...");
   // Select all range inputs within the dynamic section to be more specific
   const rangeInputs = document.querySelectorAll('#dynamic-flavor-section input[type="range"]');
   rangeInputs.forEach(inputElement => {
       const valueSpanId = `${inputElement.id}-value`; // Convention remains the same
       const displayElement = document.getElementById(valueSpanId);
       if (inputElement && displayElement) {
           // Set initial value display correctly
           displayElement.textContent = inputElement.value;
           // Add event listener
           inputElement.addEventListener('input', (event) => {
               displayElement.textContent = event.target.value;
           });
       } else {
           console.warn(`Slider setup: Could not find elements for ${inputElement.id} or ${valueSpanId}`);
       }
   });
   console.log("Slider displays set up.");
}


// Handles the submission of the feedback form
async function submitFeedback(batchId) {
    console.log(`Attempting to submit feedback for batch: ${batchId}`);
    const submitButton = document.getElementById('submit-feedback');
    const errorElement = document.getElementById('error-message');
    const feedbackFormContainer = document.getElementById('feedback-form-container');
    const thankYouMessage = document.getElementById('thank-you-message');
    const incentiveTextElement = document.getElementById('incentive-text');

    if (!submitButton || !errorElement || !feedbackFormContainer || !thankYouMessage || !incentiveTextElement) {
        console.error("SubmitFeedback: One or more required page elements not found.");
        if(errorElement) { errorElement.textContent = "Page structure error."; errorElement.style.display = 'block'; }
        return;
    }

    submitButton.disabled = true; submitButton.textContent = 'Submitting...';
    errorElement.style.display = 'none';

    try {
        // Get Batch Data (for breweryId and incentive text)
        const batchRef = doc(db, "batches", batchId);
        const batchSnap = await getDoc(batchRef);
        if (!batchSnap.exists()) throw new Error("Target batch not found");
        const batchData = batchSnap.data();
        const breweryId = batchData.breweryId;
        const incentiveText = batchData.incentiveText; // Fetch incentive text here
        if (!breweryId) throw new Error("Brewery ID missing from batch document");

        // Gather Core Feedback Data
        const overallRatingInput = document.getElementById('overall-rating'); // Ensure this ID exists in your HTML
        const commentsInput = document.getElementById('comments');
        // Make sure overall-rating input exists or handle potential error
        if (!overallRatingInput) {
            console.error("Overall rating input element (#overall-rating) not found!");
            throw new Error("Overall rating input element missing from page");
        }


        const feedbackData = {
            batchId: batchId,
            breweryId: breweryId,
            timestamp: serverTimestamp(),
            overallRating: parseInt(overallRatingInput.value, 10), // Ensure ID exists in HTML
            flavorSelections: {},
            ...(commentsInput && commentsInput.value.trim() && { comment: commentsInput.value.trim() }) // Add comment only if exists and provided
        };

        // Loop through defined categories/descriptors to get dynamic ratings
        for (const categoryId in flavorCategories) {
            if (flavorCategories.hasOwnProperty(categoryId)) {
                feedbackData.flavorSelections[categoryId] = {}; // Initialize category map
                flavorCategories[categoryId].descriptors.forEach(desc => {
                    const inputId = `rating-${categoryId}-${desc.id}`;
                    const inputElement = document.getElementById(inputId);
                    if (inputElement) {
                        // Ensure value is parsed correctly as an integer
                        feedbackData.flavorSelections[categoryId][desc.id] = parseInt(inputElement.value, 10);
                    } else {
                        console.warn(`Input element not found for ID: ${inputId} during submission`);
                    }
                });
            }
        }

        console.log("Formatted Feedback Data:", JSON.stringify(feedbackData, null, 2));

        // Write to Firestore
        const docRef = await addDoc(collection(db, "feedback"), feedbackData);
        console.log("Feedback submitted successfully with ID: ", docRef.id);

        // Update UI
        feedbackFormContainer.style.display = 'none';
        if (incentiveText) { // Use the fetched incentive text
             incentiveTextElement.textContent = incentiveText;
        } else {
             incentiveTextElement.textContent = ''; // Clear if no incentive
        }
        thankYouMessage.style.display = 'block';

    } catch (error) {
        console.error("Error submitting feedback:", error);
        errorElement.textContent = `Error submitting feedback: ${error.message}`;
        errorElement.style.display = 'block';
        submitButton.disabled = false; // Re-enable button on error
        submitButton.textContent = 'Submit Feedback';
    }
}


// --- Main Initialization Function for Feedback Page ---
async function initFeedback() {
    console.log("Initializing feedback page...");
    const batchNameElement = document.getElementById('batch-name-display');
    const brewersNotesElement = document.getElementById('brewers-notes-display');
    const feedbackButton = document.getElementById('submit-feedback');
    const errorElement = document.getElementById('error-message');
    const feedbackFormContainer = document.getElementById('feedback-form-container');
    const thankYouMessage = document.getElementById('thank-you-message');

    if (!batchNameElement || !brewersNotesElement || !feedbackButton || !errorElement || !feedbackFormContainer || !thankYouMessage) {
        console.error("initFeedback: Critical elements missing from feedback page HTML.");
        if (errorElement) { errorElement.textContent = "Page Initialization Error."; errorElement.style.display = 'block'; }
        return;
    }

    thankYouMessage.style.display = 'none'; // Hide initially

    const urlParams = new URLSearchParams(window.location.search);
    const batchId = urlParams.get('batchId');

    if (!batchId) {
        errorElement.textContent = "Error: No batch ID provided in URL."; errorElement.style.display = 'block';
        feedbackFormContainer.style.display = 'none'; // Hide form if no batch ID
        return;
    }

    feedbackFormContainer.style.display = 'block'; // Show form container
    errorElement.style.display = 'none'; // Hide error initially

    try {
        batchNameElement.textContent = 'Loading batch info...';
        brewersNotesElement.innerHTML = ''; // Clear previous notes
        brewersNotesElement.style.display = 'none'; // Hide notes container initially

        // Fetch batch details
        const batchDetails = await getBatchDetails(batchId);

        // Display Batch Name
        batchNameElement.textContent = `Feedback for: ${batchDetails.batchName || 'Unknown Batch'}`;

        // Display Brewer's Notes (if provided)
        if (batchDetails.brewersNotes?.trim()) {
            // Basic sanitization - consider a more robust library if needed
            const sanitizedNotes = batchDetails.brewersNotes
                                    .replace(/</g, "<") // Use HTML entities
                                    .replace(/>/g, ">")
                                    .replace(/\n/g, '<br>');
            brewersNotesElement.innerHTML = `<h4>Brewer's Notes:</h4><p>${sanitizedNotes}</p>`;
            brewersNotesElement.style.display = 'block'; // Show notes only if they exist
        }

        // Build dynamic form elements (NOW includes anchor labels)
        buildFlavorInputs();

        // Setup slider value displays (Should work fine with new structure)
        setupSliderValueDisplay();

        // Attach submit listener using the fetched batchId
        feedbackButton.addEventListener('click', () => submitFeedback(batchId));

        console.log("Feedback page initialized successfully for batch:", batchId);

    } catch (error) {
        console.error("Error initializing feedback page:", error);
        errorElement.textContent = `Error: ${error.message || "Could not load batch details."}`;
        errorElement.style.display = 'block';
        feedbackFormContainer.style.display = 'none'; // Hide form on error
    }
}

// --- Event Listener to Start Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Feedback form DOMContentLoaded.");
    initFeedback();
});