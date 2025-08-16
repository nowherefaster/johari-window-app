import React, { useEffect, useReducer, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Ensure the provided Firebase variables are used, or fallback for local testing.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The central state management for the application.
const initialState = {
  creatorTraits: [],
  feedbackTraits: [],
  isLoading: true,
  isSaving: false,
  error: null,
  userId: null,
};

// Reducer function to handle state updates based on dispatched actions.
function appReducer(state, action) {
  switch (action.type) {
    case 'SET_TRAITS':
      return {
        ...state,
        creatorTraits: action.payload.creatorTraits,
        feedbackTraits: action.payload.feedbackTraits,
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
      return { ...state, isLoading: action.payload };
    case 'SET_SAVING':
      return { ...state, isSaving: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false, isSaving: false };
    default:
      throw new Error(`Unhandled action type: ${action.type}`);
  }
}

// Main App component
const App = () => {
  // Use useReducer to manage the entire application state
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { creatorTraits, feedbackTraits, isLoading, isSaving, error, userId } = state;
  const [newTrait, setNewTrait] = useState('');
  
  // Firebase instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);

  // useEffect for Firebase Initialization and Authentication.
  // This runs once on mount to establish the correct auth flow.
  useEffect(() => {
    let unsubscribe = () => {};

    const initializeFirebase = async () => {
      try {
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);

        setAuth(authInstance);
        setDb(dbInstance);

        // This listener ensures we only proceed once auth state is confirmed.
        unsubscribe = onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            dispatch({ type: 'SET_USER_ID', payload: user.uid });
          } else {
            // If no user, sign in anonymously.
            await signInAnonymously(authInstance);
          }
        });
      } catch (e) {
        console.error("Firebase initialization or auth error:", e);
        dispatch({ type: 'SET_ERROR', payload: `Firebase initialization failed: ${e.message}` });
      }
    };

    initializeFirebase();

    // Clean up the auth listener when the component unmounts.
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once.

  // useEffect to set up the Firestore listener.
  // This listener is only attached once the userId is available.
  useEffect(() => {
    let unsubscribe = () => {};

    if (db && userId) {
      const userDocRef = doc(db, 'artifacts', appId, 'users', userId);

      // Listen for real-time updates to the user's document.
      unsubscribe = onSnapshot(
        userDocRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            dispatch({
              type: 'SET_TRAITS',
              payload: {
                creatorTraits: data.creatorTraits || [],
                feedbackTraits: data.feedbackTraits || [],
              },
            });
          } else {
            // Document doesn't exist, initialize with empty arrays.
            dispatch({
              type: 'SET_TRAITS',
              payload: {
                creatorTraits: [],
                feedbackTraits: [],
              },
            });
          }
        },
        (error) => {
          console.error("Firestore onSnapshot error:", error);
          dispatch({ type: 'SET_ERROR', payload: `Failed to fetch data: ${error.message}` });
        }
      );
    }

    // Clean up the Firestore listener when the component unmounts or userId changes.
    return () => unsubscribe();
  }, [db, userId, appId]); // Depend on db and userId to re-attach listener.

  // Updates a trait's state and saves to Firestore.
  const updateTraitState = async (trait, field, value) => {
    if (!db || !userId) {
      console.error("Firestore is not initialized or user is not authenticated.");
      dispatch({ type: 'SET_ERROR', payload: 'Application is not ready. Please try again.' });
      return;
    }
    
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
      const newTraits = field === 'creator'
        ? creatorTraits.map(t => t.text === trait.text ? { ...t, [value]: !t[value] } : t)
        : feedbackTraits.map(t => t.text === trait.text ? { ...t, [value]: !t[value] } : t);

      await setDoc(userDocRef, {
        creatorTraits: field === 'creator' ? newTraits : creatorTraits,
        feedbackTraits: field === 'creator' ? feedbackTraits : newTraits,
      }, { merge: true });
    } catch (e) {
      console.error("Error updating trait:", e);
      dispatch({ type: 'SET_ERROR', payload: `Failed to save trait: ${e.message}` });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  };

  // Handles clicking a trait to toggle it's selected state.
  const onTraitClick = (trait, field, isFeedback) => {
    updateTraitState(trait, field, isFeedback ? 'givenFeedback' : 'isSelfSelected');
  };

  // Adds a new trait to the creator list.
  const onAddTrait = async () => {
    if (newTrait.trim() === '') return;
    if (!db || !userId) {
      console.error("Firestore is not initialized or user is not authenticated.");
      dispatch({ type: 'SET_ERROR', payload: 'Application is not ready. Please try again.' });
      return;
    }
    
    dispatch({ type: 'SET_SAVING', payload: true });
    try {
      const userDocRef = doc(db, 'artifacts', appId, 'users', userId);
      const newTraitItem = {
        text: newTrait.trim(),
        isSelfSelected: false,
        givenFeedback: false
      };
      
      const updatedTraits = [...creatorTraits, newTraitItem];
      await setDoc(userDocRef, {
        creatorTraits: updatedTraits,
      }, { merge: true });
      
      setNewTrait('');
    } catch (e) {
      console.error("Error adding new trait:", e);
      dispatch({ type: 'SET_ERROR', payload: `Failed to add trait: ${e.message}` });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: false });
    }
  };

  // A component to display each trait item.
  const TraitItem = ({ trait, onClick, isSelectable }) => (
    <div
      onClick={isSelectable ? onClick : null}
      className={`
        p-2 m-1 rounded-lg transition-all duration-200
        ${isSelectable ? 'cursor-pointer hover:scale-105' : ''}
        ${isSelectable && trait.isSelfSelected ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-200 text-gray-800'}
        ${isSelectable && trait.givenFeedback ? 'bg-green-600 text-white shadow-md' : ''}
      `}
    >
      {trait.text}
    </div>
  );

  // A component for each of the four quadrants.
  const Quadrant = ({ title, traits }) => (
    <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center border-t-4 border-b-4 border-gray-200 min-h-[250px] transition-transform duration-300 hover:scale-105">
      <h3 className="text-xl font-bold mb-4 text-center">{title}</h3>
      <div className="flex flex-wrap justify-center items-center h-full">
        {traits.length > 0 ? (
          traits.map((trait, index) => (
            <div
              key={index}
              className="bg-gray-100 rounded-full px-4 py-2 m-1 text-sm text-gray-700 font-medium whitespace-nowrap"
            >
              {trait.text}
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-center italic">No traits in this quadrant yet.</p>
        )}
      </div>
    </div>
  );

  // Derive the traits for each quadrant.
  const knownToSelf = creatorTraits.filter(t => t.isSelfSelected);
  const knownToOthers = feedbackTraits.filter(t => t.givenFeedback);

  const openArea = creatorTraits.filter(t => knownToSelf.includes(t) && knownToOthers.some(ft => ft.text === t.text));
  const blindSpot = knownToOthers.filter(t => !knownToSelf.some(st => st.text === t.text));
  const hiddenArea = knownToSelf.filter(t => !knownToOthers.some(ft => ft.text === t.text));
  const unknownArea = creatorTraits.filter(t => !knownToSelf.includes(t) && !knownToOthers.some(ft => ft.text === t.text));

  // Loading and Error UI
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center text-gray-600">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-blue-500 border-gray-200 mx-auto mb-4"></div>
          <p className="text-lg">Loading Johari Window...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans antialiased text-gray-900 bg-gray-50 py-12 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-2">Johari Window</h1>
          <p className="text-lg text-gray-600">Explore self-perception and how others see you.</p>
        </header>

        {/* Display Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {/* User ID display - crucial for collaboration */}
        {userId && (
          <div className="mb-6 p-4 bg-gray-100 rounded-xl text-sm text-gray-600 text-center break-all">
            <span className="font-semibold">Your User ID:</span> {userId}
          </div>
        )}

        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Creator Input Section */}
          <section className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-1">
            <h2 className="text-2xl font-bold mb-4 text-center">Your Traits</h2>
            <p className="text-gray-600 mb-4 text-center">
              Select the traits that best describe you.
            </p>
            <div className="flex flex-wrap justify-center mb-4">
              {creatorTraits.length > 0 ? (
                creatorTraits.map((trait, index) => (
                  <TraitItem
                    key={index}
                    trait={{ ...trait, givenFeedback: false }} // Always false for the creator's view
                    onClick={() => onTraitClick(trait, 'creator', false)}
                    isSelectable={true}
                  />
                ))
              ) : (
                <p className="text-gray-400 italic">Add some traits below!</p>
              )}
            </div>
            <div className="mt-6 flex items-center space-x-2">
              <input
                type="text"
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    onAddTrait();
                  }
                }}
                placeholder="Add a new trait..."
                className="flex-1 p-3 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
              />
              <button
                onClick={onAddTrait}
                disabled={isSaving}
                className="bg-indigo-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-indigo-700 transition-colors shadow-md disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </section>

          {/* Feedback Section */}
          <section className="bg-white rounded-2xl shadow-xl p-6 lg:col-span-1">
            <h2 className="text-2xl font-bold mb-4 text-center">Feedback from Others</h2>
            <p className="text-gray-600 mb-4 text-center">
              Traits your friends or teammates have selected for you.
            </p>
            <div className="flex flex-wrap justify-center">
              {feedbackTraits.length > 0 ? (
                feedbackTraits.map((trait, index) => (
                  <TraitItem
                    key={index}
                    trait={{ ...trait, isSelfSelected: false }} // Not selectable by self
                    onClick={() => onTraitClick(trait, 'feedback', true)}
                    isSelectable={true}
                  />
                ))
              ) : (
                <p className="text-gray-400 italic">No feedback received yet.</p>
              )}
            </div>
          </section>

          {/* Johari Window Quadrants */}
          <section className="bg-gray-100 rounded-2xl shadow-xl p-6 lg:col-span-1 grid grid-cols-1 gap-6">
            <h2 className="text-2xl font-bold mb-4 text-center">The Johari Window</h2>
            <div className="grid grid-cols-2 gap-4">
              <Quadrant title="Open Area" traits={openArea} />
              <Quadrant title="Blind Spot" traits={blindSpot} />
              <Quadrant title="Hidden Area" traits={hiddenArea} />
              <Quadrant title="Unknown Area" traits={unknownArea} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default App;
