// public/assets/js/feedback-form.js
import { db } from './firebase-config.js';
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { SURVEY_CONTENT } from './survey-content.js';

// --- DOM Elements ---
const loadingIndicator = document.getElementById('loading-indicator');
const errorArea = document.getElementById('error-area');
const surveyArea = document.getElementById('interactive-survey-area');
const submissionFeedbackArea = document.getElementById('submission-feedback');
const progressBar = document.getElementById('progress-bar');

// --- Global State ---
let currentBatchData = null;
let currentBreweryData = null; // To store fun facts
let surveySteps = []; // Array of step objects: { type: 'intro'|'standard'|'custom'|'overall'|'thanks', ...data }
let currentStepIndex = 0;
// Stores { metricKey: "answer text", customQId: numericScore, overallEnjoyment: score, comment: "text" }
let collectedAnswers = {};
// No longer need currentQuestionId globally, pass as needed

// --- Constants ---
const COLOR_PALETTE = [ // Define colors for the palette UI
    { name: "Pale Straw / Very Light", value: "#FFF9C4", mapToScore: 1 }, // ~Pantone 100 C
    { name: "Gold", value: "#FFECB3", mapToScore: 2 }, // ~Pantone 7401 C
    { name: "Amber / Copper", value: "#FFC107", mapToScore: 3 }, // ~Pantone 123 C
    { name: "Brown / Dark", value: "#8D6E63", mapToScore: 4 }, // ~Pantone 4635 C
    { name: "Black / Very Dark", value: "#3E2723", mapToScore: 5 }, // ~Pantone Black 4 C
];

// --- Helper Functions ---
function displayError(message) { /* ... (same as before) ... */ console.error("Feedback Form Error:", message); if (loadingIndicator) loadingIndicator.style.display = 'none'; if (surveyArea) surveyArea.style.display = 'none'; if (errorArea) { errorArea.textContent = `Error: ${message}`; errorArea.style.display = 'block'; } }
function hideError() { /* ... (same as before) ... */ if (errorArea) errorArea.style.display = 'none'; }
function displaySubmissionFeedback(success, message, incentiveText = null) { /* ... (same as before) ... */ if (!submissionFeedbackArea) return; submissionFeedbackArea.className = success ? 'success' : 'error'; let htmlContent = `<p>${message}</p>`; if (success && incentiveText?.trim()) { htmlContent += `<p class="incentive-text">${incentiveText}</p>`; } submissionFeedbackArea.innerHTML = htmlContent; submissionFeedbackArea.style.display = 'block'; if (surveyArea) surveyArea.style.display = 'none'; const progressContainer = document.getElementById('progress-bar-container'); if(progressContainer) progressContainer.style.display = 'none'; submissionFeedbackArea.scrollIntoView({ behavior: 'smooth' }); }
function hideSubmissionFeedback() { /* ... (same as before) ... */ if (submissionFeedbackArea) { submissionFeedbackArea.style.display = 'none'; submissionFeedbackArea.innerHTML = ''; } }
function debounce(func, wait) { /* ... (same as before) ... */ let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }

/** Selects a random fun fact */
function getRandomFunFact() {
    if (!currentBreweryData?.funFacts || currentBreweryData.funFacts.length === 0) {
        return "Beer is one of the world's oldest prepared beverages!"; // Default fact
    }
    const randomIndex = Math.floor(Math.random() * currentBreweryData.funFacts.length);
    return currentBreweryData.funFacts[randomIndex];
}

/** Updates the progress bar */
function updateProgressBar() {
    if (!progressBar) return;
    // Calculate progress based on steps excluding intro and thanks
    const totalProgressSteps = surveySteps.length - 2; // Exclude intro & thanks
    const currentProgressStep = Math.max(0, currentStepIndex - 1); // Current step adjusted for 0-based index and intro
    let progress = 0;
    if (totalProgressSteps > 0) {
        progress = Math.round((currentProgressStep / totalProgressSteps) * 100);
    }
    // Ensure progress doesn't exceed 100 in final step
    if (currentStepIndex === surveySteps.length - 1) { // 'thanks' step conceptually
         progress = 100;
    } else if (surveySteps[currentStepIndex]?.type === 'overall') {
         // Show nearly complete on the overall step before submission
         progress = Math.min(98, progress);
    }


    progressBar.style.width = `${progress}%`;
    // console.log(`Progress: Step ${currentStepIndex}/${surveySteps.length}, Bar: ${progress}%`);
}

