// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

try {
  admin.initializeApp();
} catch (e) {
  // console.log("Admin SDK already initialized.");
}
const db = admin.firestore();

// --- Configuration Data (MUST MATCH survey-content.js on client) ---
const SURVEY_CONTENT_MAP = {
  metrics: {
    clarity: { scaleLabels: ["Very Hazy", "Hazy", "Slight Haze", "Clear", "Crystal Clear"], funnyAnswer: "Visibility zero, captain!" },
    color: { scaleLabels: ["Pale Straw / Very Light", "Gold", "Amber / Copper", "Brown / Dark", "Black / Very Dark"] },
    head_retention: { scaleLabels: ["Poor (None / Fades Instantly)", "Fair (Thin / Fades Quickly)", "Good (Moderate / Lasts a bit)", "Very Good (Lasts Minutes)", "Excellent (Thick & Persistent)"], funnyAnswer: "My foam has abandonment issues" },
    hop_intensity: { scaleLabels: ["Subtle / Barely There", "Noticeable", "Moderate", "Strong / Assertive", "Intense / Pungent"], funnyAnswer: "The hops are using a megaphone" },
    malt_sweetness: { scaleLabels: ["None / Very Low", "Low / Hint of Sweetness", "Moderate Sweetness", "Noticeably Sweet", "High / Rich Sweetness"], funnyAnswer: "Smells like cookies are nearby..." },
    hop_bitterness: { scaleLabels: ["Very Low", "Low / Mildly Bitter", "Moderately Bitter", "Notably Bitter", "Very Bitter / Intense"], funnyAnswer: "Bitter enough to write a novel" },
    malt_flavor: { scaleLabels: ["Weak / Watery", "Subtle / Light Malt", "Moderate / Balanced Malt", "Strong / Malt-Forward", "Very Strong / Rich Malt"], funnyAnswer: "Tastes like my cereal's sophisticated cousin" },
    balance: { scaleLabels: ["Unbalanced (Sweet Dominant)", "Leans Sweet", "Well-Balanced", "Leans Bitter", "Unbalanced (Bitter Dominant)"], funnyAnswer: "These flavors need couples therapy" },
    body: { scaleLabels: ["Light / Watery", "Light-Medium", "Medium", "Medium-Full", "Full / Heavy"], funnyAnswer: "Has the weight of a fluffy cloud" },
    carbonation: { scaleLabels: ["Flat / Still", "Low / Soft Fizz", "Medium / Moderate Fizz", "Lively / High Fizz", "Very High / Effervescent"], funnyAnswer: "Party time for the bubbles!" },
  },
  // Custom section removed - custom questions are scored separately if needed, but not here.
};

// --- BJCP Inspired Weights (Unchanged) ---
const BJCP_WEIGHTS = {
  appearance: 3,
  aroma: 12,
  flavor: 20,
  mouthfeel: 5,
  overall: 10,
};

/**
 * Maps a standard selected answer text to a 1-5 score.
 * Returns null for funny answers or if mapping fails.
 * IMPORTANT: This function is now ONLY for STANDARD questions.
 */
function getScoreFromStandardAnswer(metricValue, selectedAnswer) {
  const metricInfo = SURVEY_CONTENT_MAP.metrics[metricValue];
  if (!metricInfo || !metricInfo.scaleLabels) {
    console.warn(`No scaleLabels found for standard metric: ${metricValue}`);
    return null;
  }

  const optionsSource = metricInfo.scaleLabels;
  const funnyAnswerText = metricInfo.funnyAnswer; // May be undefined (e.g., for color)

  // Check if it's the funny answer (only if funnyAnswerText is defined)
  if (funnyAnswerText && selectedAnswer === funnyAnswerText) {
    // console.log(`Ignoring funny answer for ${metricValue}: "${selectedAnswer}"`);
    return null;
  }

  const index = optionsSource.indexOf(selectedAnswer);

  if (index !== -1) {
    return index + 1; // Return 1-5 score
  } else {
    // Answer text didn't match any standard or funny label
    if (selectedAnswer != null) { // Don't warn for explicitly null/undefined answers
        console.warn(`Selected answer "${selectedAnswer}" not found in standard options for metric: ${metricValue}`);
    }
    return null;
  }
}


