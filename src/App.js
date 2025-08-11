import React, { useState, useEffect, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, addDoc, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore';

// Define the Firebase context to pass services to components
const FirebaseContext = createContext(null);

// Tailwind CSS classes for a clean, professional look
const tailwindClasses = {
  container: "min-h-screen bg-gray-50 flex flex-col items-center p-4 overflow-x-hidden font-inter",
  card: "bg-white p-8 rounded-lg shadow-xl max-w-3xl w-full text-center space-y-6 mt-16",
  heading: "text-3xl font-bold text-gray-800",
  subheading: "text-lg text-gray-600",
  buttonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed",
  buttonSecondary: "bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out",
  buttonGoogle: "flex items-center justify-center w-full bg-white border border-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg shadow-md hover:bg-gray-100 transition-colors duration-200 space-x-2",
  buttonGoogleIcon: "w-5 h-5",
  input: "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
  linkContainer: "flex items-center space-x-2",
  linkInput: "flex-grow p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-mono text-sm",
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
  adminLinkContainer: "w-full text-center mt-auto pb-4", // New class for the link container
};

const adjectives = [
  "Able", "Accepting", "Adaptable", "Bold", "Brave", "Calm", "Caring", "Cheerful", "Clever", "Complex", "Confident", "Dependable",
  "Dignified", "Energetic", "Extroverted", "Friendly", "Giving", "Happy", "Helpful", "Idealistic", "Independent", "Ingenious",
  "Intelligent", "Introverted", "Kind", "Knowledgeable", "Logical", "Loving", "Mature", "Modest", "Nervous", "Observant",
  "Organized", "Patient", "Powerful", "Proud", "Quiet", "Reflective", "Relaxed", "Religious", "Responsive", "Searching",
  "Self-Assertive", "Self-Conscious", "Sensible", "Sentimental", "Shy", "Silly", "Spontaneous", "Sympathetic", "Tense",
  "Trustworthy", "Warm", "Wise", "Witty"
];

// Helper component for the floating help button
const HelpButton = ({ onClick }) => (
  <button
    className="fixed top-4 right-4 z-50 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors duration-200"
    onClick={onClick}
    aria-label="Open help guide"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm-1 15h2v-6h-2v6zm0-8h2V7h-2v2z" />
    </svg>
  </button>
);

// Helper component for the help modal
const HelpModal = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-75 overflow-y-auto" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-full bg-white rounded-lg shadow-xl p-6 md:p-8" onClick={e => e.stopPropagation()}>
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
          onClick={onClose}
          aria-label="Close help guide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Guide to the Johari Window Team Exercise</h2>
        <div className="space-y-6 text-gray-700 overflow-y-auto max-h-[80vh]">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">What is the Johari Window?</h3>
            <p>
              The Johari Window is a communication tool designed to help people better understand their relationship with themselves and others. It's a simple and powerful way to map self-perception and external perception, leading to greater self-awareness and team dynamics.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">The Four Quadrants</h3>
            <div className="space-y-4">
              <p>
                <strong>Arena (Open Self):</strong> This quadrant contains adjectives selected by both you and your teammates. These are the traits you both recognize, representing your open and public self.
              </p>
              <p>
                <strong>Blind Spot:</strong> This quadrant contains adjectives selected by your teammates but not by you. These are traits others see in you that you are unaware of, offering a valuable opportunity for self-discovery.
              </p>
              <p>
                <strong>Facade (Hidden Self):</strong> This quadrant contains adjectives selected by you but not by your teammates. These are traits you know about yourself but keep hidden from others.
              </p>
              <p>
                <strong>Unknown:</strong> This quadrant contains adjectives that were not selected by either you or your teammates. These represent traits that are yet to be discovered by anyone.
              </p>
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">How to Use this Tool</h3>
            <p>This tool is designed to be a simple, 3-step process for you and your team:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>Step 1: Create your window.</strong> Begin by entering your name and selecting the five adjectives that you feel best describe you.</li>
              <li><strong>Step 2: Share the link.</strong> Once you've created your window, a unique link will be generated. Share this link with your teammates so they can provide their feedback.</li>
              <li><strong>Step 3: View your results.</strong> As feedback is submitted, your Johari Window will be populated in real-time, helping you visualize the collective perceptions and start a conversation.</li>
            </ol>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Tips for a Productive Discussion</h3>
            <p>
              The Johari Window is most powerful when used as a starting point for open, honest, and constructive dialogue. Here are a few tips for your team discussion:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Focus on "Why":</strong> Instead of just looking at the adjectives, discuss the specific behaviors that led to certain perceptions. For example, if "dependable" is in your Blind Spot, ask your teammates for an example of when you demonstrated this quality.</li>
              <li><strong>Practice Active Listening:</strong> Listen to your teammates' feedback without becoming defensive. Remember, this is a tool for self-discovery and growth, not a critique.</li>
              <li><strong>Be Constructive, Not Critical:</strong> When giving feedback, focus on observable behaviors and use "I" statements. For example, say "I noticed you are very organized when you lead meetings," instead of "You are organized."</li>
              <li><strong>Celebrate Strengths:</strong> Pay special attention to adjectives in the Arena (Open Self) and Blind Spot. These are your known and unknown strengths!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};