// --- Step Rendering Logic ---

/** Creates the HTML for the common step header (Icon & Fun Fact) */
function createStepHeaderHTML() {
    const iconUrl = currentBatchData?.batchLabelIconUrl || '/assets/images/default-batch-icon.png'; // Use default if missing
    const funFact = getRandomFunFact();
    return `
        <div class="step-header">
            <div class="batch-icon-container">
                <img src="${iconUrl}" alt="Batch Icon" id="batch-icon">
            </div>
            <div class="fun-fact-container">
                <strong>Fun Fact!</strong>
                <span id="fun-fact-text">${funFact}</span>
            </div>
        </div>`;
}

/** Creates the HTML for the Introduction Step */
function createIntroStepHTML(batchData) {
    // ... (keep previous implementation)
    const meta = [batchData.style, batchData.abv ? `${batchData.abv}% ABV` : null, batchData.ibu ? `${batchData.ibu} IBU` : null].filter(Boolean).join(' · ');
    const notesHTML = batchData.brewersNotes ? `<p><strong>Brewer's Notes:</strong> ${batchData.brewersNotes}</p>` : '';
    const introHTML = batchData.batchIntroductionText ? `<p>${batchData.batchIntroductionText}</p>` : '';
    const hasIntroContent = notesHTML || introHTML;
    return `
        <div class="survey-step intro-step">
            <header class="batch-header">
                <h2>${batchData.batchName || 'Feedback Time!'}</h2>
                <p class="batch-meta">${meta}</p>
            </header>
            ${hasIntroContent ? `<div class="intro-text">${notesHTML}${introHTML}</div>` : ''}
            <p>Ready to taste? We'll guide you through a few questions to get your thoughts.</p>
            <div class="navigation">
                <button id="start-survey-btn" class="btn btn-primary btn-lg">
                    <span class="btn-content">Let's Taste!</span>
                </button>
            </div>
        </div>`;
}

/** Creates the HTML for a Question Step (Standard or Custom) */
function createQuestionStepHTML(stepData) {
    const headerHTML = createStepHeaderHTML();
    let questionHTML = '';
    let tipHTML = '';
    let optionsHTML = '';
    let isCustomQ = stepData.type === 'custom';
    let questionId = isCustomQ ? stepData.questionId : stepData.metricKey; // Use metricKey as ID for standard Qs

    if (isCustomQ) {
        questionHTML = `<h3 class="question-text">${stepData.questionText}</h3>`;
        tipHTML = `<div class="question-tip">Please rate the statement above (1=Strongly Disagree, 5=Strongly Agree).</div>`; // Simple tip for custom Q
        // Render 1-5 rating scale for custom questions
        optionsHTML = '<div class="rating-scale" data-question-type="custom">';
        for (let i = 1; i <= 5; i++) {
            optionsHTML += `
                <label>
                    <input type="radio" name="rating-${questionId}" value="${i}" required>
                    <span class="rating-value">${i}</span>
                    <span class="rating-label-text">${i===1 ? 'Low' : i===5 ? 'High' : ''}</span> <!-- Simple labels -->
                </label>`;
        }
        optionsHTML += '</div>';
    } else { // Standard Question
        const metricKey = stepData.metricKey;
        const content = SURVEY_CONTENT.metrics[metricKey];
        if (!content) {
            console.error(`Content missing for standard metric: ${metricKey}`);
            return `<div class="survey-step error-message">Error: Question content missing.</div>`;
        }
        questionHTML = `<h3 class="question-text">${content.questionText}</h3>`;
        tipHTML = `<div class="question-tip">${content.tip}</div>`;

        // Special UI for Color Palette
        if (metricKey === 'color') {
            optionsHTML = '<div class="color-palette" data-question-type="standard">';
            COLOR_PALETTE.forEach(color => {
                 // Store the scale label corresponding to the score for saving data
                const scaleLabel = content.scaleLabels[color.mapToScore - 1];
                optionsHTML += `
                    <div class="color-swatch"
                         style="background-color: ${color.value};"
                         data-color-name="${color.name}"
                         data-answer-value="${scaleLabel}"
                         title="${color.name}">
                    </div>`;
            });
            optionsHTML += '</div>';
        } else { // Standard MC Buttons
            optionsHTML = '<div class="answer-options" data-question-type="standard">';
            content.scaleLabels.forEach((label) => {
                optionsHTML += `<button type="button" class="answer-btn" data-answer-value="${label}">${label}</button>`;
            });
            if (content.funnyAnswer) {
                optionsHTML += `<button type="button" class="answer-btn funny-answer" data-answer-value="${content.funnyAnswer}">${content.funnyAnswer}</button>`;
            }
            optionsHTML += '</div>';
        }
    }

    return `
        <div class="survey-step question-step" data-question-id="${questionId}" data-question-is-custom="${isCustomQ}">
            ${headerHTML}
            <div class="question-content">
                ${questionHTML}
                ${tipHTML}
                ${optionsHTML}
            </div>
            <div class="navigation">
                 <!-- Automatic advance, no next button needed -->
            </div>
        </div>`;
}

