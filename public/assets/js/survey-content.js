// public/assets/js/survey-content.js
// Content based on the FINAL "Beer Tasting Survey Design" document (Concise Version)
// ADAPTED: Removed mascots and custom sections, as custom Qs now come from Firestore.

const SURVEY_CONTENT = {
    // Standard metrics remain the source of truth for core questions, text, tips, and scale labels.
    // The order they appear in the survey will be defined in feedback-form.js
    standardMetricsOrder: [ // Define the order standard questions should appear
        // Appearance
        'clarity',
        'color',
        'head_retention',
        // Aroma
        'hop_intensity',
        'malt_sweetness',
        // Flavor
        'hop_bitterness',
        'malt_flavor',
        'balance',
        // Mouthfeel
        'body',
        'carbonation',
    ],

    metrics: {
        // == APPEARANCE ==
        clarity: {
            questionText: "How clear does this beer look?",
            tip: "Hold it to light—hazy or clear?",
            scaleLabels: ["Very Hazy", "Hazy", "Slight Haze", "Clear", "Crystal Clear"],
            funnyAnswer: "Visibility zero, captain!"
        },
        color: {
            questionText: "What color grabs your eye?",
            tip: "From pale straw to jet black, what’s the hue?",
            scaleLabels: ["Pale Straw / Very Light", "Gold", "Amber / Copper", "Brown / Dark", "Black / Very Dark"],
            // UI is palette, no funny answer needed
        },
        head_retention: {
            questionText: "Does the foam stick around?",
            tip: "Does the foam stick around or fade fast?",
            scaleLabels: ["Poor (None / Fades Instantly)", "Fair (Thin / Fades Quickly)", "Good (Moderate / Lasts a bit)", "Very Good (Lasts Minutes)", "Excellent (Thick & Persistent)"],
            funnyAnswer: "My foam has abandonment issues"
        },
        // == AROMA ==
        hop_intensity: {
            questionText: "How strong are the hop smells?",
            tip: "Sniff for floral, citrus, or piney hops—how strong are they?",
            scaleLabels: ["Subtle / Barely There", "Noticeable", "Moderate", "Strong / Assertive", "Intense / Pungent"],
            funnyAnswer: "The hops are using a megaphone"
        },
        malt_sweetness: {
            questionText: "Any sweet, bready, or toasty smells?",
            tip: "Catch any bready or caramel scents?",
            scaleLabels: ["None / Very Low", "Low / Hint of Sweetness", "Moderate Sweetness", "Noticeably Sweet", "High / Rich Sweetness"],
            funnyAnswer: "Smells like cookies are nearby..."
        },
        // == FLAVOR ==
        hop_bitterness: {
            questionText: "How bitter does it taste?",
            tip: "How bitter does it taste on your tongue?",
            scaleLabels: ["Very Low", "Low / Mildly Bitter", "Moderately Bitter", "Notably Bitter", "Very Bitter / Intense"],
            funnyAnswer: "Bitter enough to write a novel"
        },
        malt_flavor: {
            questionText: "What about malt flavors (bread, caramel)?",
            tip: "Taste bread, biscuit, or caramel? How bold is it?",
            scaleLabels: ["Weak / Watery", "Subtle / Light Malt", "Moderate / Balanced Malt", "Strong / Malt-Forward", "Very Strong / Rich Malt"],
            funnyAnswer: "Tastes like my cereal's sophisticated cousin"
        },
        balance: {
            questionText: "Do the flavors play nice together?",
            tip: "Do the flavors play nice together or fight?",
            scaleLabels: ["Unbalanced (Sweet Dominant)", "Leans Sweet", "Well-Balanced", "Leans Bitter", "Unbalanced (Bitter Dominant)"],
            funnyAnswer: "These flavors need couples therapy"
        },
        // == MOUTHFEEL ==
        body: {
            questionText: "How does it feel? Light or heavy?",
            tip: "Feels watery or thick like a stout?",
            scaleLabels: ["Light / Watery", "Light-Medium", "Medium", "Medium-Full", "Full / Heavy"],
            funnyAnswer: "Has the weight of a fluffy cloud"
        },
        carbonation: {
            questionText: "How fizzy does this feel?",
            tip: "Flat or fizzy—how’s the bubble action?",
            scaleLabels: ["Flat / Still", "Low / Soft Fizz", "Medium / Moderate Fizz", "Lively / High Fizz", "Very High / Effervescent"],
            funnyAnswer: "Party time for the bubbles!"
        },
    },

    // --- OVERALL FEEDBACK STEP CONTENT ---
    overallStep: {
        enjoymentLabel: "Overall Enjoyment:",
        enjoymentScaleLabels: ["Did Not Enjoy", "Fair / Had Issues", "Good / Solid Beer", "Very Good / Enjoyed It", "Loved It!"],
        commentLabel: "Comments:",
        commentPlaceholder: "Tell us more—what stood out or could be better?",
        finishButtonText: "Submit My Feedback!"
    }
};

export { SURVEY_CONTENT };