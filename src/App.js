import React, { useState, useEffect, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, updateDoc, getDocs } from 'firebase/firestore';

// Define the Firebase context to pass services to components
const FirebaseContext = createContext(null);

// Tailwind CSS classes for a clean, responsive, and professional look
const tailwindClasses = {
  // Added overflow-x-hidden to prevent horizontal scrolling on mobile devices
  container: "min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 overflow-x-hidden",
  card: "bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full text-center space-y-6",
  heading: "text-3xl font-bold text-gray-800",
  subheading: "text-lg text-gray-600",
  buttonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed",
  buttonSecondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out",
  input: "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500",
  adjectiveGrid: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-4",
  adjectiveButton: "py-2 px-4 rounded-lg border-2 font-medium text-sm transition-all duration-150 ease-in-out",
  adjectiveSelected: "bg-indigo-100 text-indigo-800 border-indigo-400",
  adjectiveUnselected: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
  resultsGrid: "grid grid-cols-1 md:grid-cols-2 gap-4 mt-6",
  quadrant: "p-4 rounded-lg shadow-inner",
  quadrantArena: "bg-green-100 border-green-500",
  quadrantBlindSpot: "bg-yellow-100 border-yellow-500",
  quadrantFacade: "bg-blue-100 border-blue-500",
  quadrantUnknown: "bg-gray-200 border-gray-400",
  quadrantTitle: "font-semibold text-lg",
  quadrantList: "mt-2 text-sm text-gray-700",
  loading: "text-gray-500",
  linkContainer: "bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col space-y-2 text-sm text-gray-700",
  link: "font-mono bg-gray-100 p-2 rounded-md break-all text-sm",
  copyButton: "bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition duration-150 ease-in-out",
  error: "text-red-500 font-medium",
  debugPanel: "bg-gray-800 text-gray-200 p-4 rounded-lg mt-8 text-xs text-left w-full max-w-2xl",
  debugTitle: "font-bold text-sm mb-2",
  debugLog: "font-mono",
};

// A curated list of adjectives for a work-based Johari Window
const adjectivesList = [
  "Adaptable", "Bold", "Calm", "Caring", "Cheerful", "Complex", "Confident", "Courageous",
  "Dependable", "Dignified", "Energetic", "Extroverted", "Friendly", "Generous", "Happy",
  "Idealistic", "Independent", "Ingenious", "Intelligent", "Introverted", "Kind", "Knowledgeable",
  "Logical", "Loving", "Mature", "Motivated", "Nervous", "Organized", "Patient", "Powerful",
  "Quiet", "Relaxed", "Reliable", "Responsive", "Searching", "Self-conscious", "Sensible", "Sentimental",
  "Shy", "Silly", "Spontaneous", "Sympathetic", "Tense", "Trustworthy", "Wise"
];

// Helper function to create a unique ID for a new window
const generateUniqueId = () => {
  return crypto.randomUUID();
};

