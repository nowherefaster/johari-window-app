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
  feedbackContainer: "mt-4 p-4 rounded-lg",
  successFeedback: "bg-green-100 text-green-700",
  errorFeedback: "bg-red-100 text-red-700",
  adjectiveContainer: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-6",
  adjectiveButton: "py-2 px-4 rounded-full border-2 border-gray-300 text-gray-700 font-medium transition duration-200 ease-in-out",
  adjectiveButtonSelected: "py-2 px-4 rounded-full border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-bold",
  adjectiveList: "mt-4 text-left p-4 bg-gray-50 rounded-lg", // Removed scrolling
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
const WelcomePage = ({ setAppState, creatorName, setCreatorName, isAppReady }) => {
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const handleStart = () => {
    if (!creatorName) {
      setSubmissionStatus({ type: 'error', message: "Please enter your name to begin." });
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
      {submissionStatus && (
        <div className={`${tailwindClasses.feedbackContainer} ${submissionStatus.type === 'error' ? tailwindClasses.errorFeedback : tailwindClasses.successFeedback}`}>
          {submissionStatus.message}
        </div>
      )}
      <button
        className={tailwindClasses.buttonPrimary}
        onClick={handleStart}
        disabled={!isAppReady}
      >
        Start
      </button>
    </>
  );
};

// Component for the second step: adjective selection
const Creator = ({ setAppState, setWindowId, creatorName, isAppReady, appId, userId, setDebugInfo }) => {
  const [selectedAdjectives, setSelectedAdjectives] = useState([]);
  const [submissionStatus, setSubmissionStatus] = useState(null);

  const firebaseContext = React.useContext(FirebaseContext);
  const db = firebaseContext.db;

  const handleCreateNewWindow = async () => {
    if (selectedAdjectives.length === 0) {
      setSubmissionStatus({ type: 'error', message: "Please select at least one adjective." });
      return;
    }

    try {
      // FIX: Use the correct collection path that matches the Firestore security rules.
      const windowsCollection = collection(db, `artifacts/${appId}/public/data/windows`);
      const docRef = await addDoc(windowsCollection, {
        creatorName: creatorName,
        selfSelections: selectedAdjectives,
        feedback: {},
        creatorId: userId, // Store the creator's user ID
        createdAt: new Date()
      });
      setWindowId(docRef.id);
      setAppState('windowCreated');
      setDebugInfo(prev => ({...prev, message: "Successfully created window in Firestore.", docId: docRef.id}));
    } catch (e) {
      console.error("Error creating document: ", e);
      setSubmissionStatus({ type: 'error', message: "Failed to create a new window. Please try again." });
      setDebugInfo(prev => ({...prev, error: e.message, message: "Firestore write failed in handleCreateNewWindow."}));
    }
  };

  const toggleAdjective = (adj) => {
    setSelectedAdjectives(prev =>
      prev.includes(adj) ? prev.filter(a => a !== adj) : [...prev, adj]
    );
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>Hello, {creatorName}!</h1>
      <p className={tailwindClasses.subheading}>Now, select the adjectives you feel best describe you.</p>
      {submissionStatus && (
        <div className={`${tailwindClasses.feedbackContainer} ${submissionStatus.type === 'error' ? tailwindClasses.errorFeedback : tailwindClasses.successFeedback}`}>
          {submissionStatus.message}
        </div>
      )}
      <div className={tailwindClasses.adjectiveContainer}>
        {adjectives.map((adj) => (
          <button
            key={adj}
            className={selectedAdjectives.includes(adj) ? tailwindClasses.adjectiveButtonSelected : tailwindClasses.adjectiveButton}
            onClick={() => toggleAdjective(adj)}
          >
            {adj}
          </button>
        ))}
      </div>
      <button
        className={tailwindClasses.buttonPrimary}
        onClick={handleCreateNewWindow}
        disabled={!isAppReady || selectedAdjectives.length === 0}
      >
        Create My Window
      </button>
    </>
  );
};

// Component for giving feedback
const FeedbackProvider = ({ windowId, creatorName, setAppState, isAppReady, appId, setDebugInfo }) => {
  const [selectedAdjectives, setSelectedAdjectives] = useState([]);
  const firebaseContext = React.useContext(FirebaseContext);
  const db = firebaseContext.db;

  const toggleAdjective = (adj) => {
    setSelectedAdjectives(prev =>
      prev.includes(adj) ? prev.filter(a => a !== adj) : [...prev, adj]
    );
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
      <p className={tailwindClasses.subheading}>Select the adjectives you feel best describe them.</p>
      <div className={tailwindClasses.adjectiveContainer}>
        {adjectives.map((adj) => (
          <button
            key={adj}
            className={selectedAdjectives.includes(adj) ? tailwindClasses.adjectiveButtonSelected : tailwindClasses.adjectiveButton}
            onClick={() => toggleAdjective(adj)}
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
  const [appState, setAppState] = useState('home'); // Initial state is now the home page
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

  // Function to create a new window from anywhere in the app
  const handleCreateNewWindow = () => {
    setWindowId(null);
    setAppState('home');
    setWindowData(null); // Clear previous window data
  };

  // Function to edit selections, only available to creator
  const handleEditSelections = () => {
    setAppState('creatorAdjectiveSelection');
    // We don't clear the windowId, so the update will be applied to the same document
  };


  // Parse URL for existing windowId
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('windowId');
    if (id) {
      setWindowId(id);
      setAppState('feedback');
    }
  }, []);

  // Firebase Initialization and Auth
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfigString = process.env.REACT_APP_FIREBASE_CONFIG;
        const appIdString = process.env.__app_id;
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

        if (appIdString) {
          setAppId(appIdString);
        } else {
          setAppId('default-app-id');
        }

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const authService = getAuth(app);
        setDb(firestore);
        setAuth(authService);

        await signInAnonymously(authService);

        onAuthStateChanged(authService, (user) => {
          if (user) {
            setUserId(user.uid);
            setIsAppReady(true);
            setDebugInfo(prev => ({...prev, userId: user.uid, appId: appIdString || 'default-app-id', message: "User signed in. App ready."}));
          } else {
            setUserId(null);
            setIsAppReady(true);
            setDebugInfo(prev => ({...prev, userId: null, appId: appIdString || 'default-app-id', message: "No user signed in. App ready."}));
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

  // Firestore Data Listener for creator's window
  useEffect(() => {
    if (!db || !windowId || !isAppReady || appState !== 'windowCreated' || !appId) return;

    setDebugInfo(prev => ({...prev, message: "onSnapshot listener for window started."}));

    const unsub = onSnapshot(doc(db, `artifacts/${appId}/public/data/windows`, windowId), (docSnap) => {
      setDebugInfo(prev => ({...prev, message: "onSnapshot callback fired.", docExists: docSnap.exists()}));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWindowData(data);
        setDebugInfo(prev => ({...prev, message: "Window data received and state updated.", windowData: data}));
      } else {
        setDebugInfo(prev => ({...prev, message: "onSnapshot callback fired, but document does not exist."}));
      }
    });

    return () => {
      setDebugInfo(prev => ({...prev, message: "onSnapshot listener for window unsubscribed."}));
      unsub();
    };
  }, [db, windowId, isAppReady, appState, appId]);

  // Fetch creator's name for feedback page
  useEffect(() => {
    if (!db || !windowId || appState !== 'feedback' || !appId) return;

    const fetchCreatorName = async () => {
      const docRef = doc(db, `artifacts/${appId}/public/data/windows`, windowId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setCreatorName(docSnap.data().creatorName);
      } else {
        setAppError("Error: This Johari Window does not exist or you don't have access to it.");
        setAppState('error');
      }
    };

    fetchCreatorName();
  }, [db, windowId, appState, appId]);


  const renderContent = () => {
    if (appError) {
      return (
        <>
          <h1 className={tailwindClasses.heading}>Application Error</h1>
          <p className={`${tailwindClasses.subheading} text-red-500 font-semibold`}>
            {appError}
          </p>
          <p className={tailwindClasses.subheading}>
            Please ensure you have set the `REACT_APP_FIREBASE_CONFIG` environment variable.
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
      </div>
    </FirebaseContext.Provider>
  );
}
