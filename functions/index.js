// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

// Triggered when a new user is created in Firebase Auth
exports.createUserRecord = functions.auth.user().onCreate((user) => {
    const userRecord = {
        email: user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    return db.collection('breweries').doc(user.uid).set(userRecord)
        .then(() => {
            console.log(`Created brewery record for user: ${user.uid}`);
            return null;
        })
        .catch((error) => {
            console.error("Error creating brewery record:", error);
            return null;
        });
});

// Create a new batch (minimal)
exports.createBatchMinimal = functions.https.onCall((data, context) => {
    // Check if the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'The function must be called while authenticated.'
        );
    }
    
    const breweryId = context.auth.uid;
    const batchName = data.batchName;
    
    // Validate input
    if (!batchName || typeof batchName !== 'string') {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The function must be called with a valid batch name.'
        );
    }
    
    // Create the batch document
    const batchData = {
        breweryId: breweryId,
        batchName: batchName,
        creationDate: admin.firestore.FieldValue.serverTimestamp()
    };
    
    return db.collection('batches').add(batchData)
        .then((docRef) => {
            console.log(`Created batch with ID: ${docRef.id}`);
            
            // Update with feedbackUrl
            const feedbackUrl = `https://www.brewmetrics.xyz/feedback/?batchId=${docRef.id}`;
            return docRef.update({ feedbackUrl: feedbackUrl })
                .then(() => {
                    return { batchId: docRef.id, feedbackUrl: feedbackUrl };
                });
        })
        .catch((error) => {
            console.error("Error creating batch:", error);
            throw new functions.https.HttpsError('internal', 'Failed to create batch');
        });
});

// List batches for the authenticated brewery (minimal)
exports.listBatchesMinimal = functions.https.onCall((data, context) => {
    // Check if the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'The function must be called while authenticated.'
        );
    }
    
    const breweryId = context.auth.uid;
    
    return db.collection('batches')
        .where('breweryId', '==', breweryId)
        .get()
        .then((snapshot) => {
            const batches = [];
            snapshot.forEach((doc) => {
                batches.push({
                    batchId: doc.id,
                    batchName: doc.data().batchName,
                    creationDate: doc.data().creationDate,
                    feedbackUrl: doc.data().feedbackUrl || null
                });
            });
            return { batches };
        })
        .catch((error) => {
            console.error("Error listing batches:", error);
            throw new functions.https.HttpsError('internal', 'Failed to list batches');
        });
});

// Get batch name (public)
exports.getBatchNamePublic = functions.https.onRequest((req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }
    
    // Get batch ID from request
    const batchId = req.query.batchId;
    
    if (!batchId) {
        res.status(400).json({ error: 'Batch ID is required' });
        return;
    }
    
    return db.collection('batches').doc(batchId).get()
        .then((doc) => {
            if (!doc.exists) {
                res.status(404).json({ error: 'Batch not found' });
                return;
            }
            
            res.status(200).json({ batchName: doc.data().batchName });
        })
        .catch((error) => {
            console.error("Error getting batch name:", error);
            res.status(500).json({ error: 'Failed to get batch name' });
        });
});

// Submit feedback (minimal)
exports.submitFeedbackMinimal = functions.https.onRequest((req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).send('');
        return;
    }
    
    // Check that this is a POST request
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    // Get batch ID from request body
    const batchId = req.body.batchId;
    
    if (!batchId) {
        res.status(400).json({ error: 'Batch ID is required' });
        return;
    }
    
    // Get the batch document to include the breweryId
    return db.collection('batches').doc(batchId).get()
        .then((doc) => {
            if (!doc.exists) {
                res.status(404).json({ error: 'Batch not found' });
                return;
            }
            
            const breweryId = doc.data().breweryId;
            
            // Create feedback document
            const feedbackData = {
                batchId: batchId,
                breweryId: breweryId,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };
            
            return db.collection('feedback').add(feedbackData)
                .then((docRef) => {
                    console.log(`Created feedback with ID: ${docRef.id}`);
                    res.status(200).json({ feedbackId: docRef.id });
                })
                .catch((error) => {
                    console.error("Error creating feedback:", error);
                    res.status(500).json({ error: 'Failed to create feedback' });
                });
        })
        .catch((error) => {
            console.error("Error getting batch:", error);
            res.status(500).json({ error: 'Failed to process feedback' });
        });
});

// Get feedback count for a batch
exports.getFeedbackCount = functions.https.onCall((data, context) => {
    // Check if the user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'The function must be called while authenticated.'
        );
    }
    
    const batchId = data.batchId;
    
    if (!batchId) {
        throw new functions.https.HttpsError(
            'invalid-argument', 
            'The function must be called with a valid batch ID.'
        );
    }
    
    // First check if this batch belongs to the authenticated brewery
    return db.collection('batches').doc(batchId).get()
        .then((doc) => {
            if (!doc.exists) {
                throw new functions.https.HttpsError(
                    'not-found', 
                    'Batch not found'
                );
            }
            
            if (doc.data().breweryId !== context.auth.uid) {
                throw new functions.https.HttpsError(
                    'permission-denied', 
                    'Not authorized to access this batch'
                );
            }
            
            // Count feedback documents for this batch
            return db.collection('feedback')
                .where('batchId', '==', batchId)
                .get()
                .then((snapshot) => {
                    return { count: snapshot.size };
                });
        })
        .catch((error) => {
            console.error("Error getting feedback count:", error);
            throw new functions.https.HttpsError('internal', 'Failed to get feedback count');
        });
});