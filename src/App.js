import React, { useEffect, useReducer, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
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
// Define the initial state for our Johari Window application
const initialState = {
  arena: [],        // Known to self & known to others
  facade: [],       // Known to self, unknown to others
  blindSpot: [],    // Unknown to self, known to others
  unknown: [],      // Unknown to self & unknown to others
  isLoading: true,
  error: null,
  userId: null,
};

// Define the reducer function to handle state updates
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        arena: action.payload.arena || [],
        facade: action.payload.facade || [],
        blindSpot: action.payload.blindSpot || [],
        unknown: action.payload.unknown || [],
        isLoading: false,
        error: null,
      };
    case 'ADD_TRAIT_TO_QUADRANT':
      const { trait, quadrant } = action.payload;
      return {
        ...state,
        [quadrant]: [...state[quadrant], trait]
      };
    case 'REMOVE_TRAIT_FROM_QUADRANT':
      const { trait: traitToRemove, quadrant: quadrantToRemove } = action.payload;
      return {
        ...state,
        [quadrantToRemove]: state[quadrantToRemove].filter(t => t !== traitToRemove)
      };
    case 'MOVE_TRAIT':
      const { trait: traitToMove, from, to } = action.payload;
      const fromList = state[from].filter(t => t !== traitToMove);
      const toList = [...state[to], traitToMove];
      return {
        ...state,
        [from]: fromList,
        [to]: toList,
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
  const [newSelfTrait, setNewSelfTrait] = useState('');
  const [newFeedbackTrait, setNewFeedbackTrait] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Effect for Firebase authentication and data listening
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        dispatch({ type: 'SET_USER_ID', payload: user.uid });
        startDataListener(user.uid);
      } else if (initialAuthToken) {
        try {
          await signInWithCustomToken(auth, initialAuthToken);
        } catch (error) {
          console.error('Error signing in with custom token:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Authentication failed.' });
        }
      } else {
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

    const startDataListener = (userId) => {
      const docRef = doc(db, 'artifacts', appId, 'users', userId, 'data', 'johari');
      
      const unsub = onSnapshot(
        docRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            dispatch({ type: 'SET_DATA', payload: docSnapshot.data() });
            console.log('Johari data loaded successfully from Firestore.');
          } else {
            console.log('Johari document not found, creating a new one.');
            setDoc(docRef, initialState).catch(error => {
              console.error('Error creating initial document:', error);
              dispatch({ type: 'SET_ERROR', payload: 'Error creating initial document.' });
            });
            dispatch({ type: 'SET_DATA', payload: initialState });
          }
        },
        (error) => {
          console.error('Error fetching Johari document from Firestore:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to load Johari data.' });
        }
      );

      return () => unsub();
    };

    return () => unsubAuth();
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
      await updateDoc(docRef, updatedData);
      console.log('Trait change saved to Firestore.');
    } catch (error) {
      console.error('Error saving trait change:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  const addSelfTrait = () => {
    if (!newSelfTrait.trim()) return;
    const trait = newSelfTrait.trim();
    const updatedFacade = [...state.facade, trait];
    dispatch({ type: 'ADD_TRAIT_TO_QUADRANT', payload: { trait, quadrant: 'facade' }});
    setNewSelfTrait('');
    saveToFirestore({ facade: updatedFacade });
  };

  const addFeedbackTrait = () => {
    if (!newFeedbackTrait.trim()) return;
    const trait = newFeedbackTrait.trim();
    const updatedBlindSpot = [...state.blindSpot, trait];
    dispatch({ type: 'ADD_TRAIT_TO_QUADRANT', payload: { trait, quadrant: 'blindSpot' }});
    setNewFeedbackTrait('');
    saveToFirestore({ blindSpot: updatedBlindSpot });
  };

  const moveTrait = (trait, from, to) => {
    if (isSaving) return; // Prevent multiple saves
    const fromList = state[from].filter(t => t !== trait);
    const toList = [...state[to], trait];
    dispatch({ type: 'MOVE_TRAIT', payload: { trait, from, to }});
    saveToFirestore({ [from]: fromList, [to]: toList });
  };

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

  const Quadrant = ({ title, traits, onMove, fromQuadrant }) => (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg h-full">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <ul className="list-disc list-inside space-y-2">
        {traits.length > 0 ? (
          traits.map((trait, index) => (
            <li key={index} className="bg-gray-700 p-2 rounded-lg flex items-center justify-between">
              <span>{trait}</span>
              {onMove && (
                <button
                  onClick={() => onMove(trait)}
                  className="ml-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200"
                >
                  Move to {fromQuadrant === 'facade' ? 'Arena' : 'Arena'}
                </button>
              )}
            </li>
          ))
        ) : (
          <p className="text-gray-400 text-sm">No traits here yet.</p>
        )}
      </ul>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">Your Johari Window</h1>
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Your User ID</h2>
          <p className="font-mono text-sm break-all bg-gray-700 p-2 rounded-lg">{state.userId}</p>
        </div>

        {/* Input for adding traits */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg mb-6 grid md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Add a Self-Perceived Trait</h2>
            <p className="text-sm text-gray-400 mb-4">This is a trait you know about yourself.</p>
            <div className="flex space-x-4">
              <input
                type="text"
                className="flex-grow rounded-lg p-3 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 'Creative'"
                value={newSelfTrait}
                onChange={(e) => setNewSelfTrait(e.target.value)}
              />
              <button
                onClick={addSelfTrait}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors duration-200"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Add a Feedback Trait</h2>
            <p className="text-sm text-gray-400 mb-4">This is a trait others have told you.</p>
            <div className="flex space-x-4">
              <input
                type="text"
                className="flex-grow rounded-lg p-3 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 'Good listener'"
                value={newFeedbackTrait}
                onChange={(e) => setNewFeedbackTrait(e.target.value)}
              />
              <button
                onClick={addFeedbackTrait}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-colors duration-200"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* The Johari Window Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Quadrant 1: Arena */}
          <Quadrant
            title="Arena (Known to Self, Known to Others)"
            traits={state.arena}
          />
          {/* Quadrant 2: Blind Spot */}
          <Quadrant
            title="Blind Spot (Unknown to Self, Known to Others)"
            traits={state.blindSpot}
            onMove={(trait) => moveTrait(trait, 'blindSpot', 'arena')}
            fromQuadrant="blindSpot"
          />
          {/* Quadrant 3: Facade */}
          <Quadrant
            title="Facade (Known to Self, Unknown to Others)"
            traits={state.facade}
            onMove={(trait) => moveTrait(trait, 'facade', 'arena')}
            fromQuadrant="facade"
          />
          {/* Quadrant 4: Unknown */}
          <Quadrant
            title="Unknown (Unknown to Self, Unknown to Others)"
            traits={state.unknown}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
