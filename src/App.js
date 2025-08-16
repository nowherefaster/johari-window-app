import { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, deleteDoc, collection, query, where, addDoc, getDocs } from 'firebase/firestore';

// All the components are defined within the main App component for a self-contained solution.

const Card = ({ children, title, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
    <h2 className="text-xl font-bold mb-4 text-center">{title}</h2>
    {children}
  </div>
);

const Input = ({ label, value, onChange, placeholder = '' }) => (
  <div className="mb-4">
    <label className="block text-gray-700 font-semibold mb-2">{label}</label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const Button = ({ children, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 ${className}`}
  >
    {children}
  </button>
);

const UserDisplay = ({ userId, isPublic }) => (
  <div className="text-sm text-gray-500 mb-4">
    User ID: <span className="font-mono bg-gray-100 p-1 rounded-md">{userId}</span>
    {isPublic && (
      <span className="ml-2 px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs font-semibold">
        Public
      </span>
    )}
  </div>
);

const LoadingIndicator = () => (
  <div className="flex justify-center items-center h-full">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
  </div>
);

const Header = ({ userId }) => (
  <header className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-xl rounded-b-3xl">
    <h1 className="text-4xl font-extrabold text-center mb-2">Collaborative Planner</h1>
    <p className="text-lg text-center opacity-90">Plan tasks together in real-time!</p>
    <div className="mt-4 text-center text-sm font-light opacity-80">
      <span className="bg-white bg-opacity-20 px-4 py-2 rounded-full">
        Logged in as: <span className="font-mono tracking-wider">{userId}</span>
      </span>
    </div>
  </header>
);

const PlanList = ({ items, onUpdate, onDelete, isPublic }) => (
  <div className="space-y-4">
    {items.length === 0 ? (
      <div className="text-center text-gray-500 italic">No plans yet. Add one above!</div>
    ) : (
      items.map(item => (
        <div key={item.id} className="p-4 bg-gray-50 rounded-lg flex items-start justify-between">
          <div className="flex-1 mr-4">
            <p className="text-lg font-semibold text-gray-800">{item.task}</p>
            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
          </div>
          <div className="flex space-x-2">
            <Button className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600" onClick={() => onUpdate(item)}>
              Update
            </Button>
            <Button className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600" onClick={() => onDelete(item.id)}>
              Delete
            </Button>
          </div>
        </div>
      ))
    )}
  </div>
);

const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userId, setUserId] = useState(null);

  const [task, setTask] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [plans, setPlans] = useState([]);
  const [sharedUserId, setSharedUserId] = useState('');
  const [sharedPlans, setSharedPlans] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Constants from the Canvas environment
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  const firebaseConfig = useMemo(() => {
    try {
      return JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    } catch (e) {
      console.error("Failed to parse Firebase config", e);
      return {};
    }
  }, []);
  const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

  // 1. Firebase Initialization & Authentication
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
          throw new Error("Firebase config is not defined or is empty.");
        }
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const dbInstance = getFirestore(app);

        setDb(dbInstance);
        setAuth(authInstance);

        onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
            setIsAuthReady(true);
            setIsLoading(false);
          } else {
            // Sign in anonymously if no token is available
            try {
              if (initialAuthToken) {
                await signInWithCustomToken(authInstance, initialAuthToken);
              } else {
                await signInAnonymously(authInstance);
              }
            } catch (authError) {
              console.error("Firebase auth error:", authError);
              setError("Authentication failed. Please try again.");
              setIsLoading(false);
            }
          }
        });
      } catch (e) {
        console.error("Firebase initialization failed:", e);
        setError("Failed to connect to the database. Please check the configuration.");
        setIsLoading(false);
      }
    };
    initializeFirebase();
  }, [firebaseConfig, initialAuthToken]);

  // Helper function to get the correct Firestore collection path
  const getCollectionPath = (isPublic, uid) => {
    if (!uid) return null;
    return isPublic
      ? `/artifacts/${appId}/public/data/plans`
      : `/artifacts/${appId}/users/${uid}/plans`;
  };

  // 2. Real-time data fetching for user's own plans
  useEffect(() => {
    if (!db || !isAuthReady || !userId) return;

    const path = getCollectionPath(isPublic, userId);
    if (!path) return;

    const plansRef = collection(db, path);
    const unsubscribe = onSnapshot(plansRef, (snapshot) => {
      const fetchedPlans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => a.timestamp - b.timestamp); // Sort by timestamp
      setPlans(fetchedPlans);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching plans:", error);
      setError("Failed to load plans.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, isAuthReady, userId, isPublic]);

  // Handle CRUD operations
  const addOrUpdatePlan = useCallback(async (e) => {
    e.preventDefault();
    if (!db || !userId) {
      setError("Database not ready. Please wait.");
      return;
    }
    if (!task) {
      setError("Task cannot be empty.");
      return;
    }
    try {
      const planData = {
        task,
        description,
        timestamp: Date.now()
      };
      const path = getCollectionPath(isPublic, userId);
      if (isUpdating) {
        const planDocRef = doc(db, path, currentPlanId);
        await setDoc(planDocRef, planData);
        setIsUpdating(false);
        setCurrentPlanId(null);
      } else {
        await addDoc(collection(db, path), planData);
      }
      setTask('');
      setDescription('');
      setError(null);
    } catch (e) {
      console.error("Error adding/updating document: ", e);
      setError("Failed to save plan.");
    }
  }, [db, userId, task, description, isPublic, isUpdating, currentPlanId]);

  const deletePlan = useCallback(async (id) => {
    if (!db || !userId) return;
    try {
      const path = getCollectionPath(isPublic, userId);
      const planDocRef = doc(db, path, id);
      await deleteDoc(planDocRef);
      setError(null);
    } catch (e) {
      console.error("Error deleting document: ", e);
      setError("Failed to delete plan.");
    }
  }, [db, userId, isPublic]);

  const startUpdate = (plan) => {
    setTask(plan.task);
    setDescription(plan.description);
    setCurrentPlanId(plan.id);
    setIsUpdating(true);
  };

  const cancelUpdate = () => {
    setTask('');
    setDescription('');
    setCurrentPlanId(null);
    setIsUpdating(false);
  };

  const fetchSharedPlans = useCallback(async () => {
    if (!db || !isAuthReady) return;
    if (!sharedUserId) {
      setError("Please enter a user ID to fetch shared plans.");
      return;
    }
    setIsLoading(true);
    try {
      const path = getCollectionPath(true, sharedUserId);
      const q = query(collection(db, path));
      const querySnapshot = await getDocs(q);
      const fetchedPlans = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => a.timestamp - b.timestamp);
      setSharedPlans(fetchedPlans);
      setError(null);
    } catch (e) {
      console.error("Error fetching shared plans:", e);
      setError("Failed to fetch shared plans. Make sure the user ID is correct and they have public plans.");
      setSharedPlans([]);
    } finally {
      setIsLoading(false);
    }
  }, [db, isAuthReady, sharedUserId]);

  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans antialiased text-gray-800 flex flex-col items-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        {userId && <Header userId={userId} />}

        <div className="grid md:grid-cols-2 gap-8">
          <Card title="My Plans">
            <UserDisplay userId={userId} isPublic={isPublic} />
            <form onSubmit={addOrUpdatePlan} className="space-y-4">
              <Input
                label="Task"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="e.g., Finish project report"
              />
              <Input
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Draft the introduction and conclusion"
              />
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={isPublic}
                  onChange={() => setIsPublic(!isPublic)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isPublic" className="text-gray-700">Make this plan public</label>
              </div>
              <div className="flex space-x-2">
                <Button type="submit" className="flex-1">
                  {isUpdating ? 'Update Plan' : 'Add Plan'}
                </Button>
                {isUpdating && (
                  <Button type="button" onClick={cancelUpdate} className="flex-1 bg-gray-500 hover:bg-gray-600">
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-bold mb-4">My Plans List</h3>
              <PlanList items={plans} onUpdate={startUpdate} onDelete={deletePlan} isPublic={isPublic} />
            </div>
          </Card>

          <Card title="Shared Plans">
            <Input
              label="User ID to Share With"
              value={sharedUserId}
              onChange={(e) => setSharedUserId(e.target.value)}
              placeholder="Paste another user's ID here"
            />
            <Button onClick={fetchSharedPlans}>Fetch Public Plans</Button>
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-bold mb-4">Shared Plans List</h3>
              <PlanList items={sharedPlans} onUpdate={() => {}} onDelete={() => {}} isPublic={true} />
            </div>
          </Card>
        </div>
      </div>
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white p-4 rounded-lg shadow-xl animate-fade-in-up">
          <p className="font-semibold">{error}</p>
        </div>
      )}
    </div>
  );
};

export default App;
