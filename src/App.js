import React, { useState, useEffect, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, getDoc } from 'firebase/firestore';

// Define the Firebase context to pass services to components
const FirebaseContext = createContext(null);

// Tailwind CSS classes for a clean, responsive, and professional look
const tailwindClasses = {
  container: "min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 overflow-x-hidden",
  card: "bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full text-center space-y-6",
  heading: "text-3xl font-bold text-gray-800",
  subheading: "text-lg text-gray-600",
  buttonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed",
  buttonSecondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out",
  input: "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500",
  linkContainer: "flex items-center space-x-2",
  linkInput: "flex-grow p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-mono text-sm",
  copyButton: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 whitespace-nowrap",
  copyButtonFeedback: "bg-green-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md whitespace-nowrap",
  snackbar: "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full text-white font-bold shadow-lg transition-transform duration-300 ease-in-out transform",
  snackbarError: "bg-red-500",
  adjectiveContainer: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6",
  adjectiveButton: "py-2 px-4 rounded-full border-2 border-gray-300 text-gray-700 font-medium transition duration-200 ease-in-out",
  adjectiveButtonSelected: "py-2 px-4 rounded-full border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-bold",
  adjectiveList: "mt-4 text-left p-4 bg-gray-50 rounded-lg",
  adjectiveListItem: "my-1",
  quadrantContainer: "grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-left",
  quadrant: "bg-gray-50 p-4 rounded-lg",
  quadrantTitle: "text-lg font-bold mb-2",
  debugPanel: "bg-gray-800 text-gray-200 p-4 rounded-lg mt-8 max-w-2xl w-full font-mono text-left text-xs",
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

// Component for the welcome page with name input
const WelcomePage = ({ setAppState, creatorName, setCreatorName, isAppReady, setSnackbarMessage }) => {
  const handleStart = () => {
    if (!creatorName) {
      setSnackbarMessage({ type: 'error', message: "Please enter your name to begin." });
      return;
    }
    setAppState('creatorAdjectiveSelection');
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>Discover Your Johari Window</h1>
      <p className={tailwindClasses.subheading}>A simple tool to help you and your team better understand your interpersonal dynamics.</p>
      <input
        type="text"
        placeholder="Enter your name"
        className={tailwindClasses.input}
        value={creatorName}
        onChange={(e) => setCreatorName(e.target.value)}
      />
      <button
        className={tailwindClasses.buttonPrimary}
        onClick={handleStart}
        disabled={!isAppReady || creatorName.trim() === ''}
      >
        Start
      </button>
    </>
  );
};

// Component for the second step: adjective selection (now also handles editing)
const Creator = ({ setAppState, setWindowId, creatorName, isAppReady, appId, userId, setDebugInfo, windowData, windowId, setSnackbarMessage }) => {
  const [selectedAdjectives, setSelectedAdjectives] = useState(windowData?.selfSelections || []);
  const firebaseContext = React.useContext(FirebaseContext);
  const db = firebaseContext.db;
  const MAX_SELECTIONS = 5;

  const handleSaveSelections = async () => {
    if (selectedAdjectives.length === 0) {
      setSnackbarMessage({ type: 'error', message: "Please select at least one adjective." });
      return;
    }

    try {
      if (windowId) {
        // Update existing document
        const docRef = doc(db, `artifacts/${appId}/public/data/windows`, windowId);
        await updateDoc(docRef, { selfSelections: selectedAdjectives });
        setAppState('windowCreated');
        setDebugInfo(prev => ({...prev, message: "Successfully updated window in Firestore.", docId: windowId}));
      } else {
        // Create new document
        const windowsCollection = collection(db, `artifacts/${appId}/public/data/windows`);
        const docRef = await addDoc(windowsCollection, {
          creatorName: creatorName,
          selfSelections: selectedAdjectives,
          feedback: {},
          creatorId: userId,
          createdAt: new Date()
        });
        setWindowId(docRef.id);
        setAppState('windowCreated');
        setDebugInfo(prev => ({...prev, message: "Successfully created window in Firestore.", docId: docRef.id}));
      }
    } catch (e) {
      console.error("Error saving document: ", e);
      setSnackbarMessage({ type: 'error', message: "Failed to save selections. Please try again." });
      setDebugInfo(prev => ({...prev, error: e.message, message: "Firestore write failed in handleSaveSelections."}));
    }
  };

  const toggleAdjective = (adj) => {
    // Log state BEFORE the click logic
    setDebugInfo(prev => ({
      ...prev,
      preClickState: {
        lastAdjectiveClick: adj,
        selectedCount: selectedAdjectives.length,
        isAdjectiveSelected: selectedAdjectives.includes(adj)
      }
    }));

    const isSelected = selectedAdjectives.includes(adj);

    // If the user is trying to select a new adjective and has reached the max limit, show the error immediately.
    if (!isSelected && selectedAdjectives.length >= MAX_SELECTIONS) {
        setSnackbarMessage({ type: 'error', message: `You can only select a maximum of ${MAX_SELECTIONS} adjectives.` });
        setDebugInfo(prev => ({ ...prev, postClickState: { toggleAction: 'Max selections reached, snackbar set' } }));
        return;
    }
    
    // Toggle the adjective
    if (isSelected) {
      const newSelections = selectedAdjectives.filter(a => a !== adj);
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null); // Clear message when deselecting
      setDebugInfo(prev => ({ ...prev, postClickState: { toggleAction: 'Deselecting adjective', newCount: newSelections.length } }));
    } else {
      const newSelections = [...selectedAdjectives, adj];
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null); // Clear message when selecting
      setDebugInfo(prev => ({ ...prev, postClickState: { toggleAction: 'Selecting new adjective', newCount: newSelections.length } }));
    }
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>{windowId ? 'Edit Your Selections' : `Hello, ${creatorName}!`}</h1>
      <p className={tailwindClasses.subheading}>Now, select the five adjectives you feel best describe you.</p>
      <div className={tailwindClasses.adjectiveContainer}>
        {adjectives.map((adj) => (
          <button
            key={adj}
            className={selectedAdjectives.includes(adj) ? tailwindClasses.adjectiveButtonSelected : tailwindClasses.adjectiveButton}
            onClick={() => toggleAdjective(adj)}
            disabled={!selectedAdjectives.includes(adj) && selectedAdjectives.length >= MAX_SELECTIONS}
          >
            {adj}
          </button>
        ))}
      </div>
      <button
        className={tailwindClasses.buttonPrimary}
        onClick={handleSaveSelections}
        disabled={!isAppReady || selectedAdjectives.length === 0}
      >
        {windowId ? 'Update My Window' : 'Create My Window'}
      </button>
    </>
  );
};

