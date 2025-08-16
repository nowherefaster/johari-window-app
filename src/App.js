import React, { useEffect, useReducer, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';

// --- Firebase Configuration and Initialization ---
// These variables are automatically provided by the Canvas environment.
// DO NOT edit them.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- State Management with useReducer ---
const initialState = {
  creatorTraits: [],
  feedbackTraits: [],
  isLoading: true,
  error: null,
  userId: null,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        creatorTraits: action.payload.creatorTraits || [],
        feedbackTraits: action.payload.feedbackTraits || [],
        isLoading: false,
        error: null,
      };
    case 'ADD_TRAIT':
      const { trait, type } = action.payload;
      return {
        ...state,
        [type]: [...state[type], trait],
      };
    case 'REMOVE_TRAIT':
      const { trait: traitToRemove, type: typeToRemove } = action.payload;
      return {
        ...state,
        [typeToRemove]: state[typeToRemove].filter(t => t !== traitToRemove),
      };
    case 'SET_USER_ID':
      return {
        ...state,
        userId: action.payload,
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
  const [newCreatorTrait, setNewCreatorTrait] = useState('');
  const [newFeedbackTrait, setNewFeedbackTrait] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Effect for Firebase authentication and data listener
  useEffect(() => {
    // onAuthStateChanged is the most reliable way to handle auth state changes
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // User is signed in. Set the user ID and listen for data.
        dispatch({ type: 'SET_USER_ID', payload: user.uid });
        startDataListener(user.uid);
      } else {
        // No user is signed in. Attempt to sign in.
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error('Authentication failed:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Authentication failed. Please check your Firebase setup.' });
        }
      }
    });

    const startDataListener = (userId) => {
      const docRef = doc(db, 'artifacts', appId, 'users', userId, 'data', 'johari');
      
      // Set up a real-time listener for the document
      const unsubscribeSnapshot = onSnapshot(
        docRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            // Data exists, update the state
            dispatch({ type: 'SET_DATA', payload: docSnapshot.data() });
            console.log('Johari data loaded successfully from Firestore.');
          } else {
            // Document does not exist, create it with initial state
            console.log('Johari document not found, creating a new one.');
            setDoc(docRef, { creatorTraits: [], feedbackTraits: [] })
              .then(() => {
                dispatch({ type: 'SET_DATA', payload: { creatorTraits: [], feedbackTraits: [] } });
              })
              .catch(error => {
                console.error('Error creating initial document:', error);
                dispatch({ type: 'SET_ERROR', payload: 'Error creating initial document.' });
              });
          }
        },
        (error) => {
          console.error('Error fetching Johari document from Firestore:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to load Johari data.' });
        }
      );

      // Return the unsubscribe function for cleanup
      return unsubscribeSnapshot;
    };

    return () => {
      // Clean up the auth state listener
      unsubscribeAuth();
    };
  }, []);

  // --- Functions to Interact with Firestore and State ---
  const saveToFirestore = async (updatedData) => {
    if (!state.userId) {
      console.warn('User not authenticated, cannot save to Firestore.');
      return;
    }
    const docRef = doc(db, 'artifacts', appId, 'users', state.userId, 'data', 'johari');
    setIsSaving(true);
    try {
      await setDoc(docRef, updatedData, { merge: true });
      console.log('Trait change saved to Firestore.');
    } catch (error) {
      console.error('Error saving trait change:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTrait = (trait, type) => {
    if (!trait.trim()) return;
    const newTrait = trait.trim();
    const updatedList = [...state[type], newTrait];
    dispatch({ type: 'ADD_TRAIT', payload: { trait: newTrait, type } });
    if (type === 'creatorTraits') {
      setNewCreatorTrait('');
    } else {
      setNewFeedbackTrait('');
    }
    saveToFirestore({ [type]: updatedList });
  };

  const handleRemoveTrait = (trait, type) => {
    const updatedList = state[type].filter(t => t !== trait);
    dispatch({ type: 'REMOVE_TRAIT', payload: { trait, type } });
    saveToFirestore({ [type]: updatedList });
  };

  const TraitList = ({ title, traits, type }) => (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg h-full">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <ul className="list-disc list-inside space-y-2">
        {traits.length > 0 ? (
          traits.map((trait, index) => (
            <li key={index} className="bg-gray-700 p-2 rounded-lg flex items-center justify-between">
              <span>{trait}</span>
              <button
                onClick={() => handleRemoveTrait(trait, type)}
                className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors duration-200"
              >
                Remove
              </button>
            </li>
          ))
        ) : (
          <p className="text-gray-400 text-sm">No traits here yet.</p>
        )}
      </ul>
    </div>
  );

  // --- Calculations for Johari Window Quadrants ---
  const allTraits = new Set([...state.creatorTraits, ...state.feedbackTraits]);
  const creatorSet = new Set(state.creatorTraits);
  const feedbackSet = new Set(state.feedbackTraits);

  const arenaTraits = [...creatorSet].filter(t => feedbackSet.has(t));
  const facadeTraits = [...creatorSet].filter(t => !feedbackSet.has(t));
  const blindSpotTraits = [...feedbackSet].filter(t => !creatorSet.has(t));
  const unknownTraits = [...allTraits].filter(t => !creatorSet.has(t) && !feedbackSet.has(t));

  // --- UI Rendering ---
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p className="text-xl animate-pulse">Loading Johari Window...</p>
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
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Your Johari Window</h1>
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-2">Your User ID</h2>
          <p className="font-mono text-sm break-all bg-gray-700 p-2 rounded-lg">{state.userId}</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6 grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Traits I Believe I Possess</h2>
            <p className="text-sm text-gray-400 mb-4">Add your self-perceived traits here.</p>
            <div className="flex space-x-4">
              <input
                type="text"
                className="flex-grow rounded-lg p-3 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 'Creative'"
                value={newCreatorTrait}
                onChange={(e) => setNewCreatorTrait(e.target.value)}
              />
              <button
                onClick={() => handleAddTrait(newCreatorTrait, 'creatorTraits')}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors duration-200"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Feedback from Others</h2>
            <p className="text-sm text-gray-400 mb-4">Add feedback traits you've received here.</p>
            <div className="flex space-x-4">
              <input
                type="text"
                className="flex-grow rounded-lg p-3 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 'Good listener'"
                value={newFeedbackTrait}
                onChange={(e) => setNewFeedbackTrait(e.target.value)}
              />
              <button
                onClick={() => handleAddTrait(newFeedbackTrait, 'feedbackTraits')}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-colors duration-200"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <TraitList
            title="Traits I Believe I Possess"
            traits={state.creatorTraits}
            type="creatorTraits"
          />
          <TraitList
            title="Feedback from Others"
            traits={state.feedbackTraits}
            type="feedbackTraits"
          />
        </div>

        <div className="mt-8">
          <h2 className="text-3xl font-bold mb-4 text-center">Your Johari Window Quadrants</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg h-full">
              <h3 className="text-xl font-semibold mb-4 text-green-400">Arena (Known to Self, Known to Others)</h3>
              <ul className="list-disc list-inside space-y-2">
                {arenaTraits.length > 0 ? (
                  arenaTraits.map((trait, index) => (
                    <li key={index} className="bg-gray-700 p-2 rounded-lg">{trait}</li>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No shared traits yet.</p>
                )}
              </ul>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg h-full">
              <h3 className="text-xl font-semibold mb-4 text-blue-400">Facade (Known to Self, Unknown to Others)</h3>
              <ul className="list-disc list-inside space-y-2">
                {facadeTraits.length > 0 ? (
                  facadeTraits.map((trait, index) => (
                    <li key={index} className="bg-gray-700 p-2 rounded-lg">{trait}</li>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No private traits yet.</p>
                )}
              </ul>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg h-full">
              <h3 className="text-xl font-semibold mb-4 text-yellow-400">Blind Spot (Unknown to Self, Known to Others)</h3>
              <ul className="list-disc list-inside space-y-2">
                {blindSpotTraits.length > 0 ? (
                  blindSpotTraits.map((trait, index) => (
                    <li key={index} className="bg-gray-700 p-2 rounded-lg">{trait}</li>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No blind spots yet.</p>
                )}
              </ul>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg h-full">
              <h3 className="text-xl font-semibold mb-4 text-red-400">Unknown (Unknown to Self, Unknown to Others)</h3>
              <ul className="list-disc list-inside space-y-2">
                {unknownTraits.length > 0 ? (
                  unknownTraits.map((trait, index) => (
                    <li key={index} className="bg-gray-700 p-2 rounded-lg">{trait}</li>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">No unknown traits yet.</p>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