// Main App component
export default function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [creatorId, setCreatorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [windowId, setWindowId] = useState(null);
  const [isSelfAssessment, setIsSelfAssessment] = useState(false);
  const [selectedAdjectives, setSelectedAdjectives] = useState([]);
  const [results, setResults] = useState(null);
  const [page, setPage] = useState('start');
  const [shareLink, setShareLink] = useState('');
  const [debugInfo, setDebugInfo] = useState({});
  const [hasSubmittedSelfAssessment, setHasSubmittedSelfAssessment] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [teammateResponseCount, setTeammateResponseCount] = useState(0);

  const updateDebug = (key, value) => {
    setDebugInfo(prev => ({ ...prev, [key]: value }));
  };

  // PHASE 1: Initialize Firebase and handle authentication
  useEffect(() => {
    const initFirebase = async () => {
      updateDebug('init', 'Starting Firebase initialization...');
      try {
        let firebaseConfig;
        let rawConfig = "";
        try {
          rawConfig = process.env.REACT_APP_FIREBASE_CONFIG || __firebase_config;
          updateDebug('raw_firebase_config', rawConfig);
          firebaseConfig = JSON.parse(rawConfig);
        } catch (e) {
          throw new Error("Firebase configuration is not available. Please ensure the 'REACT_APP_FIREBASE_CONFIG' environment variable is set and is a valid JSON string.");
        }
        
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);
        updateDebug('firebase_ready', 'Firebase services initialized.');
        
        let initialAuthToken;
        try {
          initialAuthToken = process.env.REACT_APP_INITIAL_AUTH_TOKEN || __initial_auth_token;
        } catch (e) {
          initialAuthToken = null;
          updateDebug('auth_token_error', 'Initial auth token is not available. Proceeding without it.');
        }

        if (initialAuthToken) {
          updateDebug('auth_state', 'Signing in with custom token...');
          await signInWithCustomToken(firebaseAuth, initialAuthToken);
        } else {
          updateDebug('auth_state', 'No custom token found. Signing in anonymously...');
          await signInAnonymously(firebaseAuth);
        }

        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
            updateDebug('auth_state_final', `User authenticated with UID: ${user.uid}`);
          }
        });

        return () => unsubscribe();
      } catch (e) {
        console.error("Error initializing Firebase:", e);
        setError(`Error: ${e.message}`);
        updateDebug('error', `Initialization error: ${e.message}`);
        setLoading(false);
      }
    };

    initFirebase();
  }, []);

  // PHASE 2: Handle URL parameters and set up listeners after auth is ready
  useEffect(() => {
    if (!db || !userId) {
      updateDebug('phase2_status', 'Waiting for DB and userId to be available...');
      return;
    }

    updateDebug('phase2_status', `DB and userId (${userId}) are ready. Checking URL...`);
    setLoading(true);

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const creatorIdFromUrl = urlParams.get('creatorId');

    if (id && creatorIdFromUrl) {
      updateDebug('url_params', `Found windowId: ${id}, creatorId: ${creatorIdFromUrl}`);
      setWindowId(id);
      setCreatorId(creatorIdFromUrl);
      
      let appId;
      try {
        appId = typeof process.env.REACT_APP_APP_ID !== 'undefined' ? process.env.REACT_APP_APP_ID : typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      } catch(e) {
        appId = 'default-app-id';
        updateDebug('app_id_error', 'App ID is not available. Using default.');
      }
      
      const isCreator = userId === creatorIdFromUrl;
      setIsSelfAssessment(isCreator);

      const windowRef = doc(db, `/artifacts/${appId}/users/${creatorIdFromUrl}/windows`, id);
      const feedbackCollectionRef = collection(db, `/artifacts/${appId}/users/${creatorIdFromUrl}/windows/${id}/feedback`);

      // Set up the main window listener for both creator and teammate to get the name and self-assessment data.
      const unsubscribeWindow = onSnapshot(windowRef, async (docSnap) => {
        updateDebug('onSnapshot_window', 'onSnapshot callback fired for window.');
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCreatorName(data.creatorName || 'Your Teammate');
          const userSelections = data.selfAssessment || [];

          if (isCreator) {
            // Logic for the creator
            if (userSelections.length > 0) {
              setHasSubmittedSelfAssessment(true);
              setPage('results');
            } else {
              setHasSubmittedSelfAssessment(false);
              setPage('assess');
            }
          } else {
            // Logic for the teammate
            try {
              const querySnapshot = await getDocs(feedbackCollectionRef);
              let existingFeedback = null;
              querySnapshot.forEach(docSnap => {
                if (docSnap.data().submittedBy === userId) {
                  existingFeedback = docSnap.data();
                }
              });
              if (existingFeedback) {
                setSelectedAdjectives(existingFeedback.adjectives);
                setPage('submitted');
              } else {
                setPage('assess');
              }
            } catch (e) {
              console.error("Error fetching feedback:", e);
              setError("Failed to fetch existing feedback. " + e.message);
              updateDebug('fetch_feedback_error', e.message);
            }
          }
          
          // Regardless of creator/teammate, loading is now complete
          setLoading(false);
        } else {
          // Document does not exist
          const errorMessage = "Error: This Johari Window does not exist or you don't have access to it.";
          setError(errorMessage);
          updateDebug('doc_exists', errorMessage);
          setLoading(false);
        }
      }, (error) => {
        // Error handling for onSnapshot
        console.error("Error with window onSnapshot:", error);
        setError(`Error: ${error.message}`);
        setLoading(false);
      });

      // Set up a separate feedback listener ONLY for the creator
      let unsubscribeFeedback;
      if (isCreator) {
        unsubscribeFeedback = onSnapshot(feedbackCollectionRef, (querySnap) => {
          updateDebug('onSnapshot_feedback', 'Feedback onSnapshot callback fired.');
          setTeammateResponseCount(querySnap.size);
          const peerSelections = new Set();
          querySnap.forEach(doc => {
            doc.data().adjectives.forEach(adj => peerSelections.add(adj));
          });
          const userSelections = results?.facade || []; // Use existing results or an empty array
          const arena = userSelections.filter(adj => peerSelections.has(adj));
          const blindSpot = Array.from(peerSelections).filter(adj => !userSelections.includes(adj));
          const facade = userSelections.filter(adj => !peerSelections.has(adj));
          const unknown = adjectivesList.filter(adj => !userSelections.includes(adj) && !peerSelections.has(adj));
          setResults({ arena, blindSpot, facade, unknown });
        }, (error) => {
            console.error("Error with feedback onSnapshot:", error);
        });
      }
      
      const newShareLink = `${window.location.origin}${window.location.pathname}?id=${id}&mode=feedback&creatorId=${creatorIdFromUrl}`;
      setShareLink(newShareLink);
      updateDebug('share_link_set', newShareLink);
      
      return () => {
        unsubscribeWindow();
        if (unsubscribeFeedback) {
          unsubscribeFeedback();
        }
      };
    } else {
      updateDebug('url_params', 'No windowId or creatorId found in URL. Displaying start page.');
      setLoading(false);
    }
  }, [db, userId, windowId, creatorId]);

  const handleStartNewWindow = async () => {
    if (!db || !userId) {
        updateDebug('start_new_error', "Attempted to start new window before Firebase and user are ready.");
        return;
    }

    setLoading(true);
    try {
      const newWindowId = generateUniqueId();
      let appId;
      try {
        appId = typeof process.env.REACT_APP_APP_ID !== 'undefined' ? process.env.REACT_APP_APP_ID : typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      } catch(e) {
        appId = 'default-app-id';
        updateDebug('app_id_error', 'App ID is not available. Using default.');
      }
      const userDocRef = doc(db, `/artifacts/${appId}/users/${userId}/windows`, newWindowId);

      await setDoc(userDocRef, {
        creatorId: userId,
        createdAt: new Date(),
        selfAssessment: [],
        creatorName: creatorName,
      });
      updateDebug('new_window_created', `Successfully created new window with ID: ${newWindowId}`);
      updateDebug('new_window_path', `/artifacts/${appId}/users/${userId}/windows/${newWindowId}`);
      
      // Update state directly to trigger the useEffect hook
      setWindowId(newWindowId);
      setCreatorId(userId);
      setIsSelfAssessment(true);

      const creatorLink = `${window.location.origin}${window.location.pathname}?id=${newWindowId}&creatorId=${userId}`;
      window.history.pushState({}, '', creatorLink);
      
    } catch (e) {
      console.error("Error starting new window:", e);
      setError("Failed to start a new window. Please try again. The error was: " + e.message);
      updateDebug('start_new_error', `Failed to create new window: ${e.message}`);
    } finally {
      // The useEffect hook will now handle setting loading to false.
      // setLoading(false); // Removed to avoid race conditions.
    }
  };

  const handleSelectAdjective = (adjective) => {
    setSelectedAdjectives(prev => {
      if (prev.includes(adjective)) {
        return prev.filter(adj => adj !== adjective);
      } else {
        return [...prev, adjective];
      }
    });
  };
  
  const handleUpdateFeedback = () => {
    setPage('assess');
  };

  const handleCreateNewWindow = () => {
    window.location.href = window.location.origin + window.location.pathname;
  };

  const handleSaveAssessment = async () => {
    if (!db || !windowId || !userId || !creatorId) return;
    setLoading(true);
    try {
      let appId;
      try {
        appId = typeof process.env.REACT_APP_APP_ID !== 'undefined' ? process.env.REACT_APP_APP_ID : typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      } catch(e) {
        appId = 'default-app-id';
        updateDebug('app_id_error', 'App ID is not available. Using default.');
      }
      if (isSelfAssessment) {
        const userDocRef = doc(db, `/artifacts/${appId}/users/${creatorId}/windows`, windowId);
        await updateDoc(userDocRef, {
          selfAssessment: selectedAdjectives,
        });
        updateDebug('assessment_saved', `Self-assessment saved with ${selectedAdjectives.length} adjectives.`);
      } else {
        const feedbackCollectionRef = collection(db, `/artifacts/${appId}/users/${creatorId}/windows/${windowId}/feedback`);
        
        const querySnapshot = await getDocs(feedbackCollectionRef);
        let existingFeedbackDocId = null;
        querySnapshot.forEach(docSnap => {
          if (docSnap.data().submittedBy === userId) {
            existingFeedbackDocId = docSnap.id;
          }
        });
        
        if (existingFeedbackDocId) {
          const docRef = doc(feedbackCollectionRef, existingFeedbackDocId);
          await updateDoc(docRef, { adjectives: selectedAdjectives });
          updateDebug('feedback_updated', 'Existing feedback updated.');
        } else {
          await addDoc(feedbackCollectionRef, {
            adjectives: selectedAdjectives,
            submittedBy: userId,
            submittedAt: new Date(),
          });
          updateDebug('feedback_submitted', 'New feedback submitted.');
        }

        setPage('submitted');
      }
    } catch (e) {
      console.error("Error saving assessment:", e);
      setError("Failed to save your selections. Please try again.");
      updateDebug('save_error', `Failed to save assessment: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyLink = () => {
    const textarea = document.createElement('textarea');
    textarea.value = shareLink;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
    document.body.removeChild(textarea);
  };
  
  const renderContent = () => {
    if (loading) {
      return <p className={tailwindClasses.loading}>Loading...</p>;
    }
    
    if (error) {
      return (
        <div className="text-center p-4">
          <h1 className="text-3xl font-bold text-red-600">⚠️ Error</h1>
          <p className="mt-4 text-lg text-red-500">
            {error}
          </p>
          <div className={tailwindClasses.debugPanel}>
            <h3 className={tailwindClasses.debugTitle}>Current Debug Log</h3>
            <pre className={tailwindClasses.debugLog}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        </div>
      );
    }

    switch (page) {
      case 'start':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Discover Your Johari Window</h1>
            <p className={tailwindClasses.subheading}>A simple tool to help you and your team better understand your interpersonal dynamics.</p>
            <div className="w-full max-w-sm mt-4 mx-auto">
              <label htmlFor="creator-name" className="block text-sm font-medium text-gray-700 mb-1 text-left">Your First Name</label>
              <input
                id="creator-name"
                type="text"
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
                className={tailwindClasses.input}
                placeholder="e.g., Jane"
              />
            </div>
            <button className={tailwindClasses.buttonPrimary} onClick={handleStartNewWindow} disabled={loading || !userId || creatorName.trim() === ''}>
              Start My Window
            </button>
          </>
        );
      case 'assess':
        return (
          <>
            <h1 className={tailwindClasses.heading}>
              {isSelfAssessment ? "Select How You See Yourself" : `Select How You See ${creatorName}`}
            </h1>
            <p className={tailwindClasses.subheading}>
              {isSelfAssessment 
                ? "Choose the adjectives that you feel best describe you." 
                : "Choose the adjectives that you feel best describe your teammate."}
            </p>
            <div className={tailwindClasses.adjectiveGrid}>
              {adjectivesList.map(adj => (
                <button
                  key={adj}
                  onClick={() => handleSelectAdjective(adj)}
                  className={`${tailwindClasses.adjectiveButton} ${selectedAdjectives.includes(adj) ? tailwindClasses.adjectiveSelected : tailwindClasses.adjectiveUnselected}`}
                  disabled={loading}
                >
                  {adj}
                </button>
              ))}
            </div>
            <button className={tailwindClasses.buttonPrimary} onClick={handleSaveAssessment} disabled={loading || selectedAdjectives.length === 0}>
              {isSelfAssessment ? "Submit My Selections" : "Submit Feedback"}
            </button>
          </>
        );
      case 'results':
        const responsesText = teammateResponseCount === 1 ? 'teammate has responded' : 'teammates have responded';
        return (
          <>
            <h1 className={tailwindClasses.heading}>{creatorName}'s Johari Window Results</h1>
            <p className={tailwindClasses.subheading}>
              This is your unique window. Share the link below to get more feedback!
            </p>
            
            <div className={tailwindClasses.linkContainer}>
              <p>Your unique share link:</p>
              <div className={tailwindClasses.link}>{shareLink}</div>
              <div className="relative flex items-center justify-center mt-4">
                <button className={tailwindClasses.buttonPrimary} onClick={handleCopyLink}>Copy Link</button>
                <span className={`absolute left-full ml-4 text-green-600 font-medium transition-opacity duration-300 whitespace-nowrap ${isCopied ? 'opacity-100' : 'opacity-0'}`}>
                    Copied! ✅
                </span>
              </div>
              <p>Your User ID for Firestore: {userId}</p>
              <p>Creator's User ID: {creatorId}</p>
            </div>
            
            <p className="text-md text-gray-600 font-medium my-4">
              <span className="text-indigo-600 font-bold">{teammateResponseCount}</span> {responsesText}.
            </p>
            
            {results && (
              <div className={tailwindClasses.resultsGrid}>
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantArena}`}>
                  <h2 className={tailwindClasses.quadrantTitle}>Arena (Open)</h2>
                  <p className={tailwindClasses.quadrantList}>
                    {results.arena.length > 0 ? results.arena.join(', ') : "No shared adjectives yet."}
                  </p>
                </div>
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantBlindSpot}`}>
                  <h2 className={tailwindClasses.quadrantTitle}>Blind Spot</h2>
                  <p className={tailwindClasses.quadrantList}>
                    {results.blindSpot.length > 0 ? results.blindSpot.join(', ') : "No new feedback yet."}
                  </p>
                </div>
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantFacade}`}>
                  <h2 className={tailwindClasses.quadrantTitle}>Facade (Hidden)</h2>
                  <p className={tailwindClasses.quadrantList}>
                    {results.facade.length > 0 ? results.facade.join(', ') : "Nothing hidden."}
                  </p>
                </div>
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantUnknown}`}>
                  <h2 className={tailwindClasses.quadrantTitle}>Unknown</h2>
                  <p className={tailwindClasses.quadrantList}>
                    {results.unknown.length > 0 ? results.unknown.join(', ') : "All adjectives have been used."}
                  </p>
                </div>
              </div>
            )}
            
            <button className={`${tailwindClasses.buttonSecondary} mt-8`} onClick={handleCreateNewWindow}>
              Create Another Window
            </button>
          </>
        );
      case 'submitted':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Thank you for your feedback!</h1>
            <p className={tailwindClasses.subheading}>Your selections have been successfully submitted.</p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
              <button
                className={tailwindClasses.buttonSecondary}
                onClick={handleUpdateFeedback}
              >
                Update My Feedback
              </button>
              <button
                className={tailwindClasses.buttonPrimary}
                onClick={handleCreateNewWindow}
              >
                Create My Own Window
              </button>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <FirebaseContext.Provider value={{ db }}>
      <div className={tailwindClasses.container}>
        <div className={tailwindClasses.card}>
          {renderContent()}
        </div>
        <div className={tailwindClasses.debugPanel}>
          <h3 className={tailwindClasses.debugTitle}>Debug Log</h3>
          <pre className={tailwindClasses.debugLog}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    </FirebaseContext.Provider>
  );
}
