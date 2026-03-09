import React, { useState, useEffect } from 'react';
import { auth as firebaseAuth, storage as firebaseStorage, db as firestoreDb } from './config/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  getDoc,
  updateDoc,
  where,
  limit,
  getDocs
} from 'firebase/firestore';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [stats, setStats] = useState([
    { title: 'Total Students', value: '0', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197', color: 'rgba(56, 189, 248, 0.2)', text: '#38bdf8' },
    { title: 'Tests Completed', value: '0', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'rgba(16, 185, 129, 0.2)', text: '#10b981' },
    { title: 'Avg. Accuracy', value: '0%', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: 'rgba(245, 158, 11, 0.2)', text: '#f59e0b' }
  ]);

  const [notes, setNotes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [tests, setTests] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  const [newNote, setNewNote] = useState({ title: '', subject: '', link: '' });
  const [newAssignment, setNewAssignment] = useState({ title: '', subject: '', deadline: '' });
  const [newTest, setNewTest] = useState({ title: '', subject: '', durationMinutes: 60, negativeMark: 0.25, instructions: '1. All questions are compulsory.\n2. Negative marking is applicable.', questionsCount: 10, answerKey: Array(10).fill(0) });

  const [noteFile, setNoteFile] = useState(null);
  const [assignmentFile, setAssignmentFile] = useState(null);
  const [testFile, setTestFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const [activeTest, setActiveTest] = useState(null);
  const [testMode, setTestMode] = useState('instructions');
  const [timer, setTimer] = useState(0);
  const [answers, setAnswers] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [testFilter, setTestFilter] = useState('All');

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false, hiding: false, duration: 4000 });
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', message: '', onConfirm: null });

  const showToast = (message, type = 'success', duration = 4000) => {
    setToast({ message, type, visible: true, hiding: false, duration });
    setTimeout(() => setToast(prev => ({ ...prev, hiding: true })), duration - 350);
    setTimeout(() => setToast(prev => ({ ...prev, visible: false, hiding: false })), duration);
  };

  const dismissToast = () => {
    setToast(prev => ({ ...prev, hiding: true }));
    setTimeout(() => setToast(prev => ({ ...prev, visible: false, hiding: false })), 350);
  };

  const askConfirm = (title, message, onConfirm) => {
    setConfirmDialog({ visible: true, title, message, onConfirm });
  };

  const navItems = [
    { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'Assignments', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { name: 'Study Material', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { name: 'Tests', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
  ];

  if (user?.role === 'admin') {
    if (!navItems.some(i => i.name === 'Students')) navItems.push({ name: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197' });
    if (!navItems.some(i => i.name === 'Attendance')) navItems.push({ name: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' });
    if (!navItems.some(i => i.name === 'Admin Panel')) navItems.push({ name: 'Admin Panel', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37' });
  }

  // Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        try {
          const userDoc = await getDoc(doc(firestoreDb, 'users', fbUser.uid));
          const userData = userDoc.exists() ? userDoc.data() : { name: fbUser.displayName, email: fbUser.email, role: 'student', isApproved: false };
          setUser({ ...userData, id: fbUser.uid });
          setToken(await fbUser.getIdToken());
        } catch (err) {
          console.error("Auth sync error:", err);
          setUser({ name: fbUser.displayName, email: fbUser.email, role: 'student', isApproved: false, id: fbUser.uid });
        }
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Current User Observer (to unlock dashboard instantly)
  useEffect(() => {
    if (!firebaseAuth.currentUser) return;
    const unsub = onSnapshot(doc(firestoreDb, 'users', firebaseAuth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        setUser(prev => ({ ...prev, ...snap.data(), id: snap.id }));
      }
    });
    return () => unsub();
  }, [loading]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // PWA Install Prompt Listener
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      showToast('App installed successfully! 🎉', 'success');
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  // Real-time Data Listeners
  useEffect(() => {
    if (!user) return;

    const unsubNotes = onSnapshot(query(collection(firestoreDb, 'notes'), orderBy('createdAt', 'desc')), (snap) => {
      setNotes(snap.docs.map(doc => ({ ...doc.data(), _id: doc.id })));
    });

    const unsubAssign = onSnapshot(query(collection(firestoreDb, 'assignments'), orderBy('createdAt', 'desc')), (snap) => {
      setAssignments(snap.docs.map(doc => ({ ...doc.data(), _id: doc.id })));
    });

    const unsubTests = onSnapshot(query(collection(firestoreDb, 'tests'), orderBy('createdAt', 'desc')), (snap) => {
      setTests(snap.docs.map(doc => ({ ...doc.data(), _id: doc.id })));
    });

    const unsubActivities = onSnapshot(query(collection(firestoreDb, 'activities'), orderBy('createdAt', 'desc'), limit(15)), (snap) => {
      setRecentActivities(snap.docs.map(doc => ({ ...doc.data(), _id: doc.id })));
    });

    if (user?.email) {
      const unsubResults = onSnapshot(query(collection(firestoreDb, 'testResults'), where('userEmail', '==', user.email)), (snap) => {
        setCompletedTests(snap.docs.map(doc => doc.data().testId));
      });
      return () => { unsubNotes(); unsubAssign(); unsubTests(); unsubActivities(); unsubResults(); };
    }

    return () => { unsubNotes(); unsubAssign(); unsubTests(); unsubActivities(); };
  }, [user]);

  // Test Timer Logic
  useEffect(() => {
    let interval = null;
    if (activeTest && timer > 0 && testMode === 'running') {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    } else if (timer === 0 && activeTest && testMode === 'running') {
      showToast("Time is up! Your test is being submitted automatically.", "warning");
      submitTest();
    }
    return () => clearInterval(interval);
  }, [activeTest, timer, testMode]);

  // Global Stats derived from Firestore
  useEffect(() => {
    if (!user) return;
    const unsubUsers = onSnapshot(collection(firestoreDb, 'users'), (snap) => {
      const studentCount = snap.docs.filter(d => d.data().role === 'student').length;
      setStats(prev => {
        const s = [...prev];
        s[0].value = studentCount.toString();
        // Calculate average accuracy if possible
        if (completedTests.length > 0) {
          s[1].value = completedTests.length.toString();
          // (Mock calculation for UI purposes until hooked fully)
          s[2].value = '85%';
        }
        return s;
      });
    });
    return () => unsubUsers();
  }, [user, completedTests]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      if (isLoginView) {
        const cred = await signInWithEmailAndPassword(firebaseAuth, authForm.email, authForm.password);
        const uDoc = await getDoc(doc(firestoreDb, 'users', cred.user.uid));
        // Allow login but we will handle the "locked" UI in the render method
        if (uDoc.exists() && !uDoc.data().isApproved && uDoc.data().role !== 'admin') {
          // No longer signing out here
        }
      } else {
        const cred = await createUserWithEmailAndPassword(firebaseAuth, authForm.email, authForm.password);
        await updateProfile(cred.user, { displayName: authForm.name });
        const role = authForm.email === 'tilakmishra.76@gmail.com' ? 'admin' : 'student';
        const uData = { name: authForm.name, email: authForm.email, role, isApproved: role === 'admin', createdAt: new Date().toISOString() };
        await setDoc(doc(firestoreDb, 'users', cred.user.uid), uData);
        showToast('Registration Successful!', 'success');
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (err) {
      let msg = err.message;
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = "❌ Email या Password गलत है! अगर आपने नया अकाउंट नहीं बनाया है तो पहले 'Sign Up' करें।";
      } else if (err.code === 'auth/email-already-in-use') {
        msg = "❌ यह Email पहले से इस्तेमाल में है। कृपया 'Log In' करें।";
      } else if (err.code === 'auth/weak-password') {
        msg = "❌ पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।";
      }
      setAuthError(msg);
      showToast(msg, 'error');
    }
    setLoading(false);
  }

  const handleResetPassword = async () => {
    if (!authForm.email) {
      showToast("Please enter your email address first!", "error");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, authForm.email);
      showToast("Password reset link sent to your email!", "success");
    } catch (err) {
      setAuthError(err.message);
      showToast(err.message, "error");
    }
    setLoading(false);
  }

  const logout = () => signOut(firebaseAuth);

  const uploadFile = async (file) => {
    const storageRef = ref(firebaseStorage, `files/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = noteFile ? await uploadFile(noteFile) : newNote.link;
      await addDoc(collection(firestoreDb, 'notes'), { ...newNote, link: url, createdAt: new Date().toISOString() });
      setNewNote({ title: '', subject: '', link: '' }); setNoteFile(null);
      showToast('Material uploaded successfully!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error uploading material', 'error');
    }
    setSubmitting(false);
  }

  const handleDeleteNote = async (id) => {
    askConfirm("Delete Material?", "Are you sure you want to remove this study material?", async () => {
      await deleteDoc(doc(firestoreDb, 'notes', id));
      showToast("Material removed", "info");
    });
  }

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = assignmentFile ? await uploadFile(assignmentFile) : newAssignment.fileUrl;
      await addDoc(collection(firestoreDb, 'assignments'), { ...newAssignment, fileUrl: url, createdAt: new Date().toISOString() });
      setNewAssignment({ title: '', subject: '', deadline: '' }); setAssignmentFile(null);
      showToast('Assignment added successfully!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error adding assignment', 'error');
    }
    setSubmitting(false);
  }

  const handleAddTest = async (e) => {
    e.preventDefault();
    if (!testFile) return showToast("Please select a Test PDF file first!", "error");
    setSubmitting(true);
    try {
      const url = await uploadFile(testFile);
      await addDoc(collection(firestoreDb, 'tests'), { ...newTest, fileUrl: url, createdAt: new Date().toISOString() });
      setNewTest({ title: '', subject: '', durationMinutes: 60, negativeMark: 0.25, instructions: 'Standard Test Instructions', questionsCount: 10, answerKey: Array(10).fill(0) });
      setTestFile(null); setUploadStatus('Test created!'); setTimeout(() => setUploadStatus(''), 2000);
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }

  const handleDeleteTest = (id) => {
    askConfirm("Delete Test?", "Deleting this test will also remove all associated results. Continue?", async () => {
      await deleteDoc(doc(firestoreDb, 'tests', id));
      showToast("Test removed", "info");
    });
  }

  const startTest = (test) => {
    setActiveTest(test); setTestMode('instructions'); setAnswers({}); setTimer(test.durationMinutes * 60);
  }

  const submitTest = async () => {
    let score = 0, correct = 0, wrong = 0, skipped = 0;
    activeTest.answerKey.forEach((k, i) => {
      if (answers[i] === undefined) skipped++;
      else if (answers[i] === k) { score += 4; correct++; }
      else { score -= (activeTest.negativeMark || 0); wrong++; }
    });
    setTestResult({ score, correct, wrong, total: activeTest.questionsCount });
    setTestMode('result');
    const isPractice = completedTests.includes(activeTest._id);
    await addDoc(collection(firestoreDb, 'testResults'), {
      testId: activeTest._id, userName: user.name, userEmail: user.email,
      score, correct, wrong, skipped, total: activeTest.questionsCount,
      isPractice, createdAt: new Date().toISOString()
    });
  }

  const handleViewLeaderboard = async (t) => {
    setActiveTest(t); setTestMode('leaderboard');
    const q = query(collection(firestoreDb, 'testResults'), where('testId', '==', t._id), orderBy('score', 'desc'));
    const snap = await getDocs(q);
    setLeaderboard(snap.docs.map(d => d.data()));
  }

  const loadAttendance = async (date) => {
    setLoadingAttendance(true);
    const d = await getDoc(doc(firestoreDb, 'attendance', date));
    if (d.exists()) {
      const r = {}; d.data().records.forEach(v => r[v.studentId] = v.status);
      setAttendanceRecords(r);
    } else setAttendanceRecords({});
    setLoadingAttendance(false);
  }

  const saveAttendance = async () => {
    setSubmitting(true);
    const final = studentsList.map(s => ({ studentId: s._id, name: s.name, email: s.email, status: attendanceRecords[s._id] || 'Present' }));
    await setDoc(doc(firestoreDb, 'attendance', attendanceDate), { date: attendanceDate, records: final });
    showToast("Attendance Saved Successfully!", "success");
    setSubmitting(false);
  }

  useEffect(() => {
    if ((activeTab === 'Attendance' || activeTab === 'Students') && user?.role === 'admin') {
      const unsub = onSnapshot(collection(firestoreDb, 'users'), (snap) => {
        setStudentsList(snap.docs.map(d => ({ ...d.data(), _id: d.id })).filter(u => u.role === 'student'));
        if (activeTab === 'Attendance') loadAttendance(attendanceDate);
      });
      return () => unsub();
    }
  }, [activeTab, attendanceDate, user]);

  const handleApproveStudent = async (id) => { await updateDoc(doc(firestoreDb, 'users', id), { isApproved: true }); }
  const handleDeleteStudent = (id) => {
    askConfirm("Remove Student?", "This will permanently delete the student account and all their records.", async () => {
      await deleteDoc(doc(firestoreDb, 'users', id));
      showToast("Student profile deleted", "error");
    });
  }

  const beginRunningTest = () => { setTestMode('running'); setTimer(activeTest.durationMinutes * 60); }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }


  const getSubTitle = (tab) => {
    switch (tab) {
      case 'Tests': return 'Premium Test Series & Practice Arena';
      case 'Dashboard': return `Welcome back, ${user?.name || 'Student'}`;
      default: return `${tab} Overview`;
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', background: 'var(--bg-primary)' }}>Loading App...</div>;
  }

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '1rem' }}>
        <div className="panel" style={{ padding: '3rem', position: 'relative', background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px', overflow: 'hidden', width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'var(--accent-gradient)' }}></div>

          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ width: '72px', height: '72px', background: 'var(--accent-gradient)', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 15px 30px rgba(14, 165, 233, 0.2)' }}>
              <svg style={{ width: '36px', height: '36px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3a10.003 10.003 0 00-6.918 2.720m.051 10.24A10.003 10.003 0 0012 21a10.003 10.003 0 006.918-2.720M3 11a10.003 10.003 0 0110.24-6.918M21 11a10.003 10.003 0 00-10.24-6.918" /></svg>
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: '900', color: 'white', letterSpacing: '-0.02em' }}>{isLoginView ? 'Welcome' : 'Join Us'}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '8px' }}>Admin & Student Panel Access</p>
          </div>

          {authError && <div style={{ color: '#ef4444', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>{authError}</div>}

          <form onSubmit={async (e) => { e.preventDefault(); await handleAuth(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {!isLoginView && (
              <div>
                <input style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none' }} placeholder="Your Full Name" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} required />
              </div>
            )}
            <div>
              <input type="email" style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none' }} placeholder="Email address" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required />
            </div>
            <div>
              <input type="password" style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none' }} placeholder="Password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '1.1rem', borderRadius: '16px', fontWeight: '800', fontSize: '1.1rem', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Authenticating...' : (isLoginView ? 'Secure Login' : 'Register Profile')}
            </button>
          </form>

          <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              {isLoginView ? "Don't have an account?" : "Already registered?"}
              <span style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '800', marginLeft: '6px' }} onClick={() => setIsLoginView(!isLoginView)}>
                {isLoginView ? "Join here" : "Log in here"}
              </span>
            </p>
          </div>
        </div>

        {/* Custom Notification Toast */}
        {toast.visible && (
          <div className="toast-vanilla" style={{
            position: 'fixed', bottom: '30px', right: '30px', zIndex: 12000, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', animation: 'slide-in 0.3s ease-out', borderLeft: `6px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`
          }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap' }}>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}></div>
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-logo-container">
            <div className="brand-shape"></div>
            <div className="brand-icon">EC</div>
          </div>
          <h1>Exam Cracker <span>Student Portal</span></h1>
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => {
            const isLocked = (!user || (user?.role === 'student' && !user?.isApproved)) && item.name !== 'Dashboard';
            return (
              <div
                key={item.name}
                className={`nav-item ${activeTab === item.name ? 'active' : ''}`}
                onClick={() => {
                  if (isLocked) {
                    if (!user) {
                      setShowAuthModal(true);
                      showToast('Please login to access this feature.', 'warning');
                    } else {
                      showToast('Account verification pending.', 'warning');
                    }
                  } else {
                    setActiveTab(item.name);
                    setSidebarOpen(false);
                  }
                }}
                style={{ opacity: isLocked ? 0.4 : 1, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="22" height="22">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  <span>{item.name}</span>
                </div>
                {isLocked && <div style={{ fontSize: '0.8rem' }}>🔒</div>}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)} style={{ display: 'none' }}>
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {activeTab !== 'Dashboard' && (
                <button
                  onClick={() => setActiveTab('Dashboard')}
                  style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '0.4rem 0.8rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '500' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  Back to Dashboard
                </button>
              )}
              <div className="search-bar">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20" style={{ color: 'var(--text-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search resources..." />
              </div>
            </div>
          </div>

          <div className="user-profile">
            {/* PWA Install Button */}
            {installPrompt && !isInstalled && (
              <button
                onClick={handleInstall}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '0.5rem 1rem', borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(79,70,229,0.15))',
                  border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8',
                  fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                  transition: 'all 0.2s', whiteSpace: 'nowrap'
                }}
                title="Install App on your device"
              >
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Install App
              </button>
            )}

            {!user ? (
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button className="btn" onClick={() => { setIsLoginView(true); setShowAuthModal(true); }} style={{ padding: '0.5rem 1.25rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', fontWeight: '600' }}>Login</button>
                <button className="btn btn-primary" onClick={() => { setIsLoginView(false); setShowAuthModal(true); }} style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>Join Now</button>
              </div>
            ) : (
              <>
                <button className="btn" onClick={logout} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  Logout
                </button>
                <div className="avatar">
                  <svg style={{ width: '20px', height: '20px', color: 'var(--text-primary)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="avatar">
                  <img src={`https://ui-avatars.com/api/?name=${user?.name || 'Student'}&background=random&color=fff`} alt={user?.name || "Student"} style={{ borderRadius: '50%', width: '100%' }} />
                </div>
              </>
            )}
          </div>
        </header>

        <section className="content-area">
          {user?.role === 'student' && !user?.isApproved ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '2rem' }}>
              <div style={{ width: '100%', maxWidth: '520px' }}>

                {/* Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '100px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px #f59e0b', animation: 'pulse 2s infinite' }} />
                    Verification Pending
                  </span>
                </div>

                {/* Icon */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" fill="none" stroke="#f59e0b" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>

                {/* Main Text */}
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                  <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#f8fafc', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
                    Your account is under review
                  </h1>
                  <p style={{ color: '#94a3b8', fontSize: '0.97rem', lineHeight: '1.7', maxWidth: '420px', margin: '0 auto' }}>
                    Hi <strong style={{ color: '#f8fafc' }}>{user?.name}</strong>, your registration has been received. An admin will verify and activate your account shortly.
                  </p>
                </div>

                {/* Steps Card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '20px', padding: '1.5rem', marginBottom: '2rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.2rem' }}>What happens next?</p>

                  {[
                    { icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Review in progress', sub: 'Admin is reviewing your registration details.', done: false },
                    { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Account activation', sub: 'Once approved, all features will unlock automatically.', done: false },
                    { icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', label: 'Full access granted', sub: 'Access tests, assignments and study materials.', done: false },
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: i < 2 ? '1.25rem' : 0 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <svg width="16" height="16" fill="none" stroke="#64748b" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                        </svg>
                      </div>
                      <div>
                        <p style={{ fontWeight: '600', fontSize: '0.9rem', color: '#e2e8f0', margin: 0, marginBottom: '2px' }}>{step.label}</p>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: '1.5' }}>{step.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Contact Info */}
                <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <svg width="18" height="18" fill="none" stroke="#38bdf8" strokeWidth="2" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: '1.5' }}>
                    Need urgent access? Contact <strong style={{ color: '#f8fafc' }}>Tilak Mishra Sir</strong> directly.
                  </p>
                </div>

                {/* Logout Button */}
                <button onClick={logout} style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', background: 'transparent', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  Sign out
                </button>

              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                {activeTab} {activeTab === 'Admin Panel' ? 'Controls' : 'Overview'}
              </h2>

              {activeTab === 'Dashboard' && (
                <>
                  <div style={{ position: 'relative', marginBottom: '3rem', borderRadius: '32px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.9) 100%)', backdropFilter: 'blur(20px)' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '40%', height: '100%', background: 'radial-gradient(circle at top right, rgba(56, 189, 248, 0.15), transparent 70%)' }}></div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '40%', height: '100%', background: 'radial-gradient(circle at bottom left, rgba(129, 140, 248, 0.1), transparent 70%)' }}></div>
                    <div style={{ padding: '3.5rem 3rem', position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
                      <div style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'inline-block', padding: '6px 16px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '100px', fontSize: '0.85rem', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '1.5rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                          Student Portal 2.0
                        </div>
                        <h1 style={{ fontSize: '2.8rem', fontWeight: '900', marginBottom: '0.5rem', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: '1.2' }}>
                          Welcome back,<br />{user?.name || 'Warrior'}!
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: '1.6', marginTop: '1rem', fontWeight: '500' }}>
                          Your academic journey is on track. Check your latest assignments, upcoming tests, and analyze your performance.
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setActiveTab('Tests')} className="btn btn-primary" style={{ padding: '1rem 2rem', borderRadius: '16px', fontSize: '1rem', fontWeight: '700', boxShadow: '0 10px 25px rgba(56, 189, 248, 0.4)' }}>
                          Start a Test 🚀
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    {stats.length > 0 ? stats.map((stat, i) => (
                      <div key={i} className="stat-card" style={{ background: `linear-gradient(135deg, ${stat.color}, transparent)`, border: `1px solid ${stat.color}`, padding: '1.8rem', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '1.5rem', transition: 'all 0.3s ease', cursor: 'default', boxShadow: `0 10px 30px ${stat.color.replace('0.2)', '0.05)')}` }}>
                        <div className="stat-icon" style={{ background: stat.color, color: stat.text, width: '64px', height: '64px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={stat.icon} />
                          </svg>
                        </div>
                        <div className="stat-info">
                          <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: '600' }}>{stat.title}</h3>
                          <div className="value" style={{ fontSize: '2.2rem', fontWeight: '900', color: 'white', letterSpacing: '-1px' }}>{stat.value}</div>
                        </div>
                      </div>
                    )) : (
                      <>
                        <div className="stat-card"><div className="stat-info"><h3>Students</h3><div className="value">0</div></div></div>
                        <div className="stat-card"><div className="stat-info"><h3>Tests Completed</h3><div className="value">0</div></div></div>
                        <div className="stat-card"><div className="stat-info"><h3>Avg. Accuracy</h3><div className="value">0%</div></div></div>
                      </>
                    )}
                  </div>

                  <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                    <div className="panel" style={{ gridColumn: '1 / -1' }}>
                      <div className="panel-header">
                        <h3 className="panel-title">Daily Attendance Tracker</h3>
                        {user?.role === 'admin' ? (
                          <button className="btn btn-primary" onClick={() => setActiveTab('Attendance')}>Open Register ✍️</button>
                        ) : (
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Status: Active</span>
                        )}
                      </div>
                      <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-glass)', borderRadius: '15px', border: '1px dashed var(--border-glass)' }}>
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Attendance is recorded daily at the coaching center. View your full report in the Attendance tab.</p>
                      </div>
                    </div>

                    <div className="panel" style={{ padding: '2rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
                      <div className="panel-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                        <h3 className="panel-title" style={{ fontSize: '1.3rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#10b981' }}>📝</span> Latest Assignments</h3>
                        <button className="btn" onClick={() => setActiveTab('Assignments')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.85rem' }}>View All →</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[...assignments].reverse().slice(0, 3).map((as, idx) => {
                          const isRestricted = (!user || (user?.role === 'student' && !user?.isApproved)) && idx >= 2;
                          return (
                            <div key={idx}
                              onClick={() => {
                                if (isRestricted) {
                                  setShowAuthModal(true);
                                  showToast('Verify account to access premium assignments', 'warning');
                                } else {
                                  window.open(as.fileUrl || as.link, '_blank');
                                }
                              }}
                              style={{ background: 'var(--bg-glass)', padding: '1.25rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', opacity: isRestricted ? 0.6 : 1, border: '1px solid rgba(255,255,255,0.03)', transition: 'transform 0.2s', ':hover': { transform: 'scale(1.02)' } }}
                              className="assignment-card-hover"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: isRestricted ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.1)', color: isRestricted ? 'var(--text-secondary)' : '#10b981', padding: '12px', borderRadius: '12px' }}>
                                  {isRestricted ? <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" /></svg> : <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8"></polyline></svg>}
                                </div>
                                <div>
                                  <p style={{ fontWeight: '700', margin: 0, fontSize: '1.05rem', color: 'white' }}>{as.title}</p>
                                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '500' }}>Due: <span style={{ color: '#f59e0b' }}>{as.deadline}</span></small>
                                </div>
                              </div>
                              <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '8px', background: isRestricted ? 'rgba(255,255,255,0.05)' : 'rgba(16, 185, 129, 0.1)', color: isRestricted ? 'var(--text-secondary)' : '#10b981', fontWeight: '700' }}>{idx < 2 ? 'Free' : 'Premium'}</span>
                            </div>
                          );
                        })}
                        {assignments.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-glass)' }}><span style={{ fontSize: '2rem' }}>📭</span><p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>No pending assignments.</p></div>}
                      </div>
                    </div>

                    <div className="panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                      <div className="panel-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                        <h3 className="panel-title" style={{ fontSize: '1.3rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#f59e0b' }}>🎯</span> Upcoming Tests</h3>
                        <button className="btn" onClick={() => setActiveTab('Tests')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.85rem' }}>Arena →</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[...tests].reverse().slice(0, 3).map((t, idx) => {
                          const isRestricted = (!user || (user?.role === 'student' && !user?.isApproved)) && idx >= 2;
                          return (
                            <div key={idx}
                              onClick={() => {
                                if (isRestricted) {
                                  setShowAuthModal(true);
                                  showToast('Account verification required for full access', 'warning');
                                } else {
                                  setActiveTab('Tests');
                                  setActiveTest(t);
                                }
                              }}
                              style={{ background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, var(--bg-glass) 100%)', padding: '1.25rem', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', opacity: isRestricted ? 0.6 : 1, border: '1px solid rgba(245, 158, 11, 0.1)', transition: '0.2s' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ background: isRestricted ? 'rgba(255,255,255,0.05)' : 'rgba(245, 158, 11, 0.1)', color: isRestricted ? 'var(--text-secondary)' : '#f59e0b', padding: '12px', borderRadius: '12px' }}>
                                  {isRestricted ? <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" /></svg> : <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                </div>
                                <div>
                                  <p style={{ fontWeight: '700', margin: 0, fontSize: '1.05rem', color: 'white' }}>{t.title}</p>
                                  <small style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{t.durationMinutes} Mins • {t.questionsCount} Qs</small>
                                </div>
                              </div>
                              <button style={{ background: isRestricted ? 'transparent' : '#f59e0b', color: isRestricted ? 'var(--text-secondary)' : 'white', border: isRestricted ? '1px solid var(--border-glass)' : 'none', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '0.8rem' }}>{idx < 2 ? 'Start' : 'Locked'}</button>
                            </div>
                          );
                        })}
                        {tests.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-glass)' }}><span style={{ fontSize: '2rem' }}>🕒</span><p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>No upcoming tests.</p></div>}
                      </div>
                    </div>

                    <div className="panel" style={{ padding: '2rem', borderRadius: '24px' }}>
                      <div className="panel-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                        <h3 className="panel-title" style={{ fontSize: '1.3rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#38bdf8' }}>📚</span> Study Resources</h3>
                        <button className="btn" onClick={() => setActiveTab('Study Material')} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.85rem' }}>Library →</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                        {[...notes].reverse().slice(0, 4).map((n, idx) => {
                          const isRestricted = (!user || (user?.role === 'student' && !user?.isApproved)) && idx >= 2;
                          return (
                            <div key={idx}
                              onClick={() => {
                                if (isRestricted) {
                                  setShowAuthModal(true);
                                  showToast('Members only content', 'warning');
                                } else {
                                  window.open(n.fileUrl || n.link, '_blank');
                                }
                              }}
                              style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', padding: '1.5rem 1rem', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', opacity: isRestricted ? 0.6 : 1, transition: '0.2s', ':hover': { transform: 'translateY(-5px)', background: 'rgba(56, 189, 248, 0.05)' } }}>
                              {isRestricted ? <svg style={{ width: '28px', height: '28px', margin: '0 auto 12px', color: 'var(--text-secondary)' }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" /></svg> : <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>}
                              <p style={{ fontSize: '0.9rem', fontWeight: '800', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'white' }}>{n.title}</p>
                              <small style={{ color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', fontWeight: '600' }}>{idx < 2 ? 'Free' : 'Premium'}</small>
                            </div>
                          );
                        })}
                        {notes.length === 0 && <div style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-glass)' }}><span style={{ fontSize: '2rem' }}>📚</span><p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>Library empty.</p></div>}
                      </div>
                    </div>

                    <div className="panel" style={{ gridColumn: '1 / -1' }}>
                      <div className="panel-header">
                        <h3 className="panel-title">Recent Activity</h3>
                      </div>
                      <div className="activity-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                        {recentActivities.length > 0 ? recentActivities.slice(0, 4).map((act, i) => (
                          <div key={i} className="activity-item" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '10px' }}>
                            <div className="activity-icon">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={act.icon} />
                              </svg>
                            </div>
                            <div className="activity-content">
                              <p><strong>{act.title}</strong></p>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{act.text}</p>
                              <span className="activity-time">{act.time}</span>
                            </div>
                          </div>
                        )) : (
                          <p style={{ color: 'var(--text-secondary)', padding: '2rem', textAlign: 'center', gridColumn: '1 / -1' }}>No recent activity to show.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'Admin Panel' && user?.role === 'admin' && (
                <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                  <div className="panel">
                    <div className="panel-header"><h3 className="panel-title">📚 Upload Study Material / Notes</h3></div>
                    <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Title (e.g. Physics Chapter 4)" value={newNote.title} onChange={e => setNewNote({ ...newNote, title: e.target.value })} required />
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Subject/Tag" value={newNote.subject} onChange={e => setNewNote({ ...newNote, subject: e.target.value })} required />

                      <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Upload File (PDF/Docs/Images)</label>
                      <input type="file" id="noteFile" style={{ display: 'none' }} onChange={e => setNoteFile(e.target.files[0])} />
                      <button type="button" className="btn" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', textAlign: 'left', padding: '0.75rem', color: noteFile ? '#10b981' : 'white' }} onClick={() => document.getElementById('noteFile').click()}>
                        {noteFile ? `📁 ${noteFile.name}` : 'Click here to Choose File...'}
                      </button>

                      <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>OR Drop a Link below</label>
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Link URL (Optional)" value={newNote.link} onChange={e => setNewNote({ ...newNote, link: e.target.value })} />

                      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: '#38bdf8' }}>{submitting ? 'Uploading...' : 'Upload Material 🚀'}</button>
                    </form>
                  </div>

                  <div className="panel">
                    <div className="panel-header"><h3 className="panel-title">📝 Upload Assignment</h3></div>
                    <form onSubmit={handleAddAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Assignment Title" value={newAssignment.title} onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })} required />
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Subject" value={newAssignment.subject} onChange={e => setNewAssignment({ ...newAssignment, subject: e.target.value })} required />
                      <input type="date" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} value={newAssignment.deadline} onChange={e => setNewAssignment({ ...newAssignment, deadline: e.target.value })} required />

                      <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Assignment Document (PDF)</label>
                      <input type="file" id="assignFile" style={{ display: 'none' }} onChange={e => setAssignmentFile(e.target.files[0])} />
                      <button type="button" className="btn" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', textAlign: 'left', padding: '0.75rem', color: assignmentFile ? '#10b981' : 'white' }} onClick={() => document.getElementById('assignFile').click()}>
                        {assignmentFile ? `📁 ${assignmentFile.name}` : 'Click here to Choose File...'}
                      </button>

                      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: '#10b981' }}>{submitting ? 'Uploading...' : 'Publish Assignment 📤'}</button>
                    </form>
                  </div>

                  <div className="panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="panel-header"><h3 className="panel-title">⏱ Upload Test PDF & Generate OMR</h3></div>
                    <form onSubmit={handleAddTest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <input style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Test Title (e.g. Chapter 4 Quiz)" value={newTest.title} onChange={e => setNewTest({ ...newTest, title: e.target.value })} required />
                        <input style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Subject" value={newTest.subject} onChange={e => setNewTest({ ...newTest, subject: e.target.value })} required />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <input type="number" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Duration (Mins)" value={newTest.durationMinutes} onChange={e => setNewTest({ ...newTest, durationMinutes: Number(e.target.value) })} required />
                        <input type="number" step="0.01" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Negative Marks (- e.g. 0.25)" value={newTest.negativeMark} onChange={e => setNewTest({ ...newTest, negativeMark: Number(e.target.value) })} required />
                        <input type="number" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="No. of Questions" value={newTest.questionsCount} onChange={e => setNewTest({ ...newTest, questionsCount: Number(e.target.value), answerKey: Array(Number(e.target.value)).fill(0) })} required />
                      </div>
                      <textarea style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', minHeight: '80px' }} placeholder="Test Instructions" value={newTest.instructions} onChange={e => setNewTest({ ...newTest, instructions: e.target.value })} required />

                      <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Upload Question Paper (PDF)</label>
                      <input type="file" id="testPdfFile" style={{ display: 'none' }} onChange={e => setTestFile(e.target.files[0])} accept="application/pdf" />
                      <button type="button" className="btn" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)', left: 'auto', padding: '0.75rem', color: testFile ? '#10b981' : 'white' }} onClick={() => document.getElementById('testPdfFile').click()}>
                        {testFile ? `📄 ${testFile.name}` : 'Upload Master Question Paper PDF'}
                      </button>

                      <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px dashed var(--border-glass)' }}>
                        <h4 style={{ marginBottom: '1rem', color: '#10b981' }}>Set Answer Key (for Auto-Grading)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '10px' }}>
                          {newTest.answerKey.map((ans, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'black', padding: '5px 10px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                              <span style={{ color: 'var(--text-secondary)', width: '30px' }}>Q{idx + 1}</span>
                              <select style={{ background: 'transparent', color: 'white', border: 'none', outline: 'none', cursor: 'pointer' }} value={ans} onChange={(e) => { const newKey = [...newTest.answerKey]; newKey[idx] = Number(e.target.value); setNewTest({ ...newTest, answerKey: newKey }); }}>
                                <option style={{ color: 'black' }} value={0}>A</option>
                                <option style={{ color: 'black' }} value={1}>B</option>
                                <option style={{ color: 'black' }} value={2}>C</option>
                                <option style={{ color: 'black' }} value={3}>D</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button type="submit" className="btn btn-primary" disabled={submitting || !testFile} style={{ background: '#f59e0b', padding: '1rem' }}>{submitting ? 'Creating...' : `Publish Master Test (${newTest.questionsCount} Qs) ⚡`}</button>
                    </form>
                  </div>

                  <div className="panel" style={{ gridColumn: '1 / -1' }}>
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Admin controls for content management are active above. Use the Students and Attendance tabs in the sidebar for user management.
                    </div>
                  </div>

                </div>
              )}

              {activeTab === 'Classes' && (
                <div className="panel" style={{ overflowX: 'auto', width: '100%' }}>
                  <div className="panel-header"><h3 className="panel-title">Classes Schedule</h3></div>
                  <table style={{ width: '100%' }}>
                    <thead><tr><th>Subject</th><th>Batch</th><th>Time</th>{user?.role === 'admin' && <th>Action</th>}</tr></thead>
                    <tbody>
                      {classes.map((cls, idx) => (
                        <tr key={idx}>
                          <td><strong>{cls.subject}</strong></td>
                          <td>{cls.batch}</td>
                          <td>{cls.time}</td>
                          {user?.role === 'admin' && <td><button onClick={() => handleDeleteClass(cls._id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>Delete</button></td>}
                        </tr>
                      ))}
                      {classes.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No scheduled classes.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'Assignments' && (
                <div className="panel" style={{ width: '100%' }}>
                  <div className="panel-header">
                    <h3 className="panel-title">📝 Your Assignments</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px' }}>
                      {user?.isApproved ? 'Full Access' : '2 Free | Rest Locked'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {[...assignments].reverse().map((a, idx) => {
                      const isLocked = user?.role === 'student' && !user?.isApproved && idx >= 2;
                      return (
                        <div key={idx} style={{ background: isLocked ? 'rgba(255,255,255,0.02)' : 'var(--bg-glass)', padding: '1.1rem 1.25rem', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`, opacity: isLocked ? 0.65 : 1, transition: '0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isLocked
                                ? <svg width="16" height="16" fill="#64748b" viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" /></svg>
                                : <svg width="16" height="16" fill="#10b981" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>}
                            </div>
                            <div>
                              <p style={{ fontWeight: '700', margin: 0, fontSize: '0.95rem', color: isLocked ? '#64748b' : 'white' }}>{a.title}</p>
                              <small style={{ color: '#64748b', fontSize: '0.78rem' }}>{a.subject} • Due: <span style={{ color: isLocked ? '#64748b' : '#f59e0b' }}>{a.deadline}</span></small>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                            {isLocked ? (
                              <button onClick={() => showToast('Verify your account to access all assignments.', 'warning')} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '700', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'pointer' }}>🔒 Locked</button>
                            ) : (
                              <>
                                {a.fileUrl && <a href={a.fileUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '700', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', textDecoration: 'none' }}>View</a>}
                                {user?.role === 'admin' && <button onClick={() => handleDeleteAssignment(a._id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem' }}>Delete</button>}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {assignments.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-glass)' }}>📭 No assignments yet.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'Study Material' && (
                <div className="panel" style={{ width: '100%' }}>
                  <div className="panel-header">
                    <h3 className="panel-title">📚 Study Materials</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px' }}>
                      {user?.isApproved ? 'Full Access' : '2 Free | Rest Locked'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {[...notes].reverse().map((n, idx) => {
                      const isLocked = user?.role === 'student' && !user?.isApproved && idx >= 2;
                      return (
                        <div key={idx} style={{ background: isLocked ? 'rgba(255,255,255,0.02)' : 'var(--bg-glass)', padding: '1.1rem 1.25rem', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`, opacity: isLocked ? 0.65 : 1, transition: '0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isLocked
                                ? <svg width="16" height="16" fill="#64748b" viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9z" /></svg>
                                : <span style={{ fontSize: '1.1rem' }}>📄</span>}
                            </div>
                            <div>
                              <p style={{ fontWeight: '700', margin: 0, fontSize: '0.95rem', color: isLocked ? '#64748b' : 'white' }}>{n.title}</p>
                              <small style={{ color: '#64748b', fontSize: '0.78rem' }}>{n.subject}</small>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
                            {isLocked ? (
                              <button onClick={() => showToast('Verify your account to access all study materials.', 'warning')} style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '700', borderRadius: '8px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'pointer' }}>🔒 Locked</button>
                            ) : (
                              <>
                                {(n.link || n.fileUrl) && <a href={n.link || n.fileUrl} target="_blank" rel="noreferrer" style={{ padding: '6px 14px', fontSize: '0.78rem', fontWeight: '700', borderRadius: '8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', textDecoration: 'none' }}>📂 View</a>}
                                {user?.role === 'admin' && <button onClick={() => handleDeleteNote(n._id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem' }}>Delete</button>}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {notes.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border-glass)' }}>📚 No materials uploaded yet.</div>}
                  </div>
                </div>
              )}

              {activeTab === 'Tests' && (
                <div style={{ width: '100%' }}>
                  {!activeTest ? (
                    <>
                      {/* Stats Bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), transparent)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                          <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>💎</div>
                          <div className="stat-info">
                            <h3>Total Tests</h3>
                            <div className="value">{tests.length}</div>
                          </div>
                        </div>
                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), transparent)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>🎯</div>
                          <div className="stat-info">
                            <h3>Completed</h3>
                            <div className="value">{completedTests.length}</div>
                          </div>
                        </div>
                        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), transparent)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>⌛</div>
                          <div className="stat-info">
                            <h3>Pending</h3>
                            <div className="value">{Math.max(0, tests.length - completedTests.length)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Header & Filters */}
                      <div className="panel" style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '2rem' }}>
                        <div className="panel-header" style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem' }}>
                          <div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>Premium Test Series</h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Choose a test to begin your preparation</p>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '5px', borderRadius: '12px' }}>
                            {['All', 'Math', 'Physics', 'Chemistry', 'GK'].map(f => (
                              <button
                                key={f}
                                onClick={() => setTestFilter(f)}
                                style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '0.85rem', border: 'none', background: testFilter === f ? 'var(--accent-gradient)' : 'transparent', color: testFilter === f ? 'white' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600' }}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
                          {[...tests].reverse().filter(t => testFilter === 'All' || t.subject.includes(testFilter)).map((t, idx) => {
                            const isLocked = user?.role === 'student' && !user?.isApproved && idx >= 2;
                            return (
                              <div key={idx} style={{ background: isLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLocked ? 'rgba(255,255,255,0.04)' : 'var(--border-glass)'}`, borderRadius: '20px', overflow: 'hidden', transition: 'all 0.3s ease', opacity: isLocked ? 0.65 : 1 }} className="test-series-card">
                                <div style={{ height: '6px', background: isLocked ? '#334155' : (completedTests.includes(t._id.toString()) ? '#10b981' : 'var(--accent-gradient)') }}></div>
                                <div style={{ padding: '1.5rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: isLocked ? '#64748b' : '#38bdf8', background: isLocked ? 'rgba(255,255,255,0.04)' : 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>{t.subject}</span>
                                    {isLocked ? (
                                      <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 'bold' }}>🔒 LOCKED</span>
                                    ) : completedTests.includes(t._id.toString()) ? (
                                      <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold' }}>✅ COMPLETED</span>
                                    ) : (
                                      <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>🕒 NEW</span>
                                    )}
                                  </div>
                                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.25rem', lineHeight: '1.4', color: isLocked ? '#64748b' : 'white' }}>{t.title}</h3>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                      <p style={{ color: isLocked ? '#64748b' : 'white', fontWeight: 'bold' }}>{t.durationMinutes} Mins</p>
                                      <span>Duration</span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                      <p style={{ color: isLocked ? '#64748b' : 'white', fontWeight: 'bold' }}>{t.questionsCount}</p>
                                      <span>Questions</span>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: '10px' }}>
                                    {isLocked ? (
                                      <button onClick={() => showToast('Get your account verified to unlock all tests.', 'warning')} style={{ flex: 1, padding: '0.85rem', fontWeight: '700', borderRadius: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', cursor: 'pointer' }}>🔒 Unlock Required</button>
                                    ) : user?.role === 'admin' ? (
                                      <>
                                        <button className="btn btn-primary" onClick={() => startTest(t)} style={{ flex: 1 }}>Preview 👁</button>
                                        <button onClick={() => handleDeleteTest(t._id)} style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>🗑</button>
                                      </>
                                    ) : (
                                      <>
                                        {completedTests.includes(t._id.toString()) ? (
                                          <>
                                            <button className="btn" onClick={() => startTest(t)} style={{ flex: 1, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', fontWeight: 'bold' }}>Retake (Practice)</button>
                                            <button className="btn" onClick={() => handleViewLeaderboard(t)} style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#f59e0b' }}>🏆 Ranking</button>
                                          </>
                                        ) : (
                                          <button className="btn btn-primary" onClick={() => startTest(t)} style={{ flex: 1, fontWeight: 'bold', padding: '0.85rem' }}>Start Exam Now</button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {tests.length === 0 && (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '30px', border: '2px dashed var(--border-glass)' }}>
                              <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🎓</span>
                              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>No Tests Available Yet</h3>
                              <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}> {user?.role === 'admin' ? 'Start by creating a new test from the Admin Panel to begin your coaching journey.' : 'Your coach hasn\'t uploaded any tests yet. Check back soon for new assignments!'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ width: '100%' }}>
                      {testMode === 'instructions' && (
                        <div className="panel" style={{ maxWidth: '800px', margin: '2rem auto', padding: '3rem', borderRadius: '30px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <div style={{ width: '70px', height: '70px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>📜</div>
                            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem' }}>{activeTest.title}</h2>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                              <span>{activeTest.subject}</span>
                              <span>•</span>
                              <span>{activeTest.durationMinutes} Minutes</span>
                              <span>•</span>
                              <span>{activeTest.questionsCount} Questions</span>
                            </div>
                          </div>

                          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '20px', padding: '2rem', marginBottom: '2.5rem' }}>
                            <h4 style={{ color: '#f59e0b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>📝 Exam Instructions:</h4>
                            <div style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '1rem' }}>
                              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{activeTest.instructions}</pre>
                            </div>
                            <div style={{ marginTop: '1.5rem', padding: '15px', borderLeft: '4px solid #ef4444', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '0 12px 12px 0' }}>
                              <p style={{ color: '#ef4444', margin: 0, fontWeight: '600' }}>⚠️ Negative Marking: Each incorrect answer will deduct {activeTest.negativeMark || 0} marks.</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <button className="btn" onClick={() => setActiveTest(null)} style={{ flex: 1, padding: '1.25rem', background: 'transparent', border: '1px solid var(--border-glass)', borderRadius: '15px', fontWeight: '600' }}>Back to Portal</button>
                            <button className="btn btn-primary" onClick={() => beginRunningTest()} style={{ flex: 2, padding: '1.25rem', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '15px' }}>I am ready to begin →</button>
                          </div>
                        </div>
                      )}

                      {testMode === 'running' && activeTest && (
                        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', padding: '0 1rem' }}>
                          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem 2rem', borderRadius: '15px' }}>
                            <div>
                              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '4px' }}>{activeTest.title}</h3>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Attempting Section: {activeTest.subject}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TIME REMAINING</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: '800', fontFamily: 'monospace', color: timer < 300 ? '#ef4444' : '#10b981' }}>{formatTime(timer)}</p>
                              </div>
                              <div style={{ height: '40px', width: '1px', background: 'var(--border-glass)', margin: '0 10px' }}></div>
                              <button className="btn" onClick={() => { if (window.confirm('Are you sure you want to exit? Your progress may not be saved.')) setActiveTest(null); }} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>Exit Exam</button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '1.5rem', flex: 1, overflow: 'hidden' }}>
                            <div style={{ flex: 3, background: 'white', borderRadius: '20px', overflow: 'hidden', border: '4px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                              <iframe src={`${activeTest.fileUrl}#toolbar=0`} width="100%" height="100%" style={{ border: 'none' }} title="Question Paper"></iframe>
                            </div>

                            <div className="panel" style={{ flex: 1, padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                              <h4 style={{ textAlign: 'center', fontWeight: '800', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>ANSWER SHEET</h4>

                              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                                {Array.from({ length: activeTest.questionsCount }).map((_, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: answers[i] !== undefined ? 'rgba(56, 189, 248, 0.1)' : 'rgba(0,0,0,0.2)', borderRadius: '12px', border: answers[i] !== undefined ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent' }}>
                                    <span style={{ width: '40px', fontWeight: 'bold', fontSize: '0.9rem', color: answers[i] !== undefined ? '#38bdf8' : 'var(--text-secondary)' }}>Q{i + 1}</span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      {['A', 'B', 'C', 'D'].map((opt, optIdx) => (
                                        <button
                                          key={optIdx}
                                          onClick={() => setAnswers({ ...answers, [i]: optIdx })}
                                          className={`omr-bubble ${answers[i] === optIdx ? 'selected' : ''}`}
                                          style={{ width: '32px', height: '32px', borderRadius: '50%', border: answers[i] === optIdx ? 'none' : '1px solid #475569', background: answers[i] === optIdx ? '#3b82f6' : 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', fontWeight: '800', borderRadius: '15px', background: '#10b981' }}
                                onClick={() => { if (window.confirm('Do you want to finalize and submit your exam?')) submitTest(); }}
                              >
                                FINISH & SUBMIT
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {testMode === 'result' && testResult && (
                        <div className="panel" style={{ textAlign: 'center', maxWidth: '700px', margin: '3rem auto', padding: '4rem 3rem', borderRadius: '30px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                          <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>📊</div>
                          <h2 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#10b981', marginBottom: '1rem' }}>Exam Submitted!</h2>
                          <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem' }}>Great effort! Here is your performance report.</p>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                            <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>FINAL SCORE</p>
                              <h3 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#38bdf8' }}>{testResult.score}</h3>
                            </div>
                            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>ACCURACY</p>
                              <h3 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#10b981' }}>{Math.round((testResult.correct / testResult.total) * 100) || 0}%</h3>
                            </div>
                            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1.5rem', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>QUESTIONS</p>
                              <h3 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#f59e0b' }}>{testResult.total}</h3>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '20px', marginBottom: '3rem' }}>
                            <div><p style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>{testResult.correct}</p><small>Correct</small></div>
                            <div><p style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.2rem' }}>{testResult.wrong}</p><small>Incorrect</small></div>
                            <div><p style={{ color: '#64748b', fontWeight: 'bold', fontSize: '1.2rem' }}>{testResult.total - testResult.correct - testResult.wrong}</p><small>Unattempted</small></div>
                          </div>

                          <div style={{ display: 'flex', gap: '1.5rem' }}>
                            <button className="btn" onClick={() => handleViewLeaderboard(activeTest)} style={{ flex: 1, padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', fontWeight: 'bold' }}>Check Leaderboard 🏆</button>
                            <button className="btn btn-primary" onClick={() => setActiveTest(null)} style={{ flex: 1, padding: '1rem', fontWeight: 'bold' }}>Done & Return</button>
                          </div>
                        </div>
                      )}

                      {testMode === 'leaderboard' && (
                        <div className="panel" style={{ maxWidth: '900px', margin: '2rem auto', padding: '3rem', borderRadius: '30px', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                            <div>
                              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#f59e0b', marginBottom: '5px' }}>🏆 Ranking Leaderboard</h2>
                              <p style={{ color: 'var(--text-secondary)' }}>{activeTest.title}</p>
                            </div>
                            <button className="btn" onClick={() => setActiveTest(null)} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>Go Back</button>
                          </div>

                          <div className="table-container" style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                            <table style={{ background: 'rgba(255,255,255,0.02)' }}>
                              <thead>
                                <tr style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)' }}>
                                  <th style={{ padding: '1.5rem' }}>Rank</th>
                                  <th style={{ padding: '1.5rem' }}>Student Details</th>
                                  <th style={{ padding: '1.5rem', textAlign: 'center' }}>Score</th>
                                  <th style={{ padding: '1.5rem', textAlign: 'center' }}>Accuracy</th>
                                  <th style={{ padding: '1.5rem' }}>Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {leaderboard.map((lb, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)', background: idx === 0 ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}>
                                    <td style={{ padding: '1.5rem' }}>
                                      {idx === 0 ? <span style={{ fontSize: '1.5rem' }}>🥇</span> : idx === 1 ? <span style={{ fontSize: '1.5rem' }}>🥈</span> : idx === 2 ? <span style={{ fontSize: '1.5rem' }}>🥉</span> : <span style={{ fontWeight: '800', color: 'var(--text-secondary)' }}>#{idx + 1}</span>}
                                    </td>
                                    <td style={{ padding: '1.5rem' }}>
                                      <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{lb.userName}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{lb.userEmail}</div>
                                    </td>
                                    <td style={{ padding: '1.5rem', textAlign: 'center', fontWeight: '900', fontSize: '1.25rem', color: '#38bdf8' }}>{lb.score}</td>
                                    <td style={{ padding: '1.5rem', textAlign: 'center', fontWeight: 'bold', color: '#10b981' }}>{Math.round((lb.correct / lb.total) * 100) || 0}%</td>
                                    <td style={{ padding: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{new Date(lb.submittedAt).toLocaleDateString()}</td>
                                  </tr>
                                ))}
                                {leaderboard.length === 0 && <tr><td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No official results found yet.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Attendance' && user?.role === 'admin' && (
                <div className="panel" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
                  <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="panel-title">Mark Attendance</h3>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      style={{ padding: '0.5rem', borderRadius: '5px', background: 'var(--bg-glass)', color: 'white', border: '1px solid var(--border-glass)' }}
                    />
                  </div>

                  {loadingAttendance ? (
                    <p>Loading attendance data...</p>
                  ) : (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {studentsList.map(s => (
                          <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                            <div>
                              <h4 style={{ margin: 0 }}>{s.name}</h4>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.email}</span>
                            </div>
                            <select
                              value={attendanceRecords[s._id] || 'Present'}
                              onChange={(e) => setAttendanceRecords({ ...attendanceRecords, [s._id]: e.target.value })}
                              style={{ padding: '0.5rem', borderRadius: '5px', background: attendanceRecords[s._id] === 'Absent' ? '#ef4444' : (attendanceRecords[s._id] === 'Late' ? '#f59e0b' : '#10b981'), color: 'white', border: 'none', outline: 'none', cursor: 'pointer' }}
                            >
                              <option value="Present" style={{ background: 'black' }}>Present</option>
                              <option value="Absent" style={{ background: 'black' }}>Absent</option>
                              <option value="Late" style={{ background: 'black' }}>Late</option>
                            </select>
                          </div>
                        ))}
                      </div>
                      {studentsList.length > 0 ? (
                        <button className="btn btn-primary" onClick={saveAttendance} disabled={submitting} style={{ marginTop: '2rem', width: '100%' }}>
                          {submitting ? 'Saving...' : 'Save Attendance'}
                        </button>
                      ) : (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No students found.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Students' && user?.role === 'admin' && (
                <div className="panel" style={{ width: '100%' }}>
                  <div className="panel-header">
                    <h3 className="panel-title">👥 Students & User Management</h3>
                    <div style={{ background: 'var(--bg-glass)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                      Total Students: {studentsList.length}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                    {studentsList.map(s => (
                      <div key={s._id} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '24px', border: '1px solid var(--border-glass)', transition: '0.3s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '15px', overflow: 'hidden', border: '2px solid var(--border-glass)' }}>
                              <img src={`https://ui-avatars.com/api/?name=${s.name}&background=random&color=fff`} alt={s.name} style={{ width: '100%' }} />
                            </div>
                            <div>
                              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{s.name}</h4>
                              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.email}</p>
                            </div>
                          </div>
                          <span style={{ padding: '4px 10px', borderRadius: '100px', fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', background: s.isApproved ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: s.isApproved ? '#10b981' : '#f59e0b', border: `1px solid ${s.isApproved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` }}>
                            {s.isApproved ? 'Verified' : 'Pending'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          {!s.isApproved && (
                            <button className="btn btn-primary" onClick={() => handleApproveStudent(s._id)} style={{ flex: 1, padding: '0.7rem', fontSize: '0.85rem', fontWeight: '800', background: '#10b981' }}>Verify User</button>
                          )}
                          <button
                            className="btn"
                            onClick={() => {
                              askConfirm("Confirm Deletion", `Are you sure you want to remove ${s.name}? This action is permanent.`, () => handleDeleteStudent(s._id));
                            }}
                            style={{ flex: s.isApproved ? 1 : 0.5, padding: '0.7rem', fontSize: '0.85rem', fontWeight: '700', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {studentsList.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                        No registered students found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab !== 'Dashboard' && activeTab !== 'Admin Panel' && activeTab !== 'Assignments' && activeTab !== 'Study Material' && activeTab !== 'Tests' && activeTab !== 'Attendance' && activeTab !== 'Students' && (
                <div className="panel" style={{ textAlign: 'center', padding: '100px 20px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="64" height="64" style={{ color: 'var(--text-secondary)', margin: '0 auto 1.5rem' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <h2>{activeTab} Module</h2>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '1rem', maxWidth: '400px', margin: '1rem auto' }}>
                    This section handles {activeTab.toLowerCase()} management for Exam Cracker Coaching Centre. Modules are highly customized and built perfectly according to your needs.
                  </p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
                    Manage {activeTab}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main >

      {/* Professional Toast Notification */}
      {toast.visible && (
        <div className={`toast-notification${toast.hiding ? ' hiding' : ''}`}>
          {/* Icon */}
          <div className="toast-icon-wrap" style={{
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : toast.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'
          }}>
            {toast.type === 'success' && (
              <svg width="20" height="20" fill="none" stroke="#10b981" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            )}
            {toast.type === 'error' && (
              <svg width="20" height="20" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            {toast.type === 'warning' && (
              <svg width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            )}
            {(toast.type === 'info' || !['success', 'error', 'warning'].includes(toast.type)) && (
              <svg width="20" height="20" fill="none" stroke="#38bdf8" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </div>

          {/* Body */}
          <div className="toast-body">
            <div className="toast-title">
              {toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : toast.type === 'warning' ? 'Warning' : 'Info'}
            </div>
            <div className="toast-msg">{toast.message}</div>
          </div>

          {/* Close button */}
          <button className="toast-close" onClick={dismissToast}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {/* Progress bar */}
          <div className="toast-progress" style={{
            background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : '#38bdf8',
            animationDuration: `${toast.duration}ms`
          }} />
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {
        confirmDialog.visible && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => setConfirmDialog({ ...confirmDialog, visible: false })}></div>
            <div style={{ position: 'relative', background: '#1a1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', padding: '2.5rem', maxWidth: '420px', width: '100%', boxShadow: '0 50px 100px rgba(0,0,0,0.8)', animation: 'slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <svg style={{ width: '28px', height: '28px' }} color="#ef4444" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white', marginBottom: '8px' }}>{confirmDialog.title}</h3>
              <p style={{ color: '#94a3b8', marginBottom: '2rem', lineHeight: '1.6' }}>{confirmDialog.message}</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => setConfirmDialog({ ...confirmDialog, visible: false })}
                  style={{ flex: 1, padding: '1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await confirmDialog.onConfirm();
                    setConfirmDialog({ ...confirmDialog, visible: false });
                  }}
                  style={{ flex: 1, padding: '1rem', borderRadius: '14px', background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Professional Auth Modal */}
      {
        showAuthModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}>
            <div className="modal-content panel" style={{ padding: '3rem', position: 'relative', background: 'var(--bg-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'var(--accent-gradient)' }}></div>
              <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '12px' }}>
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{ width: '72px', height: '72px', background: 'var(--accent-gradient)', borderRadius: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', boxShadow: '0 15px 30px rgba(14, 165, 233, 0.2)' }}>
                  <svg style={{ width: '36px', height: '36px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3a10.003 10.003 0 00-6.918 2.720m.051 10.24A10.003 10.003 0 0012 21a10.003 10.003 0 006.918-2.720M3 11a10.003 10.003 0 0110.24-6.918M21 11a10.003 10.003 0 00-10.24-6.918" /></svg>
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: '900', color: 'white', letterSpacing: '-0.02em' }}>{isLoginView ? 'Welcome' : 'Join Us'}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '8px' }}>The official gateway to Exam Cracker</p>
              </div>

              {authError && <div style={{ color: '#ef4444', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>{authError}</div>}

              <form onSubmit={async (e) => { e.preventDefault(); await handleAuth(e); if (!authError) setShowAuthModal(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {!isLoginView && (
                  <div style={{ position: 'relative' }}>
                    <input style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none' }} placeholder="Your Full Name" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} required />
                  </div>
                )}
                <div>
                  <input type="email" style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none' }} placeholder="Email address" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required />
                </div>
                <div>
                  <input type="password" style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none' }} placeholder="Password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '1.1rem', borderRadius: '16px', fontWeight: '800', fontSize: '1.1rem', marginTop: '0.5rem' }} disabled={loading}>
                  {loading ? 'Authenticating...' : (isLoginView ? 'Sign In' : 'Create Profile')}
                </button>
              </form>

              <div style={{ marginTop: '2.5rem', textAlign: 'center', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  {isLoginView ? "Don't have an account?" : "Already a student?"}
                  <span style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: '800', marginLeft: '6px' }} onClick={() => setIsLoginView(!isLoginView)}>
                    {isLoginView ? "Join for free" : "Log in here"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}

export default App;
