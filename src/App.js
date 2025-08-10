import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, addDoc, getDocs } from 'firebase/firestore';
import { Clipboard, UserPlus, Eye, Users, Sparkles, HelpCircle, X } from 'lucide-react';

// Define the adjectives for the Johari Window.
const adjectives = [
  'able', 'accepting', 'adaptable', 'bold', 'brave', 'calm', 'caring', 'clever', 'complex',
  'confident', 'dependable', 'dignified', 'energetic', 'extroverted', 'friendly', 'giving',
  'happy', 'helpful', 'idealistic', 'independent', 'ingenious', 'intelligent', 'introverted',
  'kind', 'knowledgeable', 'logical', 'loving', 'mature', 'modest', 'nervous', 'observant',
  'organized', 'patient', 'powerful', 'proud', 'quiet', 'reflective', 'relaxed', 'religious',
  'responsive', 'searching', 'self-assertive', 'self-conscious', 'sensible', 'sentimental',
  'shy', 'silly', 'spontaneous', 'sympathetic', 'tense', 'trustworthy', 'warm', 'wise', 'witty'
];

// Initialize Firebase App from environment variables
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Helper function to copy text to clipboard
const copyToClipboard = async (text) => {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (err) {
    console.error('Failed to copy text:', err);
    return false;
  }
};

// Help Modal Component
const HelpModal = ({ show, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X size={24} />
        </button>
        <h2 className="text-3xl font-bold text-slalom-blue mb-4">Guide to the Johari Window</h2>
        <p className="text-gray-600 mb-4">
          The Johari Window is a technique designed to help people better understand their relationship with themselves and others. It's a simple and powerful tool for self-awareness and team development.
        </p>

        <h3 className="text-xl font-bold text-slalom-blue-dark mt-6 mb-2">The Four Quadrants</h3>
        <p className="text-gray-800 mb-2">The Johari Window is divided into four quadrants, each representing different aspects of your personality and professional behavior.</p>
        <ul className="list-disc list-inside space-y-2 mb-4">
          <li>
            <strong className="text-slalom-blue">Arena (Open Area):</strong> This includes traits known by both you and others. This area represents your public self and is the foundation for effective communication.
          </li>
          <li>
            <strong className="text-slalom-teal">Blind Spot:</strong> These are traits others see in you that you are unaware of. Gaining insight into this area is key to personal growth and self-awareness.
          </li>
          <li>
            <strong className="text-slalom-orange">Facade (Hidden Area):</strong> These are traits you know about yourself but keep hidden from others. Sharing aspects of this area can build trust and deepen relationships.
          </li>
          <li>
            <strong className="text-slalom-red">Unknown Area:</strong> These are traits unknown by both you and others. They may emerge through new experiences or self-discovery.
          </li>
        </ul>

        <h3 className="text-xl font-bold text-slalom-blue-dark mt-6 mb-2">How to Use This Tool</h3>
        <p className="text-gray-800 mb-4">
          The process is collaborative and insightful:
          <ol className="list-decimal list-inside space-y-2 mt-2">
            <li>Start by selecting the adjectives you believe describe you (Self-Assessment).</li>
            <li>Share your unique link with teammates, who will then select adjectives they believe describe you (Peer Feedback).</li>
            <li>The app will automatically populate your Johari Window, showing how your self-perception aligns with your peers' perceptions.</li>
            <li>Use the Gemini-powered insights to get a deeper understanding of your results.</li>
          </ol>
        </p>
        
        <h3 className="text-xl font-bold text-slalom-blue-dark mt-6 mb-2">Tips for Feedback</h3>
        <p className="text-gray-800 mb-2">
          This exercise works best when participants are open and honest.
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong className="text-slalom-blue">Give Feedback:</strong> Focus on constructive and specific observations. Use "I" statements to describe your perspective.
          </li>
          <li>
            <strong className="text-slalom-blue">Receive Feedback:</strong> Listen actively without becoming defensive. Remember that feedback is a gift that helps you grow.
          </li>
        </ul>
      </div>
    </div>
  );
};

