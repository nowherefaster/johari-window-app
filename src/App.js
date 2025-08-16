import React, { useEffect, useReducer, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// Core Firebase configuration from the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : null;
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
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
  const [isPanelVisible, setPanelVisible] = useState(false);

  // Firebase instances
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);

  // useEffect for Firebase Initialization and Authentication.
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
            // Sign in anonymously if no user is found.
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

  // Handles clicking a trait to toggle its selected state.
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
  const TraitItem = ({ trait, onClick, isSelectable, isFeedback }) => (
    <div
      onClick={isSelectable ? onClick : null}
      className={`
        px-4 py-2 m-1 rounded-full text-sm font-medium transition-colors duration-200
        ${isSelectable ? 'cursor-pointer hover:bg-gray-300' : 'cursor-default'}
        ${isFeedback && trait.givenFeedback
          ? 'bg-blue-600 text-white'
          : !isFeedback && trait.isSelfSelected
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 text-gray-800'
        }
      `}
    >
      {trait.text}
    </div>
  );


  // A component for each of the four quadrants.
  const Quadrant = ({ title, traits }) => (
    <div className="bg-white rounded-xl shadow-md p-5 min-h-[150px] flex flex-col">
      <h3 className="text-lg font-semibold mb-2 text-center">{title}</h3>
      <div className="flex-grow flex flex-wrap justify-center items-center">
        {traits.length > 0 ? (
          traits.map((trait, index) => (
            <div key={index} className="bg-gray-100 rounded-full px-3 py-1 m-1 text-xs text-gray-700 font-medium">
              {trait.text}
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-sm italic">No traits here yet.</p>
        )}
      </div>
    </div>
  );

  // Derive the traits for each quadrant.
  const openArea = creatorTraits.filter(t => t.isSelfSelected && feedbackTraits.some(ft => ft.text === t.text && ft.givenFeedback));
  const blindSpot = feedbackTraits.filter(ft => ft.givenFeedback && !creatorTraits.some(t => t.text === ft.text && t.isSelfSelected));
  const hiddenArea = creatorTraits.filter(t => t.isSelfSelected && !feedbackTraits.some(ft => ft.text === t.text && ft.givenFeedback));
  const unknownArea = creatorTraits.filter(t => !t.isSelfSelected && !feedbackTraits.some(ft => ft.text === t.text));

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
    <div className="font-sans antialiased bg-gray-50 text-gray-800 min-h-screen p-8">
      <div className="max-w-6xl mx-auto relative">
        {/* Debug Panel */}
        <div className="absolute top-0 right-0 p-4">
          <button
            onClick={() => setPanelVisible(!isPanelVisible)}
            className="p-2 rounded-full bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300 transition-colors"
          >
            {isPanelVisible ? 'Hide Debug' : 'Show Debug'}
          </button>
          {isPanelVisible && (
            <div className="mt-2 p-4 bg-gray-100 rounded-lg shadow-md max-w-sm">
              <h4 className="font-bold text-sm mb-2">Debug Info</h4>
              <p className="text-xs break-all">
                <strong>User ID:</strong> {userId || 'N/A'}
              </p>
              <p className="text-xs mt-1">
                <strong>Is Saving:</strong> {isSaving ? 'Yes' : 'No'}
              </p>
            </div>
          )}
        </div>

        <header className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Johari Window</h1>
          <p className="text-lg text-gray-600">Explore your self-awareness and how others perceive you.</p>
        </header>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl relative mb-6">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">Your Traits (Known to Self)</h2>
            <p className="text-gray-600 mb-4 text-center">
              Select the traits that you believe describe yourself.
            </p>
            <div className="flex flex-wrap justify-center">
              {creatorTraits.map((trait, index) => (
                <TraitItem
                  key={index}
                  trait={trait}
                  onClick={() => onTraitClick(trait, 'creator', false)}
                  isSelectable={true}
                  isFeedback={false}
                />
              ))}
            </div>
            <div className="mt-6 flex items-center space-x-2">
              <input
                type="text"
                value={newTrait}
                onChange={(e) => setNewTrait(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') onAddTrait();
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

          <section className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold mb-4 text-center">Feedback from Others (Known to Others)</h2>
            <p className="text-gray-600 mb-4 text-center">
              Click on a trait if you think it describes the other person.
            </p>
            <div className="flex flex-wrap justify-center">
              {feedbackTraits.map((trait, index) => (
                <TraitItem
                  key={index}
                  trait={trait}
                  onClick={() => onTraitClick(trait, 'feedback', true)}
                  isSelectable={true}
                  isFeedback={true}
                />
              ))}
            </div>
          </section>

          <section className="bg-gray-100 rounded-2xl shadow-xl p-6 col-span-1 lg:col-span-2">
            <h2 className="text-2xl font-bold mb-6 text-center">The Johari Window</h2>
            <div className="grid grid-cols-2 gap-6">
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