/** Creates the HTML for the Overall Feedback Step */
function createOverallStepHTML() {
     // ... (keep previous implementation, but add header)
    const headerHTML = createStepHeaderHTML();
    const content = SURVEY_CONTENT.overallStep;
    let enjoymentScaleHTML = '<div class="enjoyment-scale" id="overall-enjoyment-scale">';
    content.enjoymentScaleLabels.forEach((label, index) => {
        const value = index + 1;
        enjoymentScaleHTML += `
            <label>
                <input type="radio" name="overall-enjoyment" value="${value}" required>
                <span class="rating-value">${value}</span>
                <span class="rating-label-text">${label}</span>
            </label>`;
    });
    enjoymentScaleHTML += '</div>';

    return `
        <div class="survey-step overall-step">
             ${headerHTML}
            <h3>Final Thoughts</h3>
            <div class="form-group">
                <label for="overall-enjoyment">${content.enjoymentLabel}</label>
                ${enjoymentScaleHTML}
            </div>
            <div class="form-group">
                <label for="feedback-comment">${content.commentLabel}</label>
                <textarea id="feedback-comment" name="feedback-comment" rows="5" placeholder="${content.commentPlaceholder}"></textarea>
            </div>
            <div class="navigation">
                <button id="finish-survey-btn" class="btn btn-primary btn-lg" disabled>
                    <span class="btn-content">${content.finishButtonText}</span>
                </button>
            </div>
        </div>`;
}