// Main App component
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentPage, setCurrentPage] = useState('landing'); // landing, selfAssessment, share, feedback, results
  const [selectedTraits, setSelectedTraits] = useState([]);
  const [peerSelections, setPeerSelections] = useState([]);
  const [uniqueUrl, setUniqueUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [teamMemberCount, setTeamMemberCount] = useState(0);

  // New states for Gemini API integration
  const [llmInsights, setLlmInsights] = useState(null);
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [blindSpotAnalysis, setBlindSpotAnalysis] = useState(null);
  const [isBlindSpotLoading, setIsBlindSpotLoading] = useState(false);
  const [elevatorPitch, setElevatorPitch] = useState(null);
  const [isPitchLoading, setIsPitchLoading] = useState(false);
  
  // State for Help Modal
  const [showHelpModal, setShowHelpModal] = useState(false);

  // useEffect for Firebase authentication, runs only once on mount.
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        console.log("Authenticated with UID:", authUser.uid);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Anonymous sign-in failed:', err);
          setError('Authentication failed. Please refresh the page.');
        }
      }
      setIsAuthReady(true);
    });
    return () => unsubscribeAuth();
  }, []);

  // useEffect for handling data fetching after authentication is ready.
  useEffect(() => {
    if (!isAuthReady || !user) return;

    setLoading(true);
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');

    const fetchSessionData = async (id) => {
      const sessionDocRef = doc(db, `artifacts/${appId}/public/data/windows/${id}`);
      const feedbackCollectionRef = collection(db, `artifacts/${appId}/public/data/windows/${id}/feedback`);

      const unsubscribeDoc = onSnapshot(sessionDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          setSelectedTraits(data.selfAssessment || []);
          setUniqueUrl(`${window.location.origin}?session=${id}`);
        } else {
          setError('Invalid session ID.');
          setCurrentPage('landing');
        }
        setLoading(false);
      }, (err) => {
        setError('Error fetching session data.');
        console.error(err);
        setLoading(false);
      });

      const unsubscribeFeedback = onSnapshot(feedbackCollectionRef, (querySnapshot) => {
        const feedbackDocs = querySnapshot.docs.map(doc => doc.data());
        setPeerSelections(feedbackDocs.map(f => f.traits).flat());
        setTeamMemberCount(querySnapshot.docs.length);
        if (sessionId) {
           setCurrentPage('feedback');
        } else if (selectedTraits.length > 0) {
           setCurrentPage('results');
        } else {
           setCurrentPage('selfAssessment');
        }
      }, (err) => {
        setError('Error fetching feedback data.');
        console.error(err);
      });

      return () => {
        unsubscribeDoc();
        unsubscribeFeedback();
      };
    };

    if (sessionId) {
      fetchSessionData(sessionId);
    } else {
      fetchSessionData(user.uid);
    }
  }, [isAuthReady, user, selectedTraits.length]);


  const handleStartSession = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/windows/${user.uid}`);
      await setDoc(docRef, {
        selfAssessment: [],
        creatorId: user.uid,
      });
      setUniqueUrl(`${window.location.origin}?session=${user.uid}`);
      setCurrentPage('selfAssessment');
    } catch (e) {
      setError('Failed to start session. Please try again.');
      console.error(e);
    }
  };

  const handleSelfAssessmentSubmit = async () => {
    if (!user || selectedTraits.length === 0) {
      setError('Please select at least one trait.');
      return;
    }
    try {
      const docRef = doc(db, `artifacts/${appId}/public/data/windows/${user.uid}`);
      await updateDoc(docRef, {
        selfAssessment: selectedTraits,
      });
      setCurrentPage('results');
    } catch (e) {
      setError('Failed to save assessment. Please try again.');
      console.error(e);
    }
  };
  
  const handlePeerFeedbackSubmit = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    if (!sessionId || !user || selectedTraits.length === 0) {
      setError('Failed to submit feedback. Please select traits.');
      return;
    }
    try {
      const feedbackCollectionRef = collection(db, `artifacts/${appId}/public/data/windows/${sessionId}/feedback`);
      await addDoc(feedbackCollectionRef, {
        traits: selectedTraits,
        feedbackId: user.uid,
      });
      setCurrentPage('results');
    } catch (e) {
      setError('Failed to submit feedback. Please try again.');
      console.error(e);
    }
  };

  const getJohariQuadrants = () => {
    if (!selectedTraits || !peerSelections) {
      return { arena: [], blindSpot: [], facade: [], unknown: [] };
    }
    const peerSet = new Set(peerSelections);
    const selfSet = new Set(selectedTraits);
    const arena = adjectives.filter(trait => selfSet.has(trait) && peerSet.has(trait));
    const blindSpot = adjectives.filter(trait => !selfSet.has(trait) && peerSet.has(trait));
    const facade = adjectives.filter(trait => selfSet.has(trait) && !peerSet.has(trait));
    const unknown = adjectives.filter(trait => !selfSet.has(trait) && !peerSet.has(trait));
    return { arena, blindSpot, facade, unknown };
  };

  const quadrants = getJohariQuadrants();

  const handleGetInsights = async () => {
    setIsLlmLoading(true);
    setLlmInsights(null);
    const prompt = `Act as a professional career coach and team facilitator. Based on the following Johari Window results, provide a concise summary and 3-5 bullet points of actionable advice.
    Arena (Open Area - Known by self and others): ${quadrants.arena.join(', ') || 'None'}
    Blind Spot (Unknown by self, known by others): ${quadrants.blindSpot.join(', ') || 'None'}
    Facade (Hidden Area - Known by self, unknown by others): ${quadrants.facade.join(', ') || 'None'}
    Unknown (Unknown by self and others): ${quadrants.unknown.join(', ') || 'None'}
    `;
    try {
        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiKey = ""
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            setLlmInsights(text);
        } else {
            setLlmInsights('Sorry, I was unable to generate insights at this time.');
        }
    } catch (e) {
      console.error('Gemini API call failed:', e);
      setLlmInsights('Sorry, there was an error generating the insights.');
    } finally {
      setIsLlmLoading(false);
    }
  };

  const handleGetBlindSpotAnalysis = async () => {
    setIsBlindSpotLoading(true);
    setBlindSpotAnalysis(null);
    const prompt = `Act as a professional coach. Explain the meaning and potential impact of the following traits in a professional context. Focus on how a person might unintentionally project these traits and provide a brief sentence on how to become more aware of them. The traits are: ${quadrants.blindSpot.join(', ') || 'None'}. If the list is empty, explain what a blind spot is and why it's a good thing to not have one.`;
    try {
        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiKey = ""
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            setBlindSpotAnalysis(text);
        } else {
            setBlindSpotAnalysis('Sorry, I was unable to generate a blind spot analysis at this time.');
        }
    } catch (e) {
      console.error('Gemini API call failed:', e);
      setBlindSpotAnalysis('Sorry, there was an error generating the blind spot analysis.');
    } finally {
      setIsBlindSpotLoading(false);
    }
  };

  const handleGenerateElevatorPitch = async () => {
    setIsPitchLoading(true);
    setElevatorPitch(null);
    const prompt = `Based on the following professional traits from a Johari Window 'Arena' quadrant, write a concise and impactful professional bio or elevator pitch (around 50-75 words). The traits are: ${quadrants.arena.join(', ') || 'None'}.`;
    try {
        const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
        const payload = { contents: chatHistory };
        const apiKey = ""
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            setElevatorPitch(text);
        } else {
            setElevatorPitch('Sorry, I was unable to generate an elevator pitch at this time.');
        }
    } catch (e) {
      console.error('Gemini API call failed:', e);
      setElevatorPitch('Sorry, there was an error generating the elevator pitch.');
    } finally {
      setIsPitchLoading(false);
    }
  };

  // Loading state
  if (loading || !isAuthReady) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-slalom-blue"></div>
      </div>
    );
  }

  // --- Render different pages based on currentPage state ---
  // The main app container includes a help button and the help modal
  return (
    <div className="min-h-screen bg-gray-100 font-sans relative">
      <button 
        onClick={() => setShowHelpModal(true)} 
        className="fixed top-4 right-4 z-50 p-2 bg-slalom-blue text-white rounded-full shadow-lg hover:bg-slalom-blue-dark transition-colors duration-300"
        aria-label="Help"
      >
        <HelpCircle size={24} />
      </button>
      
      <HelpModal show={showHelpModal} onClose={() => setShowHelpModal(false)} />

      {/* --- Page Content Rendering --- */}
      {currentPage === 'landing' && (
        <div className="flex items-center justify-center h-screen p-4">
          <div className="bg-white p-8 md:p-12 rounded-xl shadow-2xl max-w-lg text-center">
            <h1 className="text-4xl font-extrabold text-slalom-blue mb-4">Johari Window Tool</h1>
            <p className="text-lg text-gray-600 mb-6">
              A simple, collaborative tool to help your team better understand interpersonal relationships.
            </p>
            <button
              onClick={handleStartSession}
              className="w-full bg-slalom-blue text-white font-bold py-3 px-6 rounded-lg hover:bg-slalom-blue-dark transition-colors duration-300 shadow-lg transform hover:scale-105"
            >
              Start My Window
            </button>
          </div>
        </div>
      )}

      {currentPage === 'selfAssessment' && (
        <div className="p-4 pt-12 md:p-8">
          <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg">
            <h1 className="text-3xl font-bold text-slalom-blue mb-2">Self-Assessment</h1>
            <p className="text-gray-600 mb-6">
              Select the adjectives that you believe describe you.
            </p>
            {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {adjectives.map((trait) => (
                <button
                  key={trait}
                  onClick={() => {
                    setSelectedTraits(prev =>
                      prev.includes(trait)
                        ? prev.filter(t => t !== trait)
                        : [...prev, trait]
                    );
                  }}
                  className={`px-4 py-2 rounded-full border-2 transition-all duration-200
                    ${selectedTraits.includes(trait)
                      ? 'bg-slalom-teal text-white border-slalom-teal shadow-md'
                      : 'bg-white text-gray-800 border-gray-300 hover:border-slalom-teal-light'
                    }`}
                >
                  {trait}
                </button>
              ))}
            </div>
            <button
              onClick={handleSelfAssessmentSubmit}
              className="w-full bg-slalom-blue text-white font-bold py-3 px-6 rounded-lg hover:bg-slalom-blue-dark transition-colors duration-300 shadow-lg"
            >
              Submit Self-Assessment
            </button>
          </div>
        </div>
      )}

      {currentPage === 'feedback' && (
        <div className="p-4 pt-12 md:p-8">
          <div className="max-w-4xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-lg">
            <h1 className="text-3xl font-bold text-slalom-blue mb-2">Peer Feedback</h1>
            <p className="text-gray-600 mb-6">
              Select the adjectives that you believe describe this team member.
            </p>
            {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {adjectives.map((trait) => (
                <button
                  key={trait}
                  onClick={() => {
                    setSelectedTraits(prev =>
                      prev.includes(trait)
                        ? prev.filter(t => t !== trait)
                        : [...prev, trait]
                    );
                  }}
                  className={`px-4 py-2 rounded-full border-2 transition-all duration-200
                    ${selectedTraits.includes(trait)
                      ? 'bg-slalom-teal text-white border-slalom-teal shadow-md'
                      : 'bg-white text-gray-800 border-gray-300 hover:border-slalom-teal-light'
                    }`}
                >
                  {trait}
                </button>
              ))}
            </div>
            <button
              onClick={handlePeerFeedbackSubmit}
              className="w-full bg-slalom-blue text-white font-bold py-3 px-6 rounded-lg hover:bg-slalom-blue-dark transition-colors duration-300 shadow-lg"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      )}

      {currentPage === 'results' && (
        <div className="p-4 md:p-8 pt-12">
          <div className="max-w-5xl mx-auto">
            {uniqueUrl && (
              <div className="bg-white p-6 rounded-xl shadow-lg mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-grow">
                  <p className="text-sm font-semibold text-gray-500">Share this link with your team:</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-slalom-teal break-all">{uniqueUrl}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    copyToClipboard(uniqueUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-2 bg-slalom-blue text-white px-4 py-2 rounded-lg hover:bg-slalom-blue-dark transition-colors duration-300 shadow-md"
                >
                  <Clipboard className="w-5 h-5" />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}
            
            <div className="text-center mb-6">
              <h1 className="text-4xl font-extrabold text-slalom-blue mb-2">Your Johari Window</h1>
              <p className="text-lg text-gray-600">
                {uniqueUrl ? (
                  <>Your self-assessment is complete. You have received feedback from <strong>{teamMemberCount}</strong> team members.</>
                ) : (
                  <>Thank you for your feedback! The results will update live as more team members respond.</>
                )}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slalom-blue">
                <h2 className="text-2xl font-bold text-slalom-blue flex items-center gap-2 mb-2"><Eye className="w-6 h-6" />Arena (Open Area)</h2>
                <p className="text-gray-600 mb-4">Known by you and known by others.</p>
                <ul className="flex flex-wrap gap-2">
                  {quadrants.arena.length > 0 ? (
                    quadrants.arena.map(trait => (
                      <li key={trait} className="bg-slalom-blue-light text-slalom-blue font-semibold px-3 py-1 rounded-full">{trait}</li>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No traits in this area yet.</p>
                  )}
                </ul>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slalom-teal">
                <h2 className="text-2xl font-bold text-slalom-teal flex items-center gap-2 mb-2"><UserPlus className="w-6 h-6" />Blind Spot</h2>
                <p className="text-gray-600 mb-4">Unknown by you and known by others.</p>
                <ul className="flex flex-wrap gap-2">
                  {quadrants.blindSpot.length > 0 ? (
                    quadrants.blindSpot.map(trait => (
                      <li key={trait} className="bg-slalom-teal-light text-slalom-teal font-semibold px-3 py-1 rounded-full">{trait}</li>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No traits in this area yet.</p>
                  )}
                </ul>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slalom-orange">
                <h2 className="text-2xl font-bold text-slalom-orange flex items-center gap-2 mb-2"><Users className="w-6 h-6" />Facade (Hidden Area)</h2>
                <p className="text-gray-600 mb-4">Known by you and unknown by others.</p>
                <ul className="flex flex-wrap gap-2">
                  {quadrants.facade.length > 0 ? (
                    quadrants.facade.map(trait => (
                      <li key={trait} className="bg-slalom-orange-light text-slalom-orange font-semibold px-3 py-1 rounded-full">{trait}</li>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No traits in this area yet.</p>
                  )}
                </ul>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-slalom-red">
                <h2 className="text-2xl font-bold text-slalom-red flex items-center gap-2 mb-2">Unknown</h2>
                <p className="text-gray-600 mb-4">Unknown by you and unknown by others.</p>
                <ul className="flex flex-wrap gap-2">
                  {quadrants.unknown.length > 0 ? (
                    quadrants.unknown.map(trait => (
                      <li key={trait} className="bg-slalom-red-light text-slalom-red font-semibold px-3 py-1 rounded-full">{trait}</li>
                    ))
                  ) : (
                    <p className="text-gray-400 italic">No traits in this area yet.</p>
                  )}
                </ul>
              </div>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={handleGetInsights}
                disabled={isLlmLoading}
                className="w-full flex items-center justify-center gap-2 bg-slalom-blue text-white font-bold py-3 px-6 rounded-lg hover:bg-slalom-blue-dark transition-colors duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLlmLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-r-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Get Personalized Insights</>
                )}
              </button>
              <button
                onClick={handleGetBlindSpotAnalysis}
                disabled={isBlindSpotLoading}
                className="w-full flex items-center justify-center gap-2 bg-slalom-teal text-white font-bold py-3 px-6 rounded-lg hover:bg-slalom-teal-dark transition-colors duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBlindSpotLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-r-2 border-white"></div>
                    Analyzing...
                  </>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Get Blind Spot Analysis</>
                )}
              </button>
              <button
                onClick={handleGenerateElevatorPitch}
                disabled={isPitchLoading}
                className="w-full flex items-center justify-center gap-2 bg-slalom-orange text-white font-bold py-3 px-6 rounded-lg hover:bg-slalom-orange-dark transition-colors duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPitchLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-r-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Generate Professional Bio</>
                )}
              </button>
            </div>
            
            {llmInsights && (
              <div className="mt-6 bg-white p-6 rounded-xl shadow-lg border-t-4 border-slalom-blue">
                <h2 className="text-2xl font-bold text-slalom-blue mb-4">Your Personalized Insights</h2>
                <div className="prose max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: llmInsights.replace(/\n/g, '<br/>') }}></div>
              </div>
            )}

            {blindSpotAnalysis && (
              <div className="mt-6 bg-white p-6 rounded-xl shadow-lg border-t-4 border-slalom-teal">
                <h2 className="text-2xl font-bold text-slalom-teal mb-4">Blind Spot Analysis</h2>
                <div className="prose max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: blindSpotAnalysis.replace(/\n/g, '<br/>') }}></div>
              </div>
            )}
            
            {elevatorPitch && (
              <div className="mt-6 bg-white p-6 rounded-xl shadow-lg border-t-4 border-slalom-orange">
                <h2 className="text-2xl font-bold text-slalom-orange mb-4">Your Professional Bio</h2>
                <div className="prose max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: elevatorPitch.replace(/\n/g, '<br/>') }}></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