// Component for giving feedback
const FeedbackProvider = ({ windowId, creatorName, setAppState, isAppReady, appId, setDebugInfo, setSnackbarMessage }) => {
  const [selectedAdjectives, setSelectedAdjectives] = useState([]);
  const firebaseContext = React.useContext(FirebaseContext);
  const db = firebaseContext.db;
  const MAX_SELECTIONS = 5;

  const toggleAdjective = (adj) => {
    // Log state BEFORE the click logic
    setDebugInfo(prev => ({
      ...prev,
      preClickState: {
        lastAdjectiveClick: adj,
        selectedCount: selectedAdjectives.length,
        isAdjectiveSelected: selectedAdjectives.includes(adj)
      }
    }));

    const isSelected = selectedAdjectives.includes(adj);

    // If the user is trying to select a new adjective and has reached the max limit, show the error immediately.
    if (!isSelected && selectedAdjectives.length >= MAX_SELECTIONS) {
        setSnackbarMessage({ type: 'error', message: `You can only select a maximum of ${MAX_SELECTIONS} adjectives.` });
        setDebugInfo(prev => ({ ...prev, postClickState: { toggleAction: 'Max selections reached, snackbar set (Feedback Provider)' } }));
        return;
    }
    
    // Toggle the adjective
    if (isSelected) {
      const newSelections = selectedAdjectives.filter(a => a !== adj);
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null); // Clear message when deselecting
      setDebugInfo(prev => ({ ...prev, postClickState: { toggleAction: 'Deselecting adjective (Feedback Provider)', newCount: newSelections.length } }));
    } else {
      const newSelections = [...selectedAdjectives, adj];
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null); // Clear message when selecting
      setDebugInfo(prev => ({ ...prev, postClickState: { toggleAction: 'Selecting new adjective (Feedback Provider)', newCount: newSelections.length } }));
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/windows`, windowId);
      const windowDoc = await getDoc(docRef);
      const currentFeedback = windowDoc.data().feedback || {};

      const feedbackId = new Date().toISOString();
      const newFeedback = {
        ...currentFeedback,
        [feedbackId]: selectedAdjectives,
      };

      await updateDoc(docRef, { feedback: newFeedback });
      setAppState('submitted');
      setDebugInfo(prev => ({...prev, message: "Successfully submitted feedback.", docId: windowId}));
    } catch (e) {
      console.error("Error submitting feedback: ", e);
      setDebugInfo(prev => ({...prev, error: e.message, message: "Firestore write failed in handleSubmitFeedback."}));
    }
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>Give Feedback to {creatorName}</h1>
      <p className={tailwindClasses.subheading}>Now, select the five adjectives you feel best describe them.</p>
      <div className={tailwindClasses.adjectiveContainer}>
        {adjectives.map((adj) => (
          <button
            key={adj}
            className={selectedAdjectives.includes(adj) ? tailwindClasses.adjectiveButtonSelected : tailwindClasses.adjectiveButton}
            onClick={() => toggleAdjective(adj)}
            disabled={!selectedAdjectives.includes(adj) && selectedAdjectives.length >= MAX_SELECTIONS}
          >
            {adj}
          </button>
        ))}
      </div>
      <button
        className={tailwindClasses.buttonPrimary}
        onClick={handleSubmitFeedback}
        disabled={!isAppReady || selectedAdjectives.length === 0}
      >
        Submit Feedback
      </button>
    </>
  );
};

// Component to display the creator's window
const WindowDisplay = ({ creatorLink, windowData, setAppState, setWindowId, isAppReady, handleCreateNewWindow, userId, handleEditSelections }) => {
  const [copyButtonText, setCopyButtonText] = useState("Copy Link");

  // Function to copy link and provide feedback
  const handleCopyLink = () => {
    const linkInput = document.getElementById('creatorLinkInput');
    linkInput.select();
    document.execCommand('copy');
    setCopyButtonText("Copied!");
    setTimeout(() => setCopyButtonText("Copy Link"), 2000);
  };

  // Logic to calculate the four quadrants
  const selfSelections = windowData?.selfSelections || [];
  const allFeedback = windowData?.feedback || {};
  const feedbackSelections = new Set();
  Object.values(allFeedback).forEach(arr => arr.forEach(adj => feedbackSelections.add(adj)));

  const arena = adjectives.filter(adj => selfSelections.includes(adj) && feedbackSelections.has(adj));
  const blindSpot = adjectives.filter(adj => !selfSelections.includes(adj) && feedbackSelections.has(adj));
  const facade = adjectives.filter(adj => selfSelections.includes(adj) && !feedbackSelections.has(adj));
  const unknown = adjectives.filter(adj => !selfSelections.includes(adj) && !feedbackSelections.has(adj));

  const responsesCount = Object.keys(allFeedback).length;

  return (
    <>
      <h1 className={tailwindClasses.heading}>{windowData.creatorName}'s Johari Window</h1>
      <p className={tailwindClasses.subheading}>Share this link with your teammates to get feedback!</p>
      <div className="flex flex-col items-center justify-center space-y-4 w-full">
        <input
          type="text"
          id="creatorLinkInput"
          readOnly
          value={creatorLink}
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

      <p className="text-lg font-bold text-gray-800 mt-4">{responsesCount} Teammate Responses</p>

      <div className={tailwindClasses.quadrantContainer}>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Arena (Open)</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {arena.length > 0 ? (
              arena.map(adj => <li key={adj} className={tailwindClasses.adjectiveListItem}>{adj}</li>)
            ) : (
              <p>No adjectives in this quadrant yet.</p>
            )}
          </ul>
        </div>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Blind Spot</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {blindSpot.length > 0 ? (
              blindSpot.map(adj => <li key={adj} className={tailwindClasses.adjectiveListItem}>{adj}</li>)
            ) : (
              <p>No adjectives in this quadrant yet.</p>
            )}
          </ul>
        </div>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Facade (Hidden)</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {facade.length > 0 ? (
              facade.map(adj => <li key={adj} className={tailwindClasses.adjectiveListItem}>{adj}</li>)
            ) : (
              <p>No adjectives in this quadrant yet.</p>
            )}
          </ul>
        </div>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Unknown</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {unknown.length > 0 ? (
              unknown.map(adj => <li key={adj} className={tailwindClasses.adjectiveListItem}>{adj}</li>)
            ) : (
              <p>No adjectives in this quadrant yet.</p>
            )}
          </ul>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 justify-center">
        {userId && windowData.creatorId === userId && (
          <button
            className={tailwindClasses.buttonSecondary}
            onClick={handleEditSelections}
          >
            Edit My Selections
          </button>
        )}
        <button
          className={tailwindClasses.buttonPrimary}
          onClick={handleCreateNewWindow}
        >
          Create Another Window
        </button>
      </div>
    </>
  );
};

// Main App component
export default function App() {
  const [appState, setAppState] = useState('home');
  const [windowId, setWindowId] = useState(null);
  const [creatorName, setCreatorName] = useState('');
  const [windowData, setWindowData] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAppReady, setIsAppReady] = useState(false);
  const [appError, setAppError] = useState(null);
  const [appId, setAppId] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [snackbarMessage, setSnackbarMessage] = useState(null);

  const handleCreateNewWindow = () => {
    setWindowId(null);
    setAppState('home');
    setWindowData(null);
  };

  const handleEditSelections = () => {
    setAppState('creatorAdjectiveSelection');
  };

  useEffect(() => {
    // Automatically hide the snackbar after a few seconds
    if (snackbarMessage) {
      const timer = setTimeout(() => {
        setSnackbarMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [snackbarMessage]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('windowId');
    if (id) {
      setWindowId(id);
      // We don't set a state here, as the onSnapshot will handle the update
    }
  }, []);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : process.env.REACT_APP_FIREBASE_CONFIG;
        const appIdString = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        let firebaseConfig = {};

        if (!firebaseConfigString) {
          setAppError("Firebase configuration is missing. Please set the REACT_APP_FIREBASE_CONFIG environment variable.");
          setDebugInfo(prev => ({...prev, error: "REACT_APP_FIREBASE_CONFIG is missing."}));
          return;
        }

        try {
          firebaseConfig = JSON.parse(firebaseConfigString);
        } catch (e) {
          setAppError("Firebase configuration is malformed. Check the JSON syntax of REACT_APP_FIREBASE_CONFIG.");
          setDebugInfo(prev => ({...prev, error: e.message, message: "Firebase init failed due to malformed JSON."}));
          return;
        }

        if (!firebaseConfig || !firebaseConfig.projectId) {
          setAppError("Firebase configuration is invalid. The 'projectId' is missing.");
          setDebugInfo(prev => ({...prev, error: "'projectId' not provided in firebase.initializeApp.", message: "Firebase init failed."}));
          return;
        }

        setAppId(appIdString);

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authService = getAuth(app);
        setDb(firestore);
        setAuth(authService);

        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (initialAuthToken) {
          await signInWithCustomToken(authService, initialAuthToken);
        } else {
          await signInAnonymously(authService);
        }

        onAuthStateChanged(authService, (user) => {
          if (user) {
            setUserId(user.uid);
            setIsAppReady(true);
            setDebugInfo(prev => ({...prev, userId: user.uid, appId: appIdString, message: "User signed in. App ready."}));
          } else {
            setUserId(null);
            setIsAppReady(true);
            setDebugInfo(prev => ({...prev, userId: null, appId: appIdString, message: "No user signed in. App ready."}));
          }
        });
      } catch (e) {
        console.error("Firebase initialization failed:", e);
        setAppError("Failed to initialize Firebase. Check your configuration.");
        setDebugInfo(prev => ({...prev, error: e.message, message: "Firebase init failed."}));
        setIsAppReady(false);
      }
    };

    if (!db) {
      initializeFirebase();
    }
  }, [db]);

  useEffect(() => {
    if (!db || !windowId || !isAppReady || !appId) return;

    setDebugInfo(prev => ({...prev, message: "onSnapshot listener for window started."}));

    const unsub = onSnapshot(doc(db, `artifacts/${appId}/public/data/windows`, windowId), (docSnap) => {
      setDebugInfo(prev => ({...prev, message: "onSnapshot callback fired.", docExists: docSnap.exists()}));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWindowData(data);
        setCreatorName(data.creatorName);
        if (data.creatorId === userId) {
          setAppState('windowCreated');
        } else {
          setAppState('feedback');
        }
        setDebugInfo(prev => ({...prev, message: "Window data received and state updated.", windowData: data}));
      } else {
        setAppError("Error: This Johari Window does not exist or you don't have access to it.");
        setAppState('error');
        setDebugInfo(prev => ({...prev, message: "onSnapshot callback fired, but document does not exist."}));
      }
    });

    return () => {
      setDebugInfo(prev => ({...prev, message: "onSnapshot listener for window unsubscribed."}));
      unsub();
    };
  }, [db, windowId, isAppReady, appId, userId]);


  const renderContent = () => {
    if (appError) {
      return (
        <>
          <h1 className={tailwindClasses.heading}>Application Error</h1>
          <p className={`${tailwindClasses.subheading} text-red-500 font-semibold`}>
            {appError}
          </p>
        </>
      );
    }

    if (!isAppReady) {
      return (
        <>
          <h1 className={tailwindClasses.heading}>Loading...</h1>
          <p className={tailwindClasses.subheading}>
            Initializing application. Please wait.
          </p>
        </>
      );
    }

    switch (appState) {
      case 'home':
        return (
          <WelcomePage
            setAppState={setAppState}
            creatorName={creatorName}
            setCreatorName={setCreatorName}
            isAppReady={isAppReady}
            setSnackbarMessage={setSnackbarMessage}
          />
        );
      case 'creatorAdjectiveSelection':
        return (
          <Creator
            setAppState={setAppState}
            setWindowId={setWindowId}
            creatorName={creatorName}
            isAppReady={isAppReady}
            userId={userId}
            appId={appId}
            setDebugInfo={setDebugInfo}
            windowData={windowData}
            windowId={windowId}
            setSnackbarMessage={setSnackbarMessage}
          />
        );
      case 'feedback':
        return (
          <FeedbackProvider
            windowId={windowId}
            creatorName={creatorName}
            setAppState={setAppState}
            isAppReady={isAppReady}
            appId={appId}
            setDebugInfo={setDebugInfo}
            setSnackbarMessage={setSnackbarMessage}
          />
        );
      case 'error':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Error</h1>
            <p className={tailwindClasses.subheading}>
              The link you're using is invalid. Please check the URL or ask the creator to send you a new link.
            </p>
          </>
        );
      case 'windowCreated':
        const creatorLink = `${window.location.origin}${window.location.pathname}?windowId=${windowId}`;
        return (
          <>
            {windowData ? (
              <WindowDisplay
                creatorLink={creatorLink}
                windowData={windowData}
                setAppState={setAppState}
                setWindowId={setWindowId}
                isAppReady={isAppReady}
                handleCreateNewWindow={handleCreateNewWindow}
                userId={userId}
                handleEditSelections={handleEditSelections}
              />
            ) : (
              <div>
                <h1 className={tailwindClasses.heading}>Your window is ready!</h1>
                <p className={tailwindClasses.subheading}>
                  Share this link to get feedback from your teammates.
                </p>
                <div className="flex flex-col items-center justify-center space-y-4 w-full">
                  <input
                    type="text"
                    id="creatorLinkInput"
                    readOnly
                    value={creatorLink}
                    className={tailwindClasses.input}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    className={tailwindClasses.copyButton}
                    onClick={() => {
                        const linkInput = document.getElementById('creatorLinkInput');
                        linkInput.select();
                        document.execCommand('copy');
                    }}
                  >
                    Copy Link
                  </button>
                </div>
                <button className={tailwindClasses.buttonSecondary} onClick={handleCreateNewWindow}>
                  Create Another Window
                </button>
              </div>
            )}
          </>
        );
      case 'submitted':
        const handleUpdateFeedback = () => setAppState('feedback');
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
        {snackbarMessage && (
            <div className={`${tailwindClasses.snackbar} ${snackbarMessage.type === 'error' ? tailwindClasses.snackbarError : ''}`}>
                {snackbarMessage.message}
            </div>
        )}
      </div>
    </FirebaseContext.Provider>
  );
}