// --- Core Display Logic ---
function displayStep(index) {
    console.log(`Attempting to display step index: ${index}`);
    if (!Array.isArray(surveySteps) || index < 0 || index >= surveySteps.length) {
         console.error("Invalid step index or surveySteps not initialized:", index, surveySteps);
         displayError("Survey navigation error."); // Display error to user
         return;
     }
    currentStepIndex = index;
    const stepData = surveySteps[index];
    let stepHTML = '';
    console.log("Step data:", stepData);

    updateProgressBar(); // Update progress bar for the new step

    const existingSteps = surveyArea.querySelectorAll('.survey-step');
    existingSteps.forEach(step => step.classList.remove('active'));

    if (!stepData) { // Added check for undefined stepData
        console.error(`Step data is undefined for index: ${index}`);
        displayError("Survey content error.");
        return;
    }

    if (stepData.type === 'intro') {
        stepHTML = createIntroStepHTML(currentBatchData);
    } else if (stepData.type === 'overall') {
        stepHTML = createOverallStepHTML();
    } else if (stepData.type === 'thanks') {
        console.log("Reached 'thanks' step marker. Submission handles display.");
        return;
    } else if (stepData.type === 'standard' || stepData.type === 'custom') {
        stepHTML = createQuestionStepHTML(stepData);
    } else {
        console.error("Unknown step type:", stepData.type);
        displayError("An internal error occurred.");
        return;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = stepHTML;
    const newStepElement = tempDiv.firstElementChild;

    if (!newStepElement || newStepElement.classList.contains('error-message')) {
        console.error("Failed to create valid step element from HTML or content missing.");
        if (!newStepElement) displayError("Failed to render survey step.");
        else surveyArea.appendChild(newStepElement); // Append error message step if generated
        return;
    }

    surveyArea.appendChild(newStepElement);
    console.log("Appended new step element.");

    setTimeout(() => {
        newStepElement.classList.add('active');
        console.log("Activated new step element.");
    }, 50);

    addStepEventListeners(newStepElement, stepData);

    setTimeout(() => {
        const oldSteps = surveyArea.querySelectorAll('.survey-step:not(.active)');
        oldSteps.forEach(step => step.remove());
    }, 500);
}

/** Debounced version of advancing to the next step */
const debouncedNextStep = debounce(() => {
    displayStep(currentStepIndex + 1);
}, 450); // Slightly longer delay for visual feedback

/** Adds event listeners for controls within the current step */
function addStepEventListeners(stepElement, stepData) {
    if (stepData.type === 'intro') {
        const startButton = stepElement.querySelector('#start-survey-btn');
        if (startButton) startButton.onclick = () => displayStep(currentStepIndex + 1);
    } else if (stepData.type === 'overall') {
        // ... (keep previous implementation for overall step)
         const finishButton = stepElement.querySelector('#finish-survey-btn');
         const enjoymentRadios = stepElement.querySelectorAll('input[name="overall-enjoyment"]');

         function checkOverallCompletion() {
             const enjoymentSelected = stepElement.querySelector('input[name="overall-enjoyment"]:checked');
             if (finishButton) finishButton.disabled = !enjoymentSelected;
         }

         enjoymentRadios.forEach(radio => {
             radio.onchange = () => {
                  collectedAnswers['overallEnjoyment'] = parseInt(radio.value, 10);
                  console.log("Collected Answers:", collectedAnswers);
                  checkOverallCompletion();
              };
         });

         if (finishButton) {
             finishButton.onclick = submitFeedback;
             checkOverallCompletion(); // Initial check
         }

    } else if (stepData.type === 'standard') {
        const metricKey = stepData.metricKey;
        if (metricKey === 'color') { // Handle Color Palette
            const swatches = stepElement.querySelectorAll('.color-swatch');
            swatches.forEach(swatch => {
                swatch.onclick = () => {
                    const selectedValue = swatch.dataset.answerValue; // Get the scale label
                    collectedAnswers[metricKey] = selectedValue;
                    console.log("Collected Answers:", collectedAnswers);
                    swatches.forEach(s => s.classList.remove('selected'));
                    swatch.classList.add('selected');
                    debouncedNextStep();
                };
            });
        } else { // Handle Standard MC Buttons
            const answerButtons = stepElement.querySelectorAll('.answer-btn');
            answerButtons.forEach(button => {
                button.onclick = () => {
                    const selectedValue = button.dataset.answerValue;
                    collectedAnswers[metricKey] = selectedValue; // Store the text label
                    console.log("Collected Answers:", collectedAnswers);
                    answerButtons.forEach(btn => btn.classList.remove('selected'));
                    button.classList.add('selected');
                    debouncedNextStep();
                };
            });
        }
    } else if (stepData.type === 'custom') {
        const customQuestionId = stepData.questionId;
        const ratingRadios = stepElement.querySelectorAll(`input[name="rating-${customQuestionId}"]`);
        ratingRadios.forEach(radio => {
            radio.onchange = () => {
                const selectedValue = parseInt(radio.value, 10);
                collectedAnswers[customQuestionId] = selectedValue; // Store the numeric score
                console.log("Collected Answers:", collectedAnswers);
                // Optional: Add visual feedback to selected radio label maybe?
                debouncedNextStep();
            };
        });
    }
}

// --- Submission Logic ---
async function submitFeedback() {
    console.log("Attempting to submit feedback...");
    const overallStepElement = surveyArea.querySelector('.overall-step');
    const finishButton = overallStepElement?.querySelector('#finish-survey-btn');
    const commentElement = overallStepElement?.querySelector('#feedback-comment');

    // Add comment to collected answers just before submission
    collectedAnswers['comment'] = commentElement?.value?.trim() || null;

    if (finishButton) { /* ... (disable button logic - keep) ... */ finishButton.disabled = true; const span = finishButton.querySelector('.btn-content'); if(span) span.textContent = 'Submitting...'; }

    try {
        const feedbackData = {
            batchId: currentBatchData.id,
            breweryId: currentBatchData.breweryId,
            timestamp: serverTimestamp(),
            ratings: [], // Will hold both standard (text) and custom (numeric) answers
            overallEnjoyment: collectedAnswers['overallEnjoyment'] || null,
            comment: collectedAnswers['comment'],
        };

        // Process collected answers
        for (const answerKey in collectedAnswers) {
            if (answerKey === 'overallEnjoyment' || answerKey === 'comment') continue;

            const answerValue = collectedAnswers[answerKey];

            // Find if it's a standard metric or a custom question
            let isCustom = false;
            let questionConfig = currentBatchData.customQuestions?.find(q => q.questionId === answerKey);
            let standardMetricContent = null;
            let category = '';
            let descriptor = '';
            let metricValue = null; // Store original metric key for standard q's

            if (questionConfig) { // It's a custom question
                isCustom = true;
                category = 'custom'; // Or assign brewer-defined category if available later
                descriptor = questionConfig.questionText;
            } else if (SURVEY_CONTENT.metrics[answerKey]) { // It's a standard question (key is metricKey)
                isCustom = false;
                metricValue = answerKey; // e.g., 'clarity'
                standardMetricContent = SURVEY_CONTENT.metrics[answerKey];
                descriptor = standardMetricContent.questionText;
                // Determine category for standard metrics (could improve this mapping)
                if (['clarity', 'color', 'head_retention'].includes(metricValue)) category = 'appearance';
                else if (['hop_intensity', 'malt_sweetness'].includes(metricValue)) category = 'aroma';
                else if (['hop_bitterness', 'malt_flavor', 'balance'].includes(metricValue)) category = 'flavor';
                else if (['body', 'carbonation'].includes(metricValue)) category = 'mouthfeel';
                else category = 'unknown_standard'; // Fallback category
            } else {
                console.warn(`Answer key "${answerKey}" not found in standard metrics or custom questions.`);
                continue; // Skip unknown answers
            }

            feedbackData.ratings.push({
                questionId: answerKey, // Use metricKey or customQuestionId as the identifier
                category: category,
                descriptor: descriptor, // Question text
                selectedAnswer: isCustom ? null : answerValue, // Store TEXT answer for standard
                ratingValue: isCustom ? answerValue : null, // Store NUMERIC score for custom
                isCustom: isCustom,
                metricValue: metricValue // Store metric key for standard Qs for scoring function
            });
        }

        if (!feedbackData.comment) delete feedbackData.comment;
        if (feedbackData.overallEnjoyment === null) delete feedbackData.overallEnjoyment;

        console.log("Submitting feedback data:", feedbackData);
        const docRef = await addDoc(collection(db, "feedback"), feedbackData);
        console.log("Feedback submitted successfully with ID:", docRef.id);

        updateProgressBar(); // Set progress to 100% on success
        displaySubmissionFeedback(true, "Thank you for your feedback!", currentBatchData.incentiveText);

    } catch (error) { /* ... (keep error handling) ... */
        console.error("Error submitting feedback:", error);
        displaySubmissionFeedback(false, `Submission failed: ${error.message}`);
        if (finishButton) { finishButton.disabled = false; const span = finishButton.querySelector('.btn-content'); if(span) span.textContent = SURVEY_CONTENT.overallStep.finishButtonText; }
    }
}


// --- Initialization ---
async function fetchBatchData(batchId) { /* ... (keep previous version) ... */
    console.log(`Fetching batch data for ID: ${batchId}`);
    if (!db) { console.error("Firestore database instance (db) is not initialized!"); throw new Error("Database connection failed."); }
    try {
        const batchRef = doc(db, "batches", batchId);
        const batchSnap = await getDoc(batchRef);
        if (!batchSnap.exists()) { console.warn(`Batch document with ID "${batchId}" does not exist.`); throw new Error(`Batch with ID "${batchId}" not found.`); }
        const data = batchSnap.data();
        console.log("Raw batch data fetched:", data);
        if (!data.isActive) { console.warn(`Batch "${batchId}" is inactive.`); throw new Error("This batch is no longer active for feedback."); }
        // Ensure customQuestions is an array, default to empty if missing/null
         if (!data.customQuestions || !Array.isArray(data.customQuestions)) {
             console.warn("customQuestions is missing or not an array, defaulting to empty.");
             data.customQuestions = [];
         }
        // We no longer use surveyConfig for standard questions
        // if (!data.surveyConfig || !Array.isArray(data.surveyConfig)) { data.surveyConfig = []; }
        return { id: batchSnap.id, ...data };
    } catch (error) { console.error("Error inside fetchBatchData:", error); throw error; }
}

async function fetchBreweryData(breweryId) {
    if (!breweryId) {
        console.warn("Brewery ID missing, cannot fetch fun facts.");
        return null;
    }
    console.log(`Fetching brewery data for ID: ${breweryId}`);
    try {
        const breweryRef = doc(db, "breweries", breweryId); // Assuming 'breweries' collection
        const brewerySnap = await getDoc(breweryRef);
        if (!brewerySnap.exists()) {
            console.warn(`Brewery document with ID "${breweryId}" does not exist.`);
            return null;
        }
        const data = brewerySnap.data();
        // Ensure funFacts is an array
        if (!data.funFacts || !Array.isArray(data.funFacts)) {
            data.funFacts = [];
        }
        console.log("Brewery data fetched:", data);
        return data;
    } catch (error) {
        console.error("Error fetching brewery data:", error);
        return null; // Return null on error, don't block survey
    }
}

async function initPage() {
    console.log("initPage started.");
    hideError();
    hideSubmissionFeedback();
    const progressContainer = document.getElementById('progress-bar-container');
    if(progressContainer) progressContainer.style.display = 'block'; // Show progress bar
    if(progressBar) progressBar.style.width = '0%'; // Reset progress bar
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (surveyArea) surveyArea.innerHTML = '';

    const urlParams = new URLSearchParams(window.location.search);
    const batchId = urlParams.get('batchId');
    console.log("Batch ID from URL:", batchId);

    if (!batchId) { displayError("Batch ID missing in URL."); return; }
    if (!surveyArea || !loadingIndicator || !errorArea || !progressBar) { console.error("Essential page structure missing."); displayError("Page structure broken."); return; }

    try {
        console.log("Fetching batch data...");
        currentBatchData = await fetchBatchData(batchId);
        if (!currentBatchData) { displayError("Failed to load batch data."); return; }

        console.log("Fetching brewery data...");
        currentBreweryData = await fetchBreweryData(currentBatchData.breweryId);
        // Proceed even if brewery data fails

        console.log("Building survey steps...");
        surveySteps = [{ type: 'intro' }]; // Start with intro

        // Add standard questions in the defined order
        SURVEY_CONTENT.standardMetricsOrder.forEach(metricKey => {
            if (SURVEY_CONTENT.metrics[metricKey]) { // Ensure metric exists
                 surveySteps.push({ type: 'standard', metricKey: metricKey });
            } else {
                 console.warn(`Standard metric key "${metricKey}" defined in order but not found in SURVEY_CONTENT.metrics.`);
            }
        });

        // Add custom questions (if any)
        if (currentBatchData.customQuestions && currentBatchData.customQuestions.length > 0) {
            currentBatchData.customQuestions.forEach(customQ => {
                // Add the whole custom question object from Firestore
                surveySteps.push({ type: 'custom', ...customQ });
            });
        }

        surveySteps.push({ type: 'overall' });
        surveySteps.push({ type: 'thanks' }); // Marker for end
        console.log("Survey steps built:", surveySteps);

        currentStepIndex = 0;
        collectedAnswers = {};

        if (loadingIndicator) loadingIndicator.style.display = 'none';
        console.log("Displaying first step (index 0)...");
        displayStep(currentStepIndex); // Display intro step
        console.log("initPage completed successfully.");

    } catch (error) {
        console.error("Error during initPage:", error);
        displayError(error.message || "Could not load feedback form.");
    }
}

// --- Run Initialization ---
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initPage); }
else { initPage(); }