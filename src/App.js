import React, { useState, useEffect, createContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc, updateDoc } from 'firebase/firestore';

// Define the Firebase context to pass services to components
const FirebaseContext = createContext(null);

// Tailwind CSS classes for a clean, responsive, and professional look
const tailwindClasses = {
  container: "min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4",
  card: "bg-white p-8 rounded-lg shadow-xl max-w-2xl w-full text-center space-y-6",
  heading: "text-3xl font-bold text-gray-800",
  subheading: "text-lg text-gray-600",
  button: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed",
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
  const [creatorId, setCreatorId] = useState(null); // New state to store the creator's ID
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [windowId, setWindowId] = useState(null);
  const [isSelfAssessment, setIsSelfAssessment] = useState(false);
  const [selectedAdjectives, setSelectedAdjectives] = useState([]);
  const [results, setResults] = useState(null);
  const [page, setPage] = useState('start'); // 'start', 'assess', 'results'
  const [shareLink, setShareLink] = useState('');

  // PHASE 1: Initialize Firebase and handle authentication
  useEffect(() => {
    const initFirebase = async () => {
      try {
        let firebaseConfig = {};

        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
          firebaseConfig = JSON.parse(__firebase_config);
        } else {
          const vercelConfig = {
            apiKey: process.env.REACT_APP_API_KEY,
            authDomain: process.env.REACT_APP_AUTH_DOMAIN,
            projectId: process.env.REACT_APP_PROJECT_ID,
            storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
            messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
            appId: process.env.REACT_APP_APP_ID,
          };
          if (!vercelConfig.apiKey || !vercelConfig.projectId) {
            throw new Error("Firebase environment variables are not correctly set.");
          }
          firebaseConfig = vercelConfig;
        }

        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            console.log("No user found. Signing in anonymously...");
            await signInAnonymously(firebaseAuth);
          }
        });

        return () => unsubscribe();
      } catch (e) {
        console.error("Error initializing Firebase:", e);
        setError(`Error: ${e.message}`);
        setLoading(false);
      }
    };

    initFirebase();
  }, []);

  // PHASE 2: Handle URL parameters and set up listeners after auth is ready
  useEffect(() => {
    if (!db || !userId) {
      console.log("Waiting for DB and userId to be available...");
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    const creatorIdFromUrl = urlParams.get('creatorId');

    if (id && creatorIdFromUrl) {
      setWindowId(id);
      setCreatorId(creatorIdFromUrl);
      const mode = urlParams.get('mode');
      setIsSelfAssessment(mode !== 'feedback');
      setPage('assess');
      setShareLink(`${window.location.origin}${window.location.pathname}?id=${id}&mode=feedback&creatorId=${creatorIdFromUrl}`);

      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const windowRef = doc(db, `/artifacts/${appId}/users/${creatorIdFromUrl}/windows`, id);
      
      const unsubscribeWindow = onSnapshot(windowRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const userSelections = data.selfAssessment || [];

          const feedbackRef = collection(db, `/artifacts/${appId}/users/${creatorIdFromUrl}/windows/${id}/feedback`);
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
            // Only set loading to false once all data is fetched and processed
            setLoading(false);
          });
          
          return () => unsubscribeFeedback();
        } else {
            // Document doesn't exist, so we can't load the window.
            setError("This Johari Window does not exist or you don't have access to it.");
            setLoading(false);
        }
      });
      // The loading state is now only set to false inside the onSnapshot listener, once data is confirmed.
      return () => unsubscribeWindow();
    } else {
      setLoading(false);
    }
  }, [db, userId]);

  const handleStartNewWindow = async () => {
    if (!db || !userId) {
        console.error("Attempted to start new window before Firebase and user are ready.");
        return;
    }

    setLoading(true);
    try {
      const newWindowId = generateUniqueId();
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const userDocRef = doc(db, `/artifacts/${appId}/users/${userId}/windows`, newWindowId);

      await setDoc(userDocRef, {
        creatorId: userId,
        createdAt: new Date(),
        selfAssessment: [],
      });

      setWindowId(newWindowId);
      setIsSelfAssessment(true);
      setCreatorId(userId);
      setPage('assess');
      setShareLink(`${window.location.origin}${window.location.pathname}?id=${newWindowId}&mode=feedback&creatorId=${userId}`);
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
    if (!db || !windowId || !userId || !creatorId) return;
    setLoading(true);
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      if (isSelfAssessment) {
        const userDocRef = doc(db, `/artifacts/${appId}/users/${creatorId}/windows`, windowId);
        await updateDoc(userDocRef, {
          selfAssessment: selectedAdjectives,
        });
      } else {
        const feedbackCollectionRef = collection(db, `/artifacts/${appId}/users/${creatorId}/windows/${windowId}/feedback`);
        await addDoc(feedbackCollectionRef, {
          adjectives: selectedAdjectives,
          submittedBy: userId,
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
      console.log("Link copied to clipboard!");
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
      return <p className={tailwindClasses.error}>Error: {error}</p>;
    }

    switch (page) {
      case 'start':
        return (
          <>
            <h1 className={tailwindClasses.heading}>Discover Your Johari Window</h1>
            <p className={tailwindClasses.subheading}>A simple tool to help you and your team better understand your interpersonal dynamics.</p>
            <button className={tailwindClasses.button} onClick={handleStartNewWindow} disabled={loading || !userId}>
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
                  disabled={loading}
                >
                  {adj}
                </button>
              ))}
            </div>
            <button className={tailwindClasses.button} onClick={handleSaveAssessment} disabled={loading || selectedAdjectives.length === 0}>
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
              <p>Creator's User ID: {creatorId}</p>
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
            
            <button className={`${tailwindClasses.button} mt-8`} onClick={() => window.location.href = window.location.origin + window.location.pathname}>
              Create Another Window
            </button>
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
      </div>
    </FirebaseContext.Provider>
  );
}
