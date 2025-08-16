import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Define the four quadrants of the Johari Window
const quadrants = {
  'Known to Self, Known to Others': 'Open',
  'Known to Self, Not Known to Others': 'Hidden',
  'Not Known to Self, Known to Others': 'Blind',
  'Not Known to Self, Not Known to Others': 'Unknown',
};

// Global variables for Firebase configuration and app ID.
// These are provided by the canvas environment.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The main component for the Johari Window app
const App = () => {
  // State variables for Firebase services and user data
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [traits, setTraits] = useState({
    'Known to Self, Known to Others': [],
    'Known to Self, Not Known to Others': [],
    'Not Known to Self, Known to Others': [],
    'Not Known to Self, Not Known to Others': [],
  });

  // Effect to initialize Firebase and authenticate the user
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // Initialize the Firebase app with the provided config
        const app = initializeApp(firebaseConfig);
        // Get the Firestore and Auth service instances
        const firestore = getFirestore(app);
        const authService = getAuth(app);

        setDb(firestore);
        setAuth(authService);

        // Authenticate using the custom token if available, otherwise sign in anonymously
        if (initialAuthToken) {
          await signInWithCustomToken(authService, initialAuthToken);
        } else {
          await signInAnonymously(authService);
        }

        // Set the user ID after successful authentication
        setUserId(authService.currentUser.uid);
        setIsAuthReady(true);
      } catch (e) {
        console.error("Error initializing Firebase:", e);
      }
    };

    initializeFirebase();
  }, []);

  // Effect to listen for real-time updates to the user's Johari Window data
  useEffect(() => {
    // Only proceed if Firebase is initialized and the user is authenticated
    if (db && userId) {
      // Define the document path for the current user's data
      const docPath = `artifacts/${appId}/users/${userId}/johariWindow/data`;
      const docRef = doc(db, docPath);

      // Set up a real-time listener for the document
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          // If the document exists, update the traits state with the fetched data
          setTraits(snapshot.data());
        } else {
          // If the document doesn't exist, create it with the initial empty traits
          setDoc(docRef, traits).catch(e => console.error("Error creating document:", e));
        }
      }, (error) => {
        console.error("Error listening to document:", error);
      });

      // Clean up the listener when the component unmounts
      return () => unsubscribe();
    }
  }, [db, userId, isAuthReady]); // Re-run this effect when db, userId, or auth state changes

  // Function to add a trait to a specific quadrant and update Firestore
  const addTrait = async (quadrant) => {
    // Prompt the user for a new trait
    const newTrait = prompt(`Enter a trait for the ${quadrants[quadrant]} quadrant:`);
    if (newTrait && db && userId) {
      // Create a temporary object to hold the updated traits
      const updatedTraits = {
        ...traits,
        [quadrant]: [...traits[quadrant], newTrait],
      };

      try {
        // Get a reference to the user's document
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/johariWindow/data`);
        // Update the document with the new traits
        await setDoc(docRef, updatedTraits);
      } catch (e) {
        console.error("Error adding trait:", e);
      }
    }
  };

  // Function to display the user ID in a visible, copyable format
  const copyUserId = () => {
    // Use the older, more reliable execCommand for copying to the clipboard
    const el = document.createElement('textarea');
    el.value = userId;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    alert('User ID copied to clipboard!');
  };

  // Render a loading state while the app is setting up
  if (!isAuthReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-700 text-lg font-medium">Loading Johari Window...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-5xl">
        <h1 className="text-4xl font-extrabold text-center mb-6 text-gray-800">
          The Johari Window
        </h1>

        {/* User ID display section */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6 text-center">
          <p className="text-gray-700 mb-2">
            Your User ID:
          </p>
          <div className="bg-gray-200 p-2 rounded-md font-mono text-sm break-all">
            {userId}
          </div>
          <button
            onClick={copyUserId}
            className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-300 shadow-md"
          >
            Copy User ID
          </button>
        </div>

        {/* Johari Window grid */}
        <div className="grid grid-cols-2 gap-6">
          {Object.keys(quadrants).map((quadrant, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-lg p-6 flex flex-col"
            >
              {/* Quadrant Title and Add Button */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {quadrants[quadrant]}
                </h2>
                <button
                  onClick={() => addTrait(quadrant)}
                  className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 transition-colors duration-300"
                  aria-label={`Add trait to ${quadrants[quadrant]} quadrant`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              
              {/* Traits list */}
              <ul className="list-disc list-inside text-gray-700 flex-grow space-y-2">
                {traits[quadrant].length > 0 ? (
                  traits[quadrant].map((trait, i) => (
                    <li key={i} className="bg-gray-50 p-2 rounded-md">
                      {trait}
                    </li>
                  ))
                ) : (
                  <li className="text-gray-400 italic">No traits added yet.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
