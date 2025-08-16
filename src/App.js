import React, { useEffect, useReducer, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';

// --- Firebase Configuration and Initialization ---
// The following variables are automatically provided by the Canvas environment.
// DO NOT edit these.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- State Management with useReducer ---
// Define the initial state for our application
const initialState = {
  creatorTraits: [],
  feedbackTraits: [],
  knownTraits: [],
  unknownTraits: [],
  isLoading: true, // Start with a loading state
  error: null,
  userId: null,
};

// Define the reducer function to handle state updates
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        creatorTraits: action.payload.creatorTraits || [],
        feedbackTraits: action.payload.feedbackTraits || [],
        knownTraits: action.payload.knownTraits || [],
        unknownTraits: action.payload.unknownTraits || [],
        isLoading: false,
        error: null,
      };
    case 'SET_USER_ID':
      return {
        ...state,
        userId: action.payload,
        isLoading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
}

// --- Main App Component ---
function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [newTrait, setNewTrait] = useState('');

  // Effect for Firebase authentication and data listening
  useEffect(() => {
    // Set up a listener for auth state changes
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // User is signed in.
        dispatch({ type: 'SET_USER_ID', payload: user.uid });
        startDataListener(user.uid);
      } else if (initialAuthToken) {
        // Sign in with the provided custom token
        try {
          await signInWithCustomToken(auth, initialAuthToken);
        } catch (error) {
          console.error('Error signing in with custom token:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Authentication failed.' });
        }
      } else {
        // Sign in anonymously if no custom token is available
        try {
          const anonUserCredential = await signInAnonymously(auth);
          dispatch({ type: 'SET_USER_ID', payload: anonUserCredential.user.uid });
          startDataListener(anonUserCredential.user.uid);
        } catch (error) {
          console.error('Error signing in anonymously:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Authentication failed.' });
        }
      }
    });

    // Function to set up the Firestore listener
    const startDataListener = (userId) => {
      const docRef = doc(db, 'artifacts', appId, 'users', userId, 'data', 'traits');
      
      const unsub = onSnapshot(
        docRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            // Document exists, update state with data
            dispatch({ type: 'SET_DATA', payload: docSnapshot.data() });
            console.log('Data loaded successfully from Firestore.');
          } else {
            // Document does not exist, create it with initial data
            console.log('Document not found, creating a new one.');
            setDoc(docRef, {
              creatorTraits: [],
              feedbackTraits: [],
              knownTraits: [],
              unknownTraits: [],
            }).catch(error => {
              console.error('Error creating initial document:', error);
              dispatch({ type: 'SET_ERROR', payload: 'Error creating initial document.' });
            });
            dispatch({ type: 'SET_DATA', payload: initialState });
          }
        },
        (error) => {
          // Error tracing: log the error and set an error state
          console.error('Error fetching document from Firestore:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to load data.' });
        }
      );

      // Return a cleanup function to unsubscribe from the listener
      return () => unsub();
    };

    // Cleanup function for the auth listener
    return () => unsubAuth();
  }, []); // Empty dependency array ensures this effect runs only once on mount

  // --- Functions to Interact with Firestore ---
  const saveTrait = async (trait) => {
    const docRef = doc(db, 'artifacts', appId, 'users', state.userId, 'data', 'traits');
    try {
      await updateDoc(docRef, {
        creatorTraits: [...state.creatorTraits, trait],
      });
      console.log('Trait saved successfully!');
    } catch (error) {
      console.error('Error saving trait:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save trait.' });
    }
  };
  
  // Note: All other functions for managing traits will be added here
  // (e.g., addFeedbackTrait, markAsKnown, etc.)
  // They will all use the `state.userId` and the `dispatch` function
  // to manage state.

  // --- UI Rendering ---
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p className="text-xl animate-pulse">Loading App...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-900 text-white p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error!</h1>
          <p>{state.error}</p>
          <p className="mt-4 text-sm opacity-75">Check the console for more details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Creator Traits App</h1>
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Your User ID</h2>
          <p className="font-mono text-sm break-all bg-gray-700 p-2 rounded-lg">{state.userId}</p>
        </div>

        {/* Input for adding a new trait */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Add a New Trait</h2>
          <div className="flex space-x-4">
            <input
              type="text"
              className="flex-grow rounded-lg p-3 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 'Creative thinker'"
              value={newTrait}
              onChange={(e) => setNewTrait(e.target.value)}
            />
            <button
              onClick={() => {
                if (newTrait.trim()) {
                  saveTrait(newTrait.trim());
                  setNewTrait('');
                }
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors duration-200"
            >
              Save Trait
            </button>
          </div>
        </div>

        {/* Display sections for each trait category */}
        <div className="grid md:grid-cols-2 gap-6">
          {['creatorTraits', 'feedbackTraits', 'knownTraits', 'unknownTraits'].map((key) => (
            <div key={key} className="bg-gray-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-4 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </h2>
              {state[key].length > 0 ? (
                <ul className="list-disc list-inside space-y-2">
                  {state[key].map((trait, index) => (
                    <li key={index} className="bg-gray-700 p-2 rounded-lg">
                      {trait}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-400">No traits in this category yet.</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
