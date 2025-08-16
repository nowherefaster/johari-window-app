import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore';

// Tailwind CSS classes for a clean, professional look
const tailwindClasses = {
  container: "min-h-screen bg-gray-50 flex flex-col items-center p-4 overflow-x-hidden font-inter",
  card: "bg-white p-8 rounded-lg shadow-xl max-w-3xl w-full text-center space-y-6 mt-16",
  heading: "text-3xl font-bold text-gray-800",
  subheading: "text-lg text-gray-600",
  buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed",
  buttonSecondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out",
  input: "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
  copyButton: "bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 whitespace-nowrap",
  copyButtonFeedback: "bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md whitespace-nowrap",
  snackbar: "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full text-white font-bold shadow-lg transition-transform duration-300 ease-in-out transform",
  snackbarError: "bg-red-500",
  adjectiveContainer: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-6",
  adjectiveButton: "py-2 px-2 rounded-full border-2 border-gray-300 text-gray-700 font-medium transition duration-200 ease-in-out text-sm md:text-base text-center",
  adjectiveButtonSelected: "py-2 px-2 rounded-full border-2 border-blue-600 bg-blue-50 text-blue-700 font-bold text-sm md:text-base text-center",
  adjectiveButtonInactive: "py-2 px-2 rounded-full border-2 border-gray-200 text-gray-400 bg-gray-100 text-center",
  adjectiveList: "mt-4 text-left p-4 bg-gray-50 rounded-lg",
  adjectiveListItem: "my-1",
  quadrantContainer: "grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-left",
  quadrant: "bg-gray-50 p-4 rounded-lg",
  quadrantTitle: "text-lg font-bold mb-2",
  debugPanel: "bg-gray-800 text-gray-200 p-4 rounded-lg mt-8 max-w-2xl w-full font-mono text-left text-xs mb-20",
  debugTitle: "text-lg font-bold mb-2 text-white",
  debugLog: "whitespace-pre-wrap break-all",
};

const adjectives = [
  "Able", "Accepting", "Adaptable", "Bold", "Brave", "Calm", "Caring", "Cheerful", "Clever", "Complex", "Confident", "Dependable",
  "Dignified", "Energetic", "Extroverted", "Friendly", "Giving", "Happy", "Helpful", "Idealistic", "Independent", "Ingenious",
  "Intelligent", "Introverted", "Kind", "Knowledgeable", "Logical", "Loving", "Mature", "Modest", "Nervous", "Observant",
  "Organized", "Patient", "Powerful", "Proud", "Quiet", "Reflective", "Relaxed", "Religious", "Responsive", "Searching",
  "Self-Assertive", "Self-Conscious", "Sensible", "Sentimental", "Shy", "Silly", "Spontaneous", "Sympathetic", "Tense",
  "Trustworthy", "Warm", "Wise", "Witty"
];

const LoadingScreen = () => (
    <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-blue-500 mb-6"></div>
        <h1 className="text-3xl font-bold text-gray-800">Initializing App...</h1>
        <p className="text-lg text-gray-600 mt-2">Loading is a good thing! It means we are connected to the cloud and fetching your data.</p>
    </div>
);