// Component for the welcome page with name input
const WelcomePage = ({ setAppState, creatorName, setCreatorName, isAppReady }) => {
  const handleStart = () => {
    if (!creatorName) {
      // setSnackbarMessage({ type: 'error', message: "Please enter your name to begin." });
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
    const isSelected = selectedAdjectives.includes(adj);
    
    if (isSelected) {
      const newSelections = selectedAdjectives.filter(a => a !== adj);
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null);
    } else {
      if (selectedAdjectives.length >= MAX_SELECTIONS) {
        setSnackbarMessage({ type: 'error', message: `You can only select a maximum of ${MAX_SELECTIONS} adjectives.` });
        return;
      }
      const newSelections = [...selectedAdjectives, adj];
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null);
    }
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>{windowId ? 'Edit Your Selections' : `Hello, ${creatorName}!`}</h1>
      <p className={tailwindClasses.subheading}>Now, select the five adjectives you feel best describe you.</p>
      <div className={tailwindClasses.adjectiveContainer}>
        {adjectives.map((adj) => {
          const isSelected = selectedAdjectives.includes(adj);
          const isAtMax = selectedAdjectives.length >= MAX_SELECTIONS;
          
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
              onClick={() => toggleAdjective(adj)}
            >
              {adj}
            </button>
          );
        })}
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
const FeedbackProvider = ({ windowId, creatorName, setAppState, isAppReady, appId, userId, setDebugInfo, setSnackbarMessage }) => {
  const [selectedAdjectives, setSelectedAdjectives] = useState([]);
  const [feedbackDocId, setFeedbackDocId] = useState(null);
  const firebaseContext = React.useContext(FirebaseContext);
  const db = firebaseContext.db;
  const MAX_SELECTIONS = 5;

  useEffect(() => {
    if (!db || !windowId || !userId) return;

    const fetchExistingFeedback = async () => {
      try {
        const feedbackCollectionRef = collection(db, `artifacts/${appId}/public/data/windows/${windowId}/feedback`);
        const q = query(feedbackCollectionRef, where("creatorId", "==", userId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const doc = querySnapshot.docs[0];
          setFeedbackDocId(doc.id);
          setSelectedAdjectives(doc.data().selections);
          setDebugInfo(prev => ({...prev, message: `Existing feedback found and loaded for userId: ${userId}`}));
        } else {
          setDebugInfo(prev => ({...prev, message: `No existing feedback found for userId: ${userId}`}));
        }
      } catch (e) {
        console.error("Error fetching existing feedback: ", e);
        setDebugInfo(prev => ({...prev, error: e.message, message: "Failed to fetch existing feedback."}));
      }
    };

    fetchExistingFeedback();
  }, [db, windowId, userId, appId, setDebugInfo]);

  const toggleAdjective = (adj) => {
    const isSelected = selectedAdjectives.includes(adj);
    
    if (isSelected) {
      const newSelections = selectedAdjectives.filter(a => a !== adj);
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null);
    } else {
      if (selectedAdjectives.length >= MAX_SELECTIONS) {
        setSnackbarMessage({ type: 'error', message: `You can only select a maximum of ${MAX_SELECTIONS} adjectives.` });
        return;
      }
      const newSelections = [...selectedAdjectives, adj];
      setSelectedAdjectives(newSelections);
      setSnackbarMessage(null);
    }
  };

  const handleSubmitFeedback = async () => {
    if (selectedAdjectives.length === 0) {
      setSnackbarMessage({ type: 'error', message: "Please select at least one adjective." });
      return;
    }

    try {
      const feedbackCollection = collection(db, `artifacts/${appId}/public/data/windows/${windowId}/feedback`);

      if (feedbackDocId) {
        // Update existing document
        const docRef = doc(db, `artifacts/${appId}/public/data/windows/${windowId}/feedback`, feedbackDocId);
        await updateDoc(docRef, { selections: selectedAdjectives });
        setDebugInfo(prev => ({...prev, message: `Successfully updated feedback document ID: ${feedbackDocId}`}));
      } else {
        // Create new document
        await addDoc(feedbackCollection, {
          selections: selectedAdjectives,
          creatorId: userId,
          createdAt: new Date(),
        });
        setDebugInfo(prev => ({...prev, message: "Successfully submitted NEW feedback to subcollection."}));
      }
      setAppState('submitted');
    } catch (e) {
      console.error("Error submitting feedback: ", e);
      setSnackbarMessage({ type: 'error', message: "Failed to submit feedback. Please try again." });
      setDebugInfo(prev => ({...prev, error: e.message, message: "Firestore write failed in handleSubmitFeedback."}));
    }
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>Give Feedback to {creatorName}</h1>
      <p className={tailwindClasses.subheading}>Now, select the five adjectives you feel best describe them.</p>
      <div className={tailwindClasses.adjectiveContainer}>
        {adjectives.map((adj) => {
          const isSelected = selectedAdjectives.includes(adj);
          const isAtMax = selectedAdjectives.length >= MAX_SELECTIONS;

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
              onClick={() => toggleAdjective(adj)}
            >
              {adj}
            </button>
          );
        })}
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

// Component to display the creator's window (used by both admins and creators)
const WindowDisplay = ({ windowData, setAppState, setWindowId, handleCreateNewWindow, userId, handleEditSelections, isAdmin }) => {
  const [copyButtonText, setCopyButtonText] = useState("Copy Link");

  // Function to copy link and provide feedback (only for non-admins)
  const handleCopyLink = () => {
    if (isAdmin) return;
    const creatorLink = `${window.location.origin}${window.location.pathname}?windowId=${windowData.windowId}`;
    const linkInput = document.getElementById('creatorLinkInput');
    linkInput.select();
    document.execCommand('copy');
    setCopyButtonText("Copied!");
    setTimeout(() => setCopyButtonText("Copy Link"), 2000);
  };

  // Logic to calculate the four quadrants
  const selfSelections = windowData?.selfSelections || [];
  const allFeedback = windowData?.feedback || [];
  const feedbackSelections = new Set();
  
  const allSelections = [...selfSelections];
  allFeedback.forEach(feedbackDoc => {
      allSelections.push(...feedbackDoc.selections);
  });

  const masterCounts = {};
  allSelections.forEach(adj => {
      masterCounts[adj] = (masterCounts[adj] || 0) + 1;
  });

  allFeedback.forEach(feedbackDoc => {
      feedbackDoc.selections.forEach(adj => {
          feedbackSelections.add(adj);
      });
  });

  const arena = adjectives.filter(adj => selfSelections.includes(adj) && feedbackSelections.has(adj));
  const blindSpot = adjectives.filter(adj => !selfSelections.includes(adj) && feedbackSelections.has(adj));
  const facade = adjectives.filter(adj => selfSelections.includes(adj) && !feedbackSelections.has(adj));
  const unknown = adjectives.filter(adj => !selfSelections.includes(adj) && !feedbackSelections.has(adj));

  const responsesCount = allFeedback.length;

  const renderAdjectiveList = (adjectiveArray) => {
      return adjectiveArray.length > 0 ? (
          adjectiveArray.map(adj => {
              const count = masterCounts[adj] || 0;
              return (
                  <li key={adj} className={`${tailwindClasses.adjectiveListItem} flex justify-between items-center`}>
                      <span>{adj}</span>
                      {count > 1 && (
                          <span className="text-sm font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                              {count}
                          </span>
                      )}
                  </li>
              );
          })
      ) : (
          <p>No adjectives in this quadrant yet.</p>
      );
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>{windowData.creatorName}'s Johari Window</h1>
      {!isAdmin && <p className={tailwindClasses.subheading}>Share this link with your teammates to get feedback!</p>}
      
      {!isAdmin && (
        <div className="flex flex-col items-center justify-center space-y-4 w-full">
          <input
            type="text"
            id="creatorLinkInput"
            readOnly
            value={`${window.location.origin}${window.location.pathname}?windowId=${windowData.windowId}`}
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
      )}

      <p className="text-lg font-bold text-gray-800 mt-4">{responsesCount} Teammate Response{responsesCount !== 1 ? 's' : ''}</p>

      <div className={tailwindClasses.quadrantContainer}>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Arena (Open)</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {renderAdjectiveList(arena)}
          </ul>
        </div>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Blind Spot</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {renderAdjectiveList(blindSpot)}
          </ul>
        </div>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Facade (Hidden)</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {renderAdjectiveList(facade)}
          </ul>
        </div>
        <div className={tailwindClasses.quadrant}>
          <h3 className={tailwindClasses.quadrantTitle}>Unknown</h3>
          <ul className={tailwindClasses.adjectiveList}>
            {renderAdjectiveList(unknown)}
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
          onClick={() => isAdmin ? setAppState('adminDashboard') : handleCreateNewWindow()}
        >
          {isAdmin ? 'Back to Dashboard' : 'Create Another Window'}
        </button>
      </div>
    </>
  );
};


// New component for the admin dashboard
const AdminDashboard = ({ setAppState, setWindowId, allWindowsData, handleSignOut }) => {
  const handleViewWindow = (id) => {
    setWindowId(id);
    setAppState('adminViewWindow');
  };

  return (
    <>
      <h1 className={tailwindClasses.heading}>Admin Dashboard</h1>
      <p className={tailwindClasses.subheading}>Click a name to view their Johari Window.</p>
      {allWindowsData.length > 0 ? (
        <div className="space-y-2 mt-6 max-h-96 overflow-y-auto w-full">
          {allWindowsData.map(window => (
            <button
              key={window.id}
              onClick={() => handleViewWindow(window.id)}
              className="w-full text-left p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors duration-200 shadow-sm"
            >
              <div className="text-gray-800 font-semibold">{window.creatorName}</div>
              <div className="text-gray-500 text-sm">{window.responsesCount} teammate response(s)</div>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-gray-500">No Johari Windows have been created yet.</p>
      )}
      <button className={tailwindClasses.buttonSecondary} onClick={handleSignOut}>
        Sign Out
      </button>
    </>
  );
};

// Main App component
export default function App() {
  const [appState, setAppState] = useState('home');
  const [windowId, setWindowId] = useState(null);
  const [creatorName, setCreatorName] = useState('');
  const [windowData, setWindowData] = useState(null);
  const [allWindowsData, setAllWindowsData] = useState([]);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUids, setAdminUids] = useState([]);
  const [isAppReady, setIsAppReady] = useState(false);
  const [appError, setAppError] = useState(null);
  const [adminSignInError, setAdminSignInError] = useState(null);
  const [appId, setAppId] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const [snackbarMessage, setSnackbarMessage] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);


  const handleCreateNewWindow = () => {
    setWindowId(null);
    setAppState('home');
    setWindowData(null);
  };

  const handleEditSelections = () => {
    setAppState('creatorAdjectiveSelection');
  };

  const signInWithGoogle = async () => {
    setAdminSignInError(null);
    try {
      setDebugInfo(prev => ({...prev, message: "Attempting Google sign-in via redirect..."}));
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error("Google Sign-In Error: ", e);
      setAdminSignInError("Google sign in failed. Check the debug log for details.");
      setDebugInfo(prev => ({...prev, message: "Failed to initiate Google sign-in redirect.", error: e.message}));
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setAppState('home');
      setWindowId(null);
      setIsAdmin(false);
      setUserId(null);
      setAllWindowsData([]);
    } catch (e) {
      console.error("Sign-out error: ", e);
      setSnackbarMessage({ type: 'error', message: "Sign out failed. Please try again." });
    }
  };

  useEffect(() => {
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
    }
  }, []);

  // Effect to initialize Firebase and auth listener
  useEffect(() => {
    if (initialized) return;

    const initializeFirebase = async () => {
        try {
            const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
            const appIdString = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

            if (!firebaseConfigString) {
                setAppError("Firebase configuration is missing.");
                setDebugInfo(prev => ({...prev, error: "Firebase config is missing."}));
                return;
            }

            const firebaseConfig = JSON.parse(firebaseConfigString);
            if (!firebaseConfig || !firebaseConfig.projectId) {
                setAppError("Firebase configuration is invalid.");
                setDebugInfo(prev => ({...prev, error: "'projectId' not provided.", message: "Firebase init failed."}));
                return;
            }

            setAppId(appIdString);
            const app = initializeApp(firebaseConfig);
            const firestore = getFirestore(app);
            const authService = getAuth(app);
            setDb(firestore);
            setAuth(authService);
            setInitialized(true);
            setDebugInfo(prev => ({...prev, message: "Firebase initialized."}));

            // Handle redirect result first
            getRedirectResult(authService).then((result) => {
                if (result) {
                    setDebugInfo(prev => ({...prev, message: "Redirect result received. User signed in.", user: result.user}));
                    // The auth listener below will handle the rest
                }
            }).catch((error) => {
                console.error("Error during redirect result:", error);
                setAdminSignInError("Google sign in failed. Check the debug log for details.");
                setDebugInfo(prev => ({...prev, message: "Error processing redirect result.", error: error.code, detail: error.message}));
            });

            // Set up the main auth listener
            const unsubscribe = onAuthStateChanged(authService, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    setIsAuthenticated(true);
                    setDebugInfo(prev => ({...prev, userId: user.uid, message: "User signed in."}));
                } else {
                    try {
                      const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                      if (token) {
                          await signInWithCustomToken(authService, token);
                          setDebugInfo(prev => ({...prev, message: "Signed in with custom token."}));
                      } else {
                          await signInAnonymously(authService);
                          setDebugInfo(prev => ({...prev, message: "Signed in anonymously."}));
                      }
                    } catch (e) {
                      setAppError("Failed to sign in. Check your Firebase configuration.");
                      setDebugInfo(prev => ({...prev, error: e.message, message: "Initial sign-in failed."}));
                    }
                }
            });

            return () => unsubscribe();

        } catch (e) {
            console.error("Firebase initialization failed:", e);
            setAppError("Failed to initialize Firebase. Check your configuration.");
            setDebugInfo(prev => ({...prev, error: e.message, message: "Firebase init failed."}));
            setIsAppReady(false);
        }
    };

    initializeFirebase();
}, [initialized]);

