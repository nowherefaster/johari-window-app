import React, { useState, useEffect, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, updateDoc, query, where, getDocs } from 'firebase/firestore';

// Define the Firebase context to pass services to components
const FirebaseContext = createContext(null);

// Tailwind CSS classes for a clean, responsive, and professional look
const tailwindClasses = {
  container: "min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 overflow-x-hidden font-inter",
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
  const [isCopied, setIsCopied] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [teammateResponseCount, setTeammateResponseCount] = useState(0);
  const [isWindowDataLoaded, setIsWindowDataLoaded] = useState(false);
  const [peerAdjectives, setPeerAdjectives] = useState(new Set());
  
  const updateDebug = (key, value) => {
    setDebugInfo(prev => ({ ...prev, [key]: value }));
  };

  // Function to create and set the share link
  const generateShareLink = (id, creator) => {
    const newShareLink = `${window.location.origin}${window.location.pathname}?id=${id}&mode=feedback&creatorId=${creator}`;
    setShareLink(newShareLink);
    updateDebug('share_link_set', newShareLink);
  };

  // PHASE 1: Initialize Firebase and handle authentication
  useEffect(() => {
    const initFirebase = async () => {
      updateDebug('init', 'Starting Firebase initialization...');
      try {
        let firebaseConfig;
        let rawConfig = "";
        try {
          rawConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : process.env.REACT_APP_FIREBASE_CONFIG;
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
          initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : process.env.REACT_APP_INITIAL_AUTH_TOKEN;
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

  // PHASE 2: Handle URL parameters after auth is ready
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
      setIsSelfAssessment(userId === creatorIdFromUrl);
      generateShareLink(id, creatorIdFromUrl);
    } else {
      updateDebug('url_params', 'No windowId or creatorId found in URL. Displaying start page.');
      setLoading(false);
    }
  }, [db, userId]);

  // PHASE 3: Set up window listener (always needed)
  useEffect(() => {
    if (!db || !userId || !windowId || !creatorId) {
      return;
    }

    updateDebug('phase3_status_window', 'Setting up window listener...');

    let appId;
    try {
      appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    } catch(e) {
      appId = 'default-app-id';
      updateDebug('app_id_error', 'App ID is not available. Using default.');
    }
    
    // Path for the window document is now in the public space
    const windowRef = doc(db, `/artifacts/${appId}/public/data/windows`, windowId);
    
    const unsubscribeWindow = onSnapshot(windowRef, (docSnap) => {
      updateDebug('onSnapshot_window', 'Window snapshot fired.');
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCreatorName(data.creatorName || 'Your Teammate');
        const selfAssessmentFromDb = data.selfAssessment || [];
        
        // Update the self-assessment state regardless of who the user is.
        setSelectedAdjectives(selfAssessmentFromDb);
        setIsWindowDataLoaded(true); // Signal that the window data is ready
        
        if (userId === creatorId) {
          if (selfAssessmentFromDb.length > 0 && page !== 'assess') {
            setPage('results');
          } else if (page !== 'results') {
            setPage('assess');
          }
        }
      } else {
        const errorMessage = "Error: This Johari Window does not exist or you don't have access to it. It may have been deleted or the URL is incorrect.";
        setError(errorMessage);
        updateDebug('doc_exists', errorMessage);
        setLoading(false);
      }
    }, (error) => {
      console.error("Error with window onSnapshot:", error);
      setError(`Error: ${error.message}. This may be due to a security permissions issue.`);
      setLoading(false);
    });

    return () => unsubscribeWindow();
  }, [db, userId, windowId, creatorId]);

  // PHASE 4: Set up feedback listener and handle final page load
  useEffect(() => {
    if (!isWindowDataLoaded || !db || !userId || !windowId || !creatorId) {
        updateDebug('phase4_status_feedback', 'Waiting for window data to be loaded...');
        return;
    }

    updateDebug('phase4_status_feedback', 'Window data is loaded. Setting up feedback listener.');

    let appId;
    try {
      appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    } catch(e) {
      appId = 'default-app-id';
      updateDebug('app_id_error', 'App ID is not available. Using default.');
    }
    
    // Path for feedback is now also in the public space
    const feedbackCollectionRef = collection(db, `/artifacts/${appId}/public/data/windows/${windowId}/feedback`);

    let unsubscribeFeedback;

    if (isSelfAssessment) {
      // Logic for the creator: listen to all feedback
      unsubscribeFeedback = onSnapshot(feedbackCollectionRef, (querySnap) => {
        updateDebug('onSnapshot_feedback_creator', 'Feedback snapshot fired for creator.');
        setTeammateResponseCount(querySnap.size);
        const peerSelections = new Set();
        querySnap.forEach(doc => {
          doc.data().adjectives.forEach(adj => peerSelections.add(adj));
        });
        setPeerAdjectives(peerSelections);
        setLoading(false); // End loading only after feedback is processed
      }, (error) => {
        console.error("Error with creator feedback onSnapshot:", error);
        setError(`Error loading feedback: ${error.message}`);
        setLoading(false);
      });
    } else {
      // Logic for the teammate: listen to their specific feedback
      const q = query(feedbackCollectionRef, where('submittedBy', '==', userId));
      unsubscribeFeedback = onSnapshot(q, (querySnap) => {
        updateDebug('onSnapshot_feedback_teammate', 'Teammate feedback snapshot fired.');
        if (!querySnap.empty) {
          const docSnap = querySnap.docs[0];
          setSelectedAdjectives(docSnap.data().adjectives);
          setPage('submitted');
        } else {
          setPage('assess');
          setSelectedAdjectives([]); // Clear selections for a new assessment
        }
        setLoading(false); // End loading for teammate
      }, (error) => {
        console.error("Error with teammate feedback onSnapshot:", error);
        setError(`Error loading feedback: ${error.message}`);
        setLoading(false);
      });
    }
    return () => {
      if (unsubscribeFeedback) {
        unsubscribeFeedback();
      }
    };
  }, [isWindowDataLoaded, db, userId, windowId, creatorId, isSelfAssessment]);

  // PHASE 5: Calculate results whenever self-assessment or peer feedback changes
  useEffect(() => {
    if (isSelfAssessment && isWindowDataLoaded && selectedAdjectives && peerAdjectives) {
      updateDebug('calculating_results', 'Calculating results based on updated data.');
      const selfAssessment = selectedAdjectives;
      const arena = selfAssessment.filter(adj => peerAdjectives.has(adj));
      const blindSpot = Array.from(peerAdjectives).filter(adj => !selfAssessment.includes(adj));
      const facade = selfAssessment.filter(adj => !peerAdjectives.has(adj));
      const unknown = adjectivesList.filter(adj => !selfAssessment.includes(adj) && !peerAdjectives.has(adj));
      setResults({ arena, blindSpot, facade, unknown });
    }
  }, [isSelfAssessment, isWindowDataLoaded, selectedAdjectives, peerAdjectives]);


  // Handles the creator starting a new window
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
        appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      } catch(e) {
        appId = 'default-app-id';
        updateDebug('app_id_error', 'App ID is not available. Using default.');
      }
      
      // Store the window in the public path.
      const windowDocRef = doc(db, `/artifacts/${appId}/public/data/windows`, newWindowId);
      await setDoc(windowDocRef, { 
        creatorId: userId, 
        createdAt: new Date(), 
        selfAssessment: [],
        // Use the user-provided name
        creatorName: creatorName || 'Your Teammate',
      });

      updateDebug('new_window_created', `Successfully created new window with ID: ${newWindowId}`);
      updateDebug('new_window_path', `/artifacts/${appId}/public/data/windows/${newWindowId}`);
      setWindowId(newWindowId);
      setCreatorId(userId);
      setIsSelfAssessment(true);
      const creatorLink = `${window.location.origin}${window.location.pathname}?id=${newWindowId}&creatorId=${userId}`;
      window.history.pushState({}, '', creatorLink); // Update URL without reload
      setLoading(false);
    } catch (e) {
      setError(`Error creating new window: ${e.message}`);
      updateDebug('new_window_error', `Error: ${e.message}`);
      setLoading(false);
    }
  };

  // Toggles an adjective on or off for assessment
  const toggleAdjective = (adjective) => {
    setSelectedAdjectives(prev => 
      prev.includes(adjective) 
        ? prev.filter(a => a !== adjective) 
        : [...prev, adjective]
    );
  };

  // Submits the self-assessment for the creator
  const handleSubmitSelfAssessment = async () => {
    if (!db || !windowId) return;
    setLoading(true);
    try {
      let appId;
      try {
        appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      } catch(e) {
        appId = 'default-app-id';
        updateDebug('app_id_error', 'App ID is not available. Using default.');
      }

      const windowRef = doc(db, `/artifacts/${appId}/public/data/windows`, windowId);
      await updateDoc(windowRef, {
        selfAssessment: selectedAdjectives,
      });
      setPage('results');
      setLoading(false);
      updateDebug('self_assessment_submitted', 'Self-assessment submitted successfully.');
    } catch (e) {
      setError(`Error submitting self-assessment: ${e.message}`);
      setLoading(false);
    }
  };

  // Submits the feedback for a teammate
  const handleSubmitTeammateFeedback = async () => {
    if (!db || !windowId || !userId) return;
    setLoading(true);
    try {
      let appId;
      try {
        appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      } catch(e) {
        appId = 'default-app-id';
        updateDebug('app_id_error', 'App ID is not available. Using default.');
      }
      
      const feedbackCollectionRef = collection(db, `/artifacts/${appId}/public/data/windows/${windowId}/feedback`);

      // Check if a document from this user already exists
      const q = query(feedbackCollectionRef, where('submittedBy', '==', userId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // If not, add a new document
        await addDoc(feedbackCollectionRef, {
          submittedBy: userId,
          submittedAt: new Date(),
          adjectives: selectedAdjectives,
        });
        updateDebug('feedback_submitted', `New feedback submitted by ${userId}.`);
      } else {
        // If it exists, update the existing document
        const docToUpdate = querySnapshot.docs[0];
        await updateDoc(docToUpdate.ref, {
          adjectives: selectedAdjectives,
          submittedAt: new Date(),
        });
        updateDebug('feedback_updated', `Feedback updated by ${userId}.`);
      }
      
      setPage('submitted');
      setLoading(false);
    } catch (e) {
      setError(`Error submitting feedback: ${e.message}`);
      setLoading(false);
    }
  };

  const handleUpdateFeedback = () => {
    setPage('assess');
  };

  const handleCreateNewWindow = () => {
    setPage('start');
    setCreatorName('');
    setWindowId(null);
    setCreatorId(null);
    setIsSelfAssessment(false);
    setSelectedAdjectives([]);
    setResults(null);
    setShareLink('');
    setTeammateResponseCount(0);
    setIsWindowDataLoaded(false);
    setPeerAdjectives(new Set());
    // Clear the URL
    window.history.pushState({}, '', window.location.pathname);
  };
  
  const handleCopyLink = () => {
    const el = document.createElement('textarea');
    el.value = shareLink;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
  };
  
  const handleCreatorNameChange = (e) => {
    setCreatorName(e.target.value);
  }

  // Renders the main content based on the current page state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center space-y-4">
          <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className={tailwindClasses.loading}>Loading...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-red-500 font-medium">
          {error}
        </div>
      );
    }

    switch (page) {
      case 'start':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Create Your Johari Window</h1>
            <p className={tailwindClasses.subheading}>Start a new session to begin your self-assessment and receive feedback from your teammates.</p>
            <input
              type="text"
              placeholder="Enter your name (optional)"
              className={tailwindClasses.input}
              value={creatorName}
              onChange={handleCreatorNameChange}
            />
            <button
              className={tailwindClasses.buttonPrimary}
              onClick={handleStartNewWindow}
            >
              Start My Window
            </button>
          </>
        );
      case 'assess':
        const assessmentTitle = isSelfAssessment ? `Select adjectives for yourself` : `Select adjectives for ${creatorName}`;
        const assessmentButtonText = isSelfAssessment ? "Submit My Selections" : "Submit My Feedback";
        const assessmentSubmitHandler = isSelfAssessment ? handleSubmitSelfAssessment : handleSubmitTeammateFeedback;

        return (
          <>
            <h1 className={tailwindClasses.heading}>
              {assessmentTitle}
            </h1>
            <p className={tailwindClasses.subheading}>
              Select the adjectives that you feel best describe you.
            </p>
            <div className={tailwindClasses.adjectiveGrid}>
              {adjectivesList.map(adjective => (
                <button
                  key={adjective}
                  onClick={() => toggleAdjective(adjective)}
                  className={`${tailwindClasses.adjectiveButton} ${
                    selectedAdjectives.includes(adjective) ? tailwindClasses.adjectiveSelected : tailwindClasses.adjectiveUnselected
                  }`}
                >
                  {adjective}
                </button>
              ))}
            </div>
            <button
              className={tailwindClasses.buttonPrimary}
              onClick={assessmentSubmitHandler}
              disabled={selectedAdjectives.length === 0}
            >
              {assessmentButtonText}
            </button>
          </>
        );
      case 'results':
        const creatorLink = `${window.location.origin}${window.location.pathname}?id=${windowId}&creatorId=${userId}`;
        const feedbackLink = shareLink;
        return (
          <>
            <h1 className={tailwindClasses.heading}>Your Johari Window</h1>
            <p className={tailwindClasses.subheading}>
              {teammateResponseCount} {teammateResponseCount === 1 ? 'teammate has' : 'teammates have'} responded.
              Results update in real-time.
            </p>
            {results && (
              <div className={tailwindClasses.resultsGrid}>
                {/* Arena */}
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantArena}`}>
                  <h3 className={tailwindClasses.quadrantTitle}>Arena (Open Self)</h3>
                  <ul className={tailwindClasses.quadrantList}>
                    {results.arena.length > 0 ? (
                      results.arena.map(adj => <li key={adj}>{adj}</li>)
                    ) : (
                      <li>No adjectives in this quadrant yet.</li>
                    )}
                  </ul>
                </div>

                {/* Blind Spot */}
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantBlindSpot}`}>
                  <h3 className={tailwindClasses.quadrantTitle}>Blind Spot</h3>
                  <ul className={tailwindClasses.quadrantList}>
                    {results.blindSpot.length > 0 ? (
                      results.blindSpot.map(adj => <li key={adj}>{adj}</li>)
                    ) : (
                      <li>No adjectives in this quadrant yet.</li>
                    )}
                  </ul>
                </div>

                {/* Facade */}
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantFacade}`}>
                  <h3 className={tailwindClasses.quadrantTitle}>Facade (Hidden Self)</h3>
                  <ul className={tailwindClasses.quadrantList}>
                    {results.facade.length > 0 ? (
                      results.facade.map(adj => <li key={adj}>{adj}</li>)
                    ) : (
                      <li>No adjectives in this quadrant yet.</li>
                    )}
                  </ul>
                </div>

                {/* Unknown */}
                <div className={`${tailwindClasses.quadrant} ${tailwindClasses.quadrantUnknown}`}>
                  <h3 className={tailwindClasses.quadrantTitle}>Unknown</h3>
                  <ul className={tailwindClasses.quadrantList}>
                    {results.unknown.length > 0 ? (
                      results.unknown.map(adj => <li key={adj}>{adj}</li>)
                    ) : (
                      <li>No adjectives in this quadrant yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
            <div className={tailwindClasses.linkContainer}>
              <p>Share this link with your teammates for them to provide feedback:</p>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 items-center">
                <span className={tailwindClasses.link}>{feedbackLink}</span>
                <button 
                  className={`${tailwindClasses.copyButton} flex-shrink-0`}
                  onClick={handleCopyLink}
                >
                  {isCopied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
            <button
              className={tailwindClasses.buttonSecondary}
              onClick={handleCreateNewWindow}
            >
              Create Another Window
            </button>
          </>
        );
      case 'submitted':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Thank you for your feedback!</h1>
            <p className={tailwindClasses.subheading}>Your selections have been successfully submitted for {creatorName}.</p>
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