// --- Cloud Function Definition ---
exports.calculateFeedbackScore = functions.firestore
    .document("feedback/{feedbackId}")
    .onCreate(async (snap, context) => {
      const feedbackId = context.params.feedbackId;
      const feedbackData = snap.data();
      const feedbackRef = snap.ref;

      console.log(`Processing feedback ID: ${feedbackId}`);

      // Ensure ratings array exists
      const ratings = feedbackData?.ratings;
      if (!Array.isArray(ratings)) {
         console.error("Feedback data missing or 'ratings' is not an array.");
         // Optionally update doc with error status?
         // await feedbackRef.update({ scoreCalculationStatus: 'error_no_ratings' });
         return null;
      }


      const categoryScores = {
        appearance: {sum: 0, count: 0},
        aroma: {sum: 0, count: 0},
        flavor: {sum: 0, count: 0},
        mouthfeel: {sum: 0, count: 0},
      };

      // 1. Calculate scores ONLY for STANDARD metrics
      ratings.forEach((rating) => {
        // Skip custom questions for score calculation
        if (rating.isCustom === true) {
          // console.log(`Skipping custom question ${rating.questionId} for scoring.`);
          return;
        }

        // We expect standard questions to have `metricValue` and `selectedAnswer` (text)
        const { category, metricValue, selectedAnswer } = rating;

        // Check if essential data is present for standard question scoring
        if (!category || !metricValue || selectedAnswer === undefined) {
             console.warn(`Skipping standard rating due to missing data: category=${category}, metricValue=${metricValue}, selectedAnswer=${selectedAnswer}`);
             return;
         }


        const score = getScoreFromStandardAnswer(metricValue, selectedAnswer);

        if (score !== null) {
          if (categoryScores[category]) {
            categoryScores[category].sum += score;
            categoryScores[category].count++;
          } else {
            // Handles cases where category might be 'unknown_standard' or missing
            console.warn(`Unknown or missing category for standard metric: ${category} (metric: ${metricValue})`);
          }
        }
      });

      // 2. Calculate average score per category (scale 1-5)
      const categoryAverages = {};
      for (const category in categoryScores) {
        const {sum, count} = categoryScores[category];
        // Ensure count > 0 to avoid division by zero
        categoryAverages[category] = count > 0 ? sum / count : 0;
      }

      // 3. Scale category averages to BJCP max points
      const scaledCategoryScores = {};
      let standardQuestionsScoreTotal = 0; // Score from standard Qs only
      for (const category in categoryAverages) {
        const average = categoryAverages[category];
        const weight = BJCP_WEIGHTS[category]; // Use category name directly
        if (weight) {
          // Only calculate if there were valid answers for this category
          const scaledScore = categoryAverages[category] > 0 ? (average / 5) * weight : 0;
          scaledCategoryScores[category] = parseFloat(scaledScore.toFixed(2));
          standardQuestionsScoreTotal += scaledScore;
        } else {
             // This shouldn't happen if BJCP_WEIGHTS covers all keys in categoryScores
             console.warn(`No BJCP weight found for category: ${category}`);
        }
      }

      // 4. Scale Overall Enjoyment score
      let scaledOverallScore = 0;
      const overallEnjoyment = feedbackData.overallEnjoyment; // Should be 1-5
      if (overallEnjoyment && overallEnjoyment >= 1 && overallEnjoyment <= 5) {
        scaledOverallScore = (overallEnjoyment / 5) * BJCP_WEIGHTS.overall;
        scaledOverallScore = parseFloat(scaledOverallScore.toFixed(2));
        scaledCategoryScores['overall'] = scaledOverallScore; // Store scaled overall score
      } else {
        console.warn(`Overall enjoyment score missing or invalid: ${overallEnjoyment}. Assigning 0.`);
        scaledCategoryScores['overall'] = 0; // Assign 0 if missing/invalid
      }

       // 5. Calculate final total score (Standard Questions + Overall Enjoyment)
       let totalScore = standardQuestionsScoreTotal + scaledOverallScore;
       totalScore = parseFloat(totalScore.toFixed(2));


      console.log(`Calculated Scores for ${feedbackId}:`);
      console.log(" - Scaled Category Scores (including overall):", scaledCategoryScores);
      console.log(" - Total Score (/50):", totalScore);

      // 6. Update the Firestore document
      try {
        await feedbackRef.update({
          calculatedScore: totalScore, // The final score out of 50
          scaledCategoryScores: scaledCategoryScores, // Breakdown by category
          scoreCalculationTimestamp: admin.firestore.FieldValue.serverTimestamp(),
          scoreCalculationStatus: 'success', // Add status field
        });
        console.log(`Successfully updated feedback ${feedbackId} with scores.`);
      } catch (error) {
        console.error(`Failed to update feedback ${feedbackId} with scores:`, error);
         // Optionally update doc with error status?
         // await feedbackRef.update({ scoreCalculationStatus: 'error_update_failed' });
      }

      return null; // Indicate function completion
    });