// Effect to fetch admin UIDs and determine admin status
useEffect(() => {
  if (!db || !appId || !isAuthenticated) return;

  const fetchAdminUids = async () => {
      try {
          const adminsRef = collection(db, `artifacts/${appId}/public/data/admins`);
          const q = query(adminsRef);
          const querySnapshot = await getDocs(q);
          const uids = querySnapshot.docs.map(doc => doc.id);
          setAdminUids(uids);
          setIsAdmin(uids.includes(userId));
          setIsAppReady(true);
          setDebugInfo(prev => ({...prev, message: "Admin UIDs fetched.", adminUids: uids}));
      } catch (e) {
          console.error("Error fetching admin UIDs:", e);
          setDebugInfo(prev => ({...prev, error: e.message, message: "Failed to fetch admin UIDs. App will function in non-admin mode."}));
          setIsAdmin(false);
          setIsAppReady(true);
      }
  };

  fetchAdminUids();
}, [db, appId, isAuthenticated, userId]);


  useEffect(() => {
    if (!db || !windowId || !isAppReady || !appId) return;

    setDebugInfo(prev => ({...prev, message: "onSnapshot listener for window started."}));

    const unsubWindow = onSnapshot(doc(db, `artifacts/${appId}/public/data/windows`, windowId), (docSnap) => {
      setDebugInfo(prev => ({...prev, message: "onSnapshot callback fired for main window.", docExists: docSnap.exists()}));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWindowData(prevData => ({ ...prevData, creatorName: data.creatorName, selfSelections: data.selfSelections, creatorId: data.creatorId, windowId: docSnap.id }));
        setCreatorName(data.creatorName);

        // Determine app state based on user type and data
        if (isAdmin) {
          setAppState('adminViewWindow');
        } else if (data.creatorId === userId) {
          setAppState('windowCreated');
        } else {
          setAppState('feedback');
        }
        setDebugInfo(prev => ({...prev, message: "Window data received and state updated.", creatorData: data}));
      } else {
        setAppError("Error: This Johari Window does not exist or you don't have access to it.");
        setAppState('error');
        setDebugInfo(prev => ({...prev, message: "onSnapshot callback fired, but document does not exist."}));
      }
    });

    const unsubFeedback = onSnapshot(collection(db, `artifacts/${appId}/public/data/windows/${windowId}/feedback`), (querySnapshot) => {
      const feedbackDocs = [];
      querySnapshot.forEach(doc => {
        feedbackDocs.push(doc.data());
      });
      setWindowData(prevData => ({ ...prevData, feedback: feedbackDocs }));
      setDebugInfo(prev => ({...prev, message: "Feedback data received from subcollection.", feedbackData: feedbackDocs}));
    });

    return () => {
      setDebugInfo(prev => ({...prev, message: "onSnapshot listeners unsubscribed."}));
      unsubWindow();
      unsubFeedback();
    };
  }, [db, windowId, isAppReady, appId, userId, isAdmin]);

  // New useEffect to fetch all windows for the admin dashboard
  useEffect(() => {
    if (!db || !isAppReady || !appId || !isAdmin) return;

    setDebugInfo(prev => ({...prev, message: "Admin onSnapshot listener for all windows started."}));

    const unsubAllWindows = onSnapshot(collection(db, `artifacts/${appId}/public/data/windows`), async (querySnapshot) => {
      setDebugInfo(prev => ({...prev, message: "Admin onSnapshot callback fired for all windows."}));
      const windows = [];
      for (const docSnap of querySnapshot.docs) {
        const feedbackCollectionRef = collection(db, `artifacts/${appId}/public/data/windows/${docSnap.id}/feedback`);
        const feedbackDocs = await getDocs(feedbackCollectionRef);
        const responsesCount = feedbackDocs.docs.length;
        windows.push({
          id: docSnap.id,
          ...docSnap.data(),
          responsesCount
        });
      }
      setAllWindowsData(windows);
      if (appState === 'adminDashboard') {
        setDebugInfo(prev => ({...prev, message: `Admin dashboard updated with ${windows.length} windows.`}));
      }
    });
    
    return () => {
      setDebugInfo(prev => ({...prev, message: "Admin onSnapshot listener unsubscribed."}));
      unsubAllWindows();
    };
  }, [db, isAppReady, appId, isAdmin, appState, setDebugInfo]);


  const renderContent = () => {
    if (appError) {
      return (
        <div className={tailwindClasses.card}>
          <h1 className={tailwindClasses.heading}>Application Error</h1>
          <p className={`${tailwindClasses.subheading} text-red-500 font-semibold`}>
            {appError}
          </p>
        </div>
      );
    }

    if (!isAppReady) {
      return (
        <div className={tailwindClasses.card}>
          <h1 className={tailwindClasses.heading}>Loading...</h1>
          <p className={tailwindClasses.subheading}>
            Initializing application. Please wait.
          </p>
        </div>
      );
    }

    if (isAdmin && appState === 'home') {
      setAppState('adminDashboard');
    }

    if (isAdmin && appState !== 'adminDashboard' && appState !== 'adminViewWindow') {
      return (
        <div className={tailwindClasses.card}>
          <p className={tailwindClasses.subheading}>
            Signed in as admin. Redirecting to dashboard...
          </p>
        </div>
      );
    }

    if (isAdmin && appState === 'adminDashboard') {
      return (
        <div className={tailwindClasses.card}>
          <AdminDashboard
            setAppState={setAppState}
            setWindowId={setWindowId}
            allWindowsData={allWindowsData}
            handleSignOut={handleSignOut}
          />
        </div>
      );
    }

    if (isAdmin && appState === 'adminViewWindow') {
      return windowData ? (
        <div className={tailwindClasses.card}>
          <WindowDisplay
            windowData={windowData}
            setAppState={setAppState}
            setWindowId={setWindowId}
            isAppReady={isAppReady}
            handleCreateNewWindow={handleCreateNewWindow}
            userId={userId}
            handleEditSelections={handleEditSelections}
            isAdmin={true}
          />
        </div>
      ) : (
        <div className={tailwindClasses.card}>
          <p className={tailwindClasses.subheading}>Loading window data...</p>
        </div>
      );
    }

    switch (appState) {
      case 'home':
        return (
          <div className={tailwindClasses.card}>
            <WelcomePage
              setAppState={setAppState}
              creatorName={creatorName}
              setCreatorName={setCreatorName}
              isAppReady={isAppReady}
            />
          </div>
        );
      case 'creatorAdjectiveSelection':
        return (
          <div className={tailwindClasses.card}>
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
          </div>
        );
      case 'feedback':
        return (
          <div className={tailwindClasses.card}>
            <FeedbackProvider
              windowId={windowId}
              creatorName={creatorName}
              setAppState={setAppState}
              isAppReady={isAppReady}
              appId={appId}
              userId={userId}
              setDebugInfo={setDebugInfo}
              setSnackbarMessage={setSnackbarMessage}
            />
          </div>
        );
      case 'error':
        return (
          <div className={tailwindClasses.card}>
            <h1 className={tailwindClasses.heading}>Error</h1>
            <p className={tailwindClasses.subheading}>
              The link you're using is invalid. Please check the URL or ask the creator to send you a new link.
            </p>
          </div>
        );
      case 'windowCreated':
        const creatorLink = `${window.location.origin}${window.location.pathname}?windowId=${windowId}`;
        return (
          <div className={tailwindClasses.card}>
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
          </div>
        );
      case 'submitted':
        const handleUpdateFeedback = () => setAppState('feedback');
        return (
          <div className={tailwindClasses.card}>
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
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <FirebaseContext.Provider value={{ db }}>
      <HelpButton onClick={() => setShowHelp(true)} />
      <HelpModal show={showHelp} onClose={() => setShowHelp(false)} />
      <div className={tailwindClasses.container}>
        {renderContent()}
        <div className={tailwindClasses.adminLinkContainer}>
          {appState === 'home' && (
            <div className="flex flex-col items-center mt-4 space-y-2">
                {adminSignInError && (
                    <p className="text-red-500 font-semibold text-sm">{adminSignInError}</p>
                )}
                <button
                    className="text-gray-500 hover:text-blue-600 transition-colors duration-200 text-sm"
                    onClick={signInWithGoogle}
                    disabled={!isAppReady}
                >
                    Admin Login
                </button>
            </div>
          )}
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
