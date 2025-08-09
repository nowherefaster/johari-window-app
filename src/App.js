import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';

// Define the Firebase context to pass services to components
const FirebaseContext = createContext(null);

// Tailwind CSS classes for a clean, responsive, and professional look
const tailwindClasses = {
  container: "min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4",
  card: "bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full text-center space-y-6",
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

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    const initFirebase = async () => {
      try {
        let firebaseConfig = {};
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

        // Check if Firebase config is available from the environment.
        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
          firebaseConfig = JSON.parse(__firebase_config);
        } else {
          // If not in this environment, try to get config from Vercel environment variables
          const vercelConfig = {
            apiKey: import.meta.env.VITE_API_KEY,
            authDomain: import.meta.env.VITE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_APP_ID,
          };

          // Check if Vercel config is complete
          if (vercelConfig.apiKey && vercelConfig.projectId) {
            firebaseConfig = vercelConfig;
          } else {
            throw new Error("Firebase configuration is missing. Please check your Vercel environment variables.");
          }
        }
        
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);

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
        setError(`Error: ${e.message}`);
        setLoading(false);
      }
    };

    initFirebase();
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

  return (
    <FirebaseContext.Provider value={{ db, auth }}>
      <div className={tailwindClasses.container}>
        <div className={tailwindClasses.card}>
          {renderContent()}
        </div>
      </div>
    </FirebaseContext.Provider>
  );
}