// Main App component
export default function App() {
  // Main app state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [windowId, setWindowId] = useState(null);
  const [windowData, setWindowData] = useState(null);
  const [allWindowsData, setAllWindowsData] = useState(null);

  // Form state
  const [creatorName, setCreatorName] = useState('');
  const [selfSelections, setSelfSelections] = useState([]);
  const [feedbackSelections, setFeedbackSelections] = useState([]);

  // UI state
  const [snackbarMessage, setSnackbarMessage] = useState(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [copyButtonText, setCopyButtonText] = useState("Copy Link");

  // Constants from the Canvas environment
  const appId = useMemo(() => typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', []);
  const firebaseConfig = useMemo(() => {
    try {
      return JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  // Global Firebase instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);

  // 1. Unified Initialization and Data Fetching
  useEffect(() => {
    const initAndFetch = async () => {
      try {
        // Initialize Firebase
        if (Object.keys(firebaseConfig).length === 0) {
          throw new Error("Firebase configuration is missing or invalid.");
        }
        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authService = getAuth(app);
        setDb(firestore);
        setAuth(authService);

        // Sign in user
        let user = authService.currentUser;
        if (!user) {
          user = initialAuthToken
            ? (await signInWithCustomToken(authService, initialAuthToken)).user
            : (await signInAnonymously(authService)).user;
        }
        setUserId(user.uid);

        // Check for admin status
        const adminDocRef = doc(firestore, `artifacts/${appId}/public/data/admins`, user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        setIsAdmin(adminDocSnap.exists());
        
        // Get window ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const idFromUrl = urlParams.get('windowId');
        setWindowId(idFromUrl);

        // Handle initial data fetch based on user role and URL
        if (adminDocSnap.exists()) {
          // Admin dashboard data
          const windowsCollectionRef = collection(firestore, `artifacts/${appId}/public/data/windows`);
          onSnapshot(windowsCollectionRef, async (querySnapshot) => {
            const windows = [];
            for (const docSnap of querySnapshot.docs) {
              const feedbackCollectionRef = collection(firestore, `artifacts/${appId}/public/data/windows/${docSnap.id}/feedback`);
              const feedbackDocs = await getDocs(feedbackCollectionRef);
              windows.push({
                id: docSnap.id,
                ...docSnap.data(),
                responsesCount: feedbackDocs.docs.length
              });
            }
            setAllWindowsData(windows);
          });
        }
        
        if (idFromUrl) {
          // Single window data fetch for both creator and feedback provider
          const windowDocRef = doc(firestore, `artifacts/${appId}/public/data/windows`, idFromUrl);
          const feedbackCollectionRef = collection(firestore, `artifacts/${appId}/public/data/windows/${idFromUrl}/feedback`);

          // Main window listener
          onSnapshot(windowDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setWindowData(prevData => ({ ...prevData, ...docSnap.data(), id: docSnap.id }));
            } else {
              setError("Window not found. Please check the URL.");
              setLoading(false);
            }
          });

          // Feedback listener
          onSnapshot(feedbackCollectionRef, (querySnapshot) => {
            const feedbackDocs = querySnapshot.docs.map(d => d.data());
            setWindowData(prevData => ({ ...prevData, feedback: feedbackDocs }));
            
            // Check if current user has provided feedback
            const existingFeedback = feedbackDocs.find(f => f.creatorId === user.uid);
            if (existingFeedback) {
              setFeedbackSelections(existingFeedback.selections);
            }
          });
        }
        
        // Final state change to show the app
        setLoading(false);
      } catch (e) {
        console.error("Initialization failed:", e);
        setError("Failed to initialize. " + e.message);
        setLoading(false);
      }
    };
    initAndFetch();
  }, [firebaseConfig, initialAuthToken, appId]);

  // Handle all UI actions (simplified and centralized)
  const handleCreateOrUpdateWindow = useCallback(async () => {
    if (!db || selfSelections.length === 0) {
      setSnackbarMessage({ type: 'error', message: "Please select at least one adjective." });
      return;
    }
    try {
      const data = {
        creatorName,
        selfSelections,
        creatorId: userId,
        createdAt: new Date(),
      };
      if (windowId) {
        await updateDoc(doc(db, `artifacts/${appId}/public/data/windows`, windowId), data);
      } else {
        const newDocRef = await addDoc(collection(db, `artifacts/${appId}/public/data/windows`), data);
        window.history.pushState({}, '', `?windowId=${newDocRef.id}`);
        setWindowId(newDocRef.id);
      }
      setSnackbarMessage({ type: 'success', message: "Window saved successfully!" });
    } catch (e) {
      console.error("Error saving document: ", e);
      setSnackbarMessage({ type: 'error', message: "Failed to save. Please try again." });
    }
  }, [db, appId, creatorName, selfSelections, userId, windowId]);

  const handleSubmitFeedback = useCallback(async () => {
    if (!db || feedbackSelections.length === 0) {
      setSnackbarMessage({ type: 'error', message: "Please select at least one adjective." });
      return;
    }
    try {
      const feedbackCollectionRef = collection(db, `artifacts/${appId}/public/data/windows/${windowId}/feedback`);
      
      const existingFeedbackQuery = query(feedbackCollectionRef, where("creatorId", "==", userId));
      const querySnapshot = await getDocs(existingFeedbackQuery);
      
      if (!querySnapshot.empty) {
        const feedbackDocId = querySnapshot.docs[0].id;
        await updateDoc(doc(db, `artifacts/${appId}/public/data/windows/${windowId}/feedback`, feedbackDocId), { selections: feedbackSelections });
      } else {
        await addDoc(feedbackCollectionRef, { selections: feedbackSelections, creatorId: userId, createdAt: new Date() });
      }
      setSnackbarMessage({ type: 'success', message: "Feedback submitted successfully!" });
    } catch (e) {
      console.error("Error submitting feedback: ", e);
      setSnackbarMessage({ type: 'error', message: "Failed to submit feedback. Please try again." });
    }
  }, [db, appId, windowId, feedbackSelections, userId]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}${window.location.pathname}?windowId=${windowId}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopyButtonText("Copied!");
        setTimeout(() => setCopyButtonText("Copy Link"), 2000);
      })
      .catch(() => {
        setSnackbarMessage({ type: 'error', message: "Failed to copy link. Please copy it manually." });
      });
  };

  const handleCreateNewWindow = () => {
    setWindowId(null);
    setCreatorName('');
    setSelfSelections([]);
    window.history.pushState({}, '', window.location.pathname);
  };

  const toggleAdjective = (adj, type) => {
    const selections = type === 'self' ? selfSelections : feedbackSelections;
    const setter = type === 'self' ? setSelfSelections : setFeedbackSelections;
    const isSelected = selections.includes(adj);
    const MAX_SELECTIONS = 5;

    if (isSelected) {
      setter(prev => prev.filter(a => a !== adj));
    } else if (selections.length < MAX_SELECTIONS) {
      setter(prev => [...prev, adj]);
    } else {
      setSnackbarMessage({ type: 'error', message: `You can only select a maximum of ${MAX_SELECTIONS} adjectives.` });
    }
  };

  // --- UI Rendering Logic ---
  const renderAdjectiveSelector = (type) => {
    const selections = type === 'self' ? selfSelections : feedbackSelections;
    const MAX_SELECTIONS = 5;

    return (
      <div className={tailwindClasses.adjectiveContainer}>
        {adjectives.map((adj) => {
          const isSelected = selections.includes(adj);
          const isAtMax = selections.length >= MAX_SELECTIONS;
          let buttonClassName = tailwindClasses.adjectiveButton;
          if (isSelected) {
            buttonClassName = tailwindClasses.adjectiveButtonSelected;
          } else if (isAtMax) {
            buttonClassName = tailwindClasses.adjectiveButtonInactive;
          }
          return (
            <button
              key={adj}
              className={buttonClassName}
              onClick={() => toggleAdjective(adj, type)}
              disabled={isAtMax && !isSelected}
            >
              {adj}
            </button>
          );
        })}
      </div>
    );
  };

  const renderWindowDisplay = () => {
    if (!windowData) {
      return <p className={tailwindClasses.subheading}>Loading window data...</p>;
    }

    const selfSelectionsSet = new Set(windowData.selfSelections);
    const allFeedbackSelections = windowData.feedback?.flatMap(f => f.selections) || [];
    const feedbackSelectionsSet = new Set(allFeedbackSelections);
    const feedbackCounts = allFeedbackSelections.reduce((acc, adj) => {
      acc[adj] = (acc[adj] || 0) + 1;
      return acc;
    }, {});

    const arena = adjectives.filter(adj => selfSelectionsSet.has(adj) && feedbackSelectionsSet.has(adj));
    const blindSpot = adjectives.filter(adj => !selfSelectionsSet.has(adj) && feedbackSelectionsSet.has(adj));
    const facade = adjectives.filter(adj => selfSelectionsSet.has(adj) && !feedbackSelectionsSet.has(adj));
    const unknown = adjectives.filter(adj => !selfSelectionsSet.has(adj) && !feedbackSelectionsSet.has(adj));

    const renderAdjectiveList = (adjectiveArray) => {
      return adjectiveArray.length > 0 ? (
        <ul className={tailwindClasses.adjectiveList}>
          {adjectiveArray.map(adj => (
            <li key={adj} className={`${tailwindClasses.adjectiveListItem} flex justify-between items-center`}>
              <span>{adj}</span>
              {feedbackCounts[adj] > 1 && (
                <span className="text-sm font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                  {feedbackCounts[adj]}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>No adjectives in this quadrant yet.</p>
      );
    };

    return (
      <>
        <h1 className={tailwindClasses.heading}>{windowData.creatorName}'s Johari Window</h1>
        <p className={tailwindClasses.subheading}>
          {windowData.feedback?.length || 0} Teammate Response{windowData.feedback?.length !== 1 ? 's' : ''}
        </p>
        <div className={tailwindClasses.quadrantContainer}>
          <div className={tailwindClasses.quadrant}>
            <h3 className={tailwindClasses.quadrantTitle}>Arena (Open)</h3>
            {renderAdjectiveList(arena)}
          </div>
          <div className={tailwindClasses.quadrant}>
            <h3 className={tailwindClasses.quadrantTitle}>Blind Spot</h3>
            {renderAdjectiveList(blindSpot)}
          </div>
          <div className={tailwindClasses.quadrant}>
            <h3 className={tailwindClasses.quadrantTitle}>Facade (Hidden)</h3>
            {renderAdjectiveList(facade)}
          </div>
          <div className={tailwindClasses.quadrant}>
            <h3 className={tailwindClasses.quadrantTitle}>Unknown</h3>
            {renderAdjectiveList(unknown)}
          </div>
        </div>
      </>
    );
  };
  
  const renderContent = () => {
    // Primary loading state
    if (loading) {
      return <LoadingScreen />;
    }
    
    // Error state
    if (error) {
      return (
        <div className={tailwindClasses.card}>
          <h1 className={tailwindClasses.heading}>Application Error</h1>
          <p className={`${tailwindClasses.subheading} text-red-500 font-semibold`}>
            {error}
          </p>
        </div>
      );
    }
    
    // Admin Dashboard
    if (isAdmin) {
      if (!windowId) {
        return (
          <div className={tailwindClasses.card}>
            <h1 className={tailwindClasses.heading}>Admin Dashboard</h1>
            <p className={tailwindClasses.subheading}>Click a name to view their Johari Window.</p>
            {allWindowsData?.length > 0 ? (
              <div className="space-y-2 mt-6 max-h-96 overflow-y-auto w-full">
                {allWindowsData.map(w => (
                  <button
                    key={w.id}
                    onClick={() => {
                      setWindowId(w.id);
                      window.history.pushState({}, '', `?windowId=${w.id}`);
                    }}
                    className="w-full text-left p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 shadow-sm"
                  >
                    <div className="text-gray-800 font-semibold">{w.creatorName}</div>
                    <div className="text-gray-500 text-sm">{w.responsesCount} teammate response(s)</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-gray-500">No Johari Windows have been created yet.</p>
            )}
            <button className={tailwindClasses.buttonSecondary} onClick={() => signOut(auth)}>Sign Out</button>
          </div>
        );
      } else {
        return (
          <div className={tailwindClasses.card}>
            {renderWindowDisplay()}
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
              <button
                className={tailwindClasses.buttonPrimary}
                onClick={handleCreateNewWindow}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        );
      }
    }
    
    // Creator flow
    if (!windowId) {
      return (
        <div className={tailwindClasses.card}>
          {selfSelections.length === 0 ? (
            <>
              <h1 className={tailwindClasses.heading}>Discover Your Johari Window</h1>
              <p className={tailwindClasses.subheading}>Enter your name and select the five adjectives you feel best describe you.</p>
              <input
                type="text"
                placeholder="Enter your name"
                className={tailwindClasses.input}
                value={creatorName}
                onChange={(e) => setCreatorName(e.target.value)}
              />
              {renderAdjectiveSelector('self')}
              <button
                className={tailwindClasses.buttonPrimary}
                onClick={handleCreateOrUpdateWindow}
                disabled={creatorName.trim() === '' || selfSelections.length === 0}
              >
                Create My Window
              </button>
            </>
          ) : (
            <>
              <h1 className={tailwindClasses.heading}>Your window is ready!</h1>
              <p className={tailwindClasses.subheading}>
                Share this link with your teammates to get feedback!
              </p>
              <div className="flex flex-col items-center justify-center space-y-4 w-full">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}${window.location.pathname}?windowId=${windowId}`}
                  className={tailwindClasses.input}
                  onClick={(e) => e.target.select()}
                />
                <button
                  className={copyButtonText === "Copied!" ? tailwindClasses.copyButtonFeedback : tailwindClasses.copyButton}
                  onClick={handleCopyLink}
                >
                  {copyButtonText}
                </button>
              </div>
              <button className={tailwindClasses.buttonSecondary} onClick={handleCreateNewWindow}>
                Create Another Window
              </button>
            </>
          )}
        </div>
      );
    }
    
    // Feedback provider or Creator viewing
    if (windowData) {
      const isCreator = windowData.creatorId === userId;
      return (
        <div className={tailwindClasses.card}>
          {isCreator ? (
            <>
              {renderWindowDisplay()}
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
                <button
                  className={tailwindClasses.buttonSecondary}
                  onClick={() => {
                    setSelfSelections(windowData.selfSelections);
                    setWindowId(windowData.id);
                  }}
                >
                  Edit My Selections
                </button>
                <button
                  className={tailwindClasses.buttonPrimary}
                  onClick={handleCreateNewWindow}
                >
                  Create Another Window
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className={tailwindClasses.heading}>Give Feedback to {windowData.creatorName}</h1>
              <p className={tailwindClasses.subheading}>Select the five adjectives you feel best describe them.</p>
              {renderAdjectiveSelector('feedback')}
              <button
                className={tailwindClasses.buttonPrimary}
                onClick={handleSubmitFeedback}
                disabled={feedbackSelections.length === 0}
              >
                Submit Feedback
              </button>
              <button
                className={tailwindClasses.buttonSecondary}
                onClick={handleCreateNewWindow}
              >
                Create My Own Window
              </button>
            </>
          )}
        </div>
      );
    }

    return null; // Should not be reached
  };

  return (
    <div className={tailwindClasses.container}>
      {renderContent()}
      {snackbarMessage && (
        <div className={`${tailwindClasses.snackbar} ${snackbarMessage.type === 'error' ? tailwindClasses.snackbarError : ''}`}>
          {snackbarMessage.message}
        </div>
      )}
    </div>
  );
}
