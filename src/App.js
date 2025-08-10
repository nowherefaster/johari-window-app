import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';

// Define the Firebase context to pass services to components
const FirebaseContext = createContext(null);

// Tailwind CSS classes for a clean, responsive, and professional look
const tailwindClasses = {
  container: "min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4",
  card: "bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full text-center space-y-6 relative", // Added 'relative' for positioning guide button
  heading: "text-3xl font-bold text-gray-800",
  subheading: "text-lg text-gray-600",
  button: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105",
  input: "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500",
  adjectiveGrid: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-4",
  adjectiveButton: "py-2 px-4 rounded-lg border-2 font-medium text-sm transition duration-150 ease-in-out",
  adjectiveSelected: "bg-indigo-600 text-white border-indigo-600",
  adjectiveUnselected: "bg-white text-gray-700 border-gray-300 hover:bg-gray-100",
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
  guideModal: "fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50",
  guideModalContent: "bg-white p-8 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto relative",
  guideCloseButton: "absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold",
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [windowId, setWindowId] = useState(null);
  const [isSelfAssessment, setIsSelfAssessment] = useState(false);
  const [selectedAdjectives, setSelectedAdjectives] = useState([]);
  const [results, setResults] = useState(null);
  const [page, setPage] = useState('start'); // 'start', 'assess', 'results'
  const [shareLink, setShareLink] = useState('');
  const [showGuide, setShowGuide] = useState(false); // New state for the guide modal

  // Function to initialize Firebase with retries
  const initializeFirebaseWithRetry = async (retries = 3, delay = 100) => {
    try {
      const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
      if (!firebaseConfigString) {
          throw new Error('Firebase configuration not found.');
      }
      const firebaseConfig = JSON.parse(firebaseConfigString);
      
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const firebaseAuth = getAuth(app);
      
      return { firestoreDb, firebaseAuth };
    } catch (e) {
      console.error(`Firebase initialization attempt failed. Retries left: ${retries}`);
      if (retries > 0) {
        await new Promise(res => setTimeout(res, delay));
        return initializeFirebaseWithRetry(retries - 1, delay * 2); // Exponential backoff
      }
      throw e;
    }
  };
  
  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    const initApp = async () => {
      try {
        const { firestoreDb, firebaseAuth } = await initializeFirebaseWithRetry();
        
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
            console.log("User authenticated:", user.uid);
          } else {
            console.log("No user found. Signing in anonymously...");
            await signInAnonymously(firebaseAuth);
          }
          setLoading(false);
        });

        // Handle initial URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        const mode = urlParams.get('mode');
        if (id) {
          setWindowId(id);
          setShareLink(`${window.location.origin}${window.location.pathname}?id=${id}`);
          if (mode === 'feedback') {
            setIsSelfAssessment(false);
            setPage('assess');
          } else {
            setIsSelfAssessment(true);
            setPage('assess');
          }
        }
      } catch (e) {
        console.error("Error initializing Firebase:", e);
        setError(`Failed to initialize the app: ${e.message}. Please try again.`);
        setLoading(false);
      }
    };
    
    initApp();
  }, []);

  // 2. Real-time data fetching with onSnapshot
  useEffect(() => {
    if (!db || !windowId || !userId) return;

    // Listen for changes to the main window document
    const windowRef = doc(db, `/artifacts/${__app_id}/users/${userId}/windows`, windowId);
    const unsubscribeWindow = onSnapshot(windowRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const userSelections = data.selfAssessment || [];

        // Listen for changes in the feedback subcollection
        const feedbackRef = collection(db, `/artifacts/${__app_id}/users/${userId}/windows/${windowId}/feedback`);
        const unsubscribeFeedback = onSnapshot(feedbackRef, (querySnap) => {
          const peerSelections = new Set();
          querySnap.forEach(doc => {
            doc.data().adjectives.forEach(adj => peerSelections.add(adj));
          });

          // Calculate Johari Window quadrants
          const arena = userSelections.filter(adj => peerSelections.has(adj));
          const blindSpot = Array.from(peerSelections).filter(adj => !userSelections.includes(adj));
          const facade = userSelections.filter(adj => !peerSelections.has(adj));
          const unknown = adjectivesList.filter(adj => !userSelections.includes(adj) && !peerSelections.has(adj));

          setResults({ arena, blindSpot, facade, unknown });
        });
        
        return () => unsubscribeFeedback();
      }
    });

    return () => unsubscribeWindow();
  }, [db, windowId, userId]);

  const handleStartNewWindow = async () => {
    if (!db || !userId) return;
    setLoading(true);
    try {
      const newWindowId = generateUniqueId();
      const userDocRef = doc(db, `/artifacts/${__app_id}/users/${userId}/windows`, newWindowId);

      // Create a new document for the window
      await setDoc(userDocRef, {
        creatorId: userId,
        createdAt: new Date(),
        selfAssessment: [],
      });

      // Set state and navigate
      setWindowId(newWindowId);
      setIsSelfAssessment(true);
      setPage('assess');
      setShareLink(`${window.location.origin}${window.location.pathname}?id=${newWindowId}&mode=feedback`);
    } catch (e) {
      console.error("Error starting new window:", e);
      setError("Failed to start a new window. Please try again.");
    } finally {
      setLoading(false);
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

  const handleSaveAssessment = async () => {
    if (!db || !windowId || !userId) return;
    setLoading(true);
    try {
      if (isSelfAssessment) {
        // Save the user's own assessment
        const userDocRef = doc(db, `/artifacts/${__app_id}/users/${userId}/windows`, windowId);
        await updateDoc(userDocRef, {
          selfAssessment: selectedAdjectives,
        });
      } else {
        // Save peer feedback
        const feedbackCollectionRef = collection(db, `/artifacts/${__app_id}/users/${userId}/windows/${windowId}/feedback`);
        await addDoc(feedbackCollectionRef, {
          adjectives: selectedAdjectives,
          submittedBy: 'anonymous', // In a real app, this might be a name or anonymous ID
          submittedAt: new Date(),
        });
      }
      setPage('results');
    } catch (e) {
      console.error("Error saving assessment:", e);
      setError("Failed to save your selections. Please try again.");
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
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
    document.body.removeChild(textarea);
  };
  
  // Render different pages based on state
  const renderContent = () => {
    if (loading) {
      return <p className={tailwindClasses.loading}>Loading...</p>;
    }
    
    if (error) {
      return <p className={tailwindClasses.error}>Error: {error}</p>;
    }

    switch (page) {
      case 'start':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Discover Your Johari Window</h1>
            <p className={tailwindClasses.subheading}>A simple tool to help you and your team better understand your interpersonal dynamics.</p>
            <button className={tailwindClasses.button} onClick={handleStartNewWindow}>
              Start My Window
            </button>
          </>
        );
      case 'assess':
        return (
          <>
            <h1 className={tailwindClasses.heading}>
              {isSelfAssessment ? "Select How You See Yourself" : "Select How You See Your Teammate"}
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
                >
                  {adj}
                </button>
              ))}
            </div>
            <button className={tailwindClasses.button} onClick={handleSaveAssessment}>
              {isSelfAssessment ? "Submit My Selections" : "Submit Feedback"}
            </button>
          </>
        );
      case 'results':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Your Johari Window Results</h1>
            <p className={tailwindClasses.subheading}>
              This is your unique window. Share the link below to get more feedback!
            </p>
            
            <div className={tailwindClasses.linkContainer}>
              <p>Your unique share link:</p>
              <div className={tailwindClasses.link}>{shareLink}</div>
              <button className={tailwindClasses.copyButton} onClick={handleCopyLink}>Copy Link</button>
              <p>Your User ID for Firestore: {userId}</p>
            </div>
            
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
            
            <button className={`${tailwindClasses.button} mt-8`} onClick={() => setPage('start')}>
              Create Another Window
            </button>
          </>
        );
      default:
        return null;
    }
  };
  
  // The Guide Modal component
  const GuideModal = () => (
    <div className={tailwindClasses.guideModal}>
      <div className={tailwindClasses.guideModalContent}>
        <button className={tailwindClasses.guideCloseButton} onClick={() => setShowGuide(false)}>
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-4">Your Guide to the Johari Window Team Exercise</h2>
        
        <h3 className="text-xl font-semibold mt-4">What is the Johari Window?</h3>
        <p className="mt-2 text-gray-700">The Johari Window is a simple but powerful model for improving self-awareness and mutual understanding within a team. By comparing how you see yourself with how your teammates see you, you can gain valuable insights and build stronger relationships. The model is based on four quadrants:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>The Arena (Open Self):</strong> Things that both you and your teammates know about you. This is the goal of the exercise—to expand this area through open communication.</li>
          <li><strong>The Blind Spot:</strong> Things your teammates know about you that you are not yet aware of. This is an opportunity for personal growth through feedback.</li>
          <li><strong>The Facade (Hidden Self):</strong> Things you know about yourself that you choose not to share with your teammates. Reducing this area builds trust and vulnerability.</li>
          <li><strong>The Unknown:</strong> Things that no one on the team knows about you yet. This is an area of untapped potential and discovery.</li>
        </ul>
        
        <h3 className="text-xl font-semibold mt-6">How to Participate in the Exercise</h3>
        <p className="mt-2 text-gray-700">This app is designed to make the Johari Window exercise easy to run. Just follow these steps:</p>
        <ol className="list-decimal list-inside mt-2 space-y-1">
          <li><strong>Do Your Self-Assessment:</strong> Use your unique creator link to begin. Select the adjectives you feel best describe you, and then click <strong>"Submit My Selections."</strong> The app will save your choices and generate the quadrants of your window.</li>
          <li><strong>Give Your Feedback:</strong> If a teammate has sent you a link to their window, use that link to provide your feedback. Select the adjectives you feel best describe them. The app will automatically update their results page in real-time.</li>
          <li><strong>Review and Discuss the Results:</strong> Once enough teammates have responded, you can all sit down and discuss the results together. The goal isn't to debate the feedback but to explore it with curiosity.</li>
        </ol>

        <h3 className="text-xl font-semibold mt-6">Tips for a Successful Team Discussion</h3>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li><strong>Create Psychological Safety:</strong> Remind everyone that the purpose is to help each other grow and build trust. This is not a formal performance review.</li>
          <li><strong>Focus on the Quadrants:</strong> Start by discussing the <strong>Arena</strong> (what you all agree on) to build a positive foundation. Then, move to the <strong>Facade</strong> (what you shared about yourself) and the <strong>Blind Spot</strong> (the feedback from your team).</li>
          <li><strong>Use "I" Statements:</strong> When giving feedback, use "I feel..." or "I've noticed..." statements to describe your perceptions, rather than making definitive statements about the other person.</li>
          <li><strong>Ask Open-Ended Questions:</strong> Instead of defending a point, try asking questions like, "Could you give me an example of when you saw me demonstrate that?" or "That's interesting—why do you think that adjective came to mind for you?"</li>
        </ul>
      </div>
    </div>
  );

  return (
    <FirebaseContext.Provider value={{ db, auth }}>
      <div className={tailwindClasses.container}>
        <div className={tailwindClasses.card}>
          <button
            className="absolute top-4 right-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg text-sm transition duration-150 ease-in-out"
            onClick={() => setShowGuide(true)}
          >
            Guide
          </button>
          {renderContent()}
        </div>
        {showGuide && <GuideModal />}
      </div>
    </FirebaseContext.Provider>
  );
}
