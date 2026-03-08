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
  const [welcomeText, setWelcomeText] = useState('Welcome back, Warrior! 🎯');

  const [stats, setStats] = useState([
    { title: 'Total Students', value: '0', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197' },
    { title: 'Live Classes', value: '0', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2' },
    { title: 'Tests Done', value: '0', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { title: 'Study Hours', value: '0h', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }
  ]);

  const [classes, setClasses] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [notes, setNotes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [tests, setTests] = useState([]);
  const [completedTests, setCompletedTests] = useState([]);
  const [studentsList, setStudentsList] = useState([]);

  const [newClass, setNewClass] = useState({ subject: '', batch: '', time: '', status: 'Scheduled' });
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
  const [testFilter, setTestFilter] = useState('All');

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, title: '', message: '', onConfirm: null });
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (user && !sessionStorage.getItem('welcomeShown')) {
      setShowWelcome(true);
      sessionStorage.setItem('welcomeShown', 'true');
    }
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 4000);
  };

  const askConfirm = (title, message, onConfirm) => {
    setConfirmDialog({ visible: true, title, message, onConfirm });
  };

  const navItems = [
    { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'Classes', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
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

  // Real-time Data Listeners
  useEffect(() => {
    if (!user) return;

    const unsubClasses = onSnapshot(collection(firestoreDb, 'classes'), (snap) => {
      setClasses(snap.docs.map(doc => ({ ...doc.data(), _id: doc.id })));
    });

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
      return () => { unsubClasses(); unsubNotes(); unsubAssign(); unsubTests(); unsubActivities(); unsubResults(); };
    }

    return () => { unsubClasses(); unsubNotes(); unsubAssign(); unsubTests(); unsubActivities(); };
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
        return s;
      });
    });
    return () => unsubUsers();
  }, [user]);

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
        showToast('Registration Successful! Welcome to Exam Cracker.', 'success');
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
    const storageRef = ref(firebaseStorage, `uploads/${Date.now()}-${file.name}`);
    const snap = await uploadBytes(storageRef, file);
    return await getDownloadURL(snap.ref);
  };

  const handleAddClass = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(firestoreDb, 'classes'), { ...newClass, createdAt: new Date().toISOString() });
      await addDoc(collection(firestoreDb, 'activities'), { title: 'Class Added', text: newClass.subject, icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2', createdAt: new Date().toISOString() });
      setNewClass({ subject: '', batch: '', time: '', status: 'Scheduled' });
      setUploadStatus('Done!'); setTimeout(() => setUploadStatus(''), 2000);
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }

  const handleDeleteClass = (id) => {
    askConfirm("Delete Class?", "Are you sure you want to remove this scheduled class? This cannot be undone.", async () => {
      await deleteDoc(doc(firestoreDb, 'classes', id));
      showToast("Class deleted successfully", "success");
    });
  }

  const handleAddNote = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = noteFile ? await uploadFile(noteFile) : newNote.link;
      await addDoc(collection(firestoreDb, 'notes'), { ...newNote, link: url, createdAt: new Date().toISOString() });
      setNewNote({ title: '', subject: '', link: '' }); setNoteFile(null);
      setUploadStatus('Uploaded!'); setTimeout(() => setUploadStatus(''), 2000);
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }

  const handleDeleteNote = async (id) => { await deleteDoc(doc(firestoreDb, 'notes', id)); }

  const handleAddAssignment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = assignmentFile ? await uploadFile(assignmentFile) : newAssignment.fileUrl;
      await addDoc(collection(firestoreDb, 'assignments'), { ...newAssignment, fileUrl: url, createdAt: new Date().toISOString() });
      setNewAssignment({ title: '', subject: '', deadline: '' }); setAssignmentFile(null);
      setUploadStatus('Assignment added!'); setTimeout(() => setUploadStatus(''), 2000);
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }

  const handleDeleteAssignment = async (id) => { await deleteDoc(doc(firestoreDb, 'assignments', id)); }

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

  if (user?.role === 'admin') {
    navItems.push({ name: 'Students', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197' });
    navItems.push({ name: 'Attendance', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' });
    navItems.push({ name: 'Admin Panel', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37' });
  }

  const getSubTitle = (tab) => {
    switch (tab) {
      case 'Tests': return 'Premium Test Series & Practice Arena';
      case 'Dashboard': return `Welcome back, ${user?.name || 'Student'}`;
      default: return `${tab} Overview`;
    }
  }


  return (
    <>
      <aside className="sidebar">
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
          <div className="search-bar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20" style={{ color: 'var(--text-secondary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search students, classes..." />
          </div>

          <div className="user-profile">
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
            <div className="panel" style={{ textAlign: 'center', padding: '5rem 2rem', margin: '2rem auto', maxWidth: '700px', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '8px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}></div>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', width: '80px', height: '80px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#f59e0b', transform: 'rotate(10deg)' }}>
                <svg style={{ width: '40px', height: '40px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1.5rem', background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Account Verification <br /> Underway! ⏳</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', lineHeight: '1.8', marginBottom: '3rem', maxWidth: '500px', margin: '0 auto 3rem' }}>
                Hello <strong>{user?.name || 'Warrior'}</strong>, we've received your registration for <strong>Exam Cracker Coaching Centre</strong>. Our admins are currently verifying your details.
              </p>
              <div style={{ background: 'var(--bg-glass)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-glass)', marginBottom: '3rem' }}>
                <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  <span style={{ display: 'block', fontWeight: 'bold', color: '#f59e0b', marginBottom: '8px' }}>🚀 Next Steps:</span>
                  1. Sit back and relax! Verification takes about 1-2 hours. <br />
                  2. Once approved, all library and test features will unlock automatically. <br />
                  3. For urgent access, please contact <strong>Tilak Mishra Sir</strong>.
                </p>
              </div>
              <button className="btn" onClick={logout} style={{ padding: '1rem 2.5rem', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: '700' }}>
                Check Status Later
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                {activeTab} {activeTab === 'Admin Panel' ? 'Controls' : 'Overview'}
              </h2>

              {activeTab === 'Dashboard' && (
                <>
                  <div style={{ background: 'var(--surface-gradient)', border: '1px solid var(--border-glass)', padding: '2rem', borderRadius: 'var(--panel-radius)', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <h1 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '8px', letterSpacing: '-0.02em', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Education Overview
                      </h1>
                      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: '500' }}>
                        Welcome to your dashboard, {user?.name || 'Warrior'}. Track your academic journey and solve tests.
                      </p>
                    </div>
                    <div style={{ display: 'none' }}>🎯</div>
                  </div>

                  <div className="stats-grid">
                    {stats.length > 0 ? stats.map((stat, i) => (
                      <div key={i} className="stat-card">
                        <div className="stat-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="32" height="32">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                          </svg>
                        </div>
                        <div className="stat-info">
                          <h3>{stat.title}</h3>
                          <div className="value">{stat.value}</div>
                        </div>
                      </div>
                    )) : (
                      <>
                        <div className="stat-card"><div className="stat-info"><h3>Students</h3><div className="value">0</div></div></div>
                        <div className="stat-card"><div className="stat-info"><h3>Live Classes</h3><div className="value">0</div></div></div>
                        <div className="stat-card"><div className="stat-info"><h3>Tests Done</h3><div className="value">0</div></div></div>
                        <div className="stat-card"><div className="stat-info"><h3>Study Hours</h3><div className="value">0h</div></div></div>
                      </>
                    )}
                  </div>

                  {!user && (
                    <div style={{ background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(129, 140, 248, 0.1) 100%)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '2.5rem', borderRadius: '24px', marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(10px)', animation: 'slide-in 0.5s ease' }}>
                      <div style={{ maxWidth: '60%' }}>
                        <h3 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', marginBottom: '8px' }}>Join the Exam Cracker Elite! 🎯</h3>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6' }}>Create a free account to track your progress, attend live classes, and solve premium test series.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="btn" onClick={() => { setIsLoginView(true); setShowAuthModal(true); }} style={{ padding: '1rem 2rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontWeight: '700', borderRadius: '14px' }}>Login</button>
                        <button className="btn btn-primary" onClick={() => { setIsLoginView(false); setShowAuthModal(true); }} style={{ padding: '1rem 2.5rem', fontWeight: '900', borderRadius: '14px', boxShadow: '0 10px 30px rgba(56, 189, 248, 0.3)' }}>Join Now</button>
                      </div>
                    </div>
                  )}

                  <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
                    <div className="panel">
                      <div className="panel-header">
                        <h3 className="panel-title">📅 Classes & Attendance</h3>
                        <button className="btn btn-primary" onClick={() => setActiveTab('Classes')} style={{ background: 'var(--bg-glass)', color: '#38bdf8' }}>View All</button>
                      </div>
                      <div className="table-container">
                        <table>
                          <thead>
                            <tr>
                              <th>Subject</th>
                              <th>Time</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {classes.slice(0, 3).map((cls, idx) => (
                              <tr key={idx}>
                                <td><strong>{cls.subject}</strong></td>
                                <td>{cls.time}</td>
                                <td><span className={cls.statusClass || "badge badge-scheduled"}>{cls.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {user?.role === 'admin' && (
                        <button className="btn btn-primary" onClick={() => setActiveTab('Attendance')} style={{ width: '100%', marginTop: '1rem', background: '#10b981' }}>Manage Daily Attendance ✍️</button>
                      )}
                    </div>

                    <div className="panel">
                      <div className="panel-header">
                        <h3 className="panel-title">📝 Latest Assignments</h3>
                        <button className="btn btn-primary" onClick={() => setActiveTab('Assignments')} style={{ background: 'var(--bg-glass)', color: '#10b981' }}>View All</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[...assignments].reverse().slice(0, 3).map((as, idx) => (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontWeight: 'bold', margin: 0 }}>{as.title}</p>
                              <small style={{ color: 'var(--text-secondary)' }}>Due: {as.deadline}</small>
                            </div>
                            <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>New</span>
                          </div>
                        ))}
                        {assignments.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No assignments yet.</p>}
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-header">
                        <h3 className="panel-title">🏆 Upcoming Tests</h3>
                        <button className="btn btn-primary" onClick={() => setActiveTab('Tests')} style={{ background: 'var(--bg-glass)', color: '#f59e0b' }}>Go to Tests</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {[...tests].reverse().slice(0, 3).map((t, idx) => (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontWeight: 'bold', margin: 0 }}>{t.title}</p>
                              <small style={{ color: 'var(--text-secondary)' }}>{t.durationMinutes} Mins • {t.questionsCount} Qs</small>
                            </div>
                            <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>⏱ Take</div>
                          </div>
                        ))}
                        {tests.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No tests scheduled.</p>}
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-header">
                        <h3 className="panel-title">📚 Study Material</h3>
                        <button className="btn btn-primary" onClick={() => setActiveTab('Study Material')} style={{ background: 'var(--bg-glass)', color: '#3b82f6' }}>View Library</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {[...notes].reverse().slice(0, 4).map((n, idx) => (
                          <div key={idx} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</p>
                            <small style={{ color: 'var(--text-secondary)' }}>{n.subject}</small>
                          </div>
                        ))}
                        {notes.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', gridColumn: '1/-1' }}>No material uploaded.</p>}
                      </div>
                    </div>

                    <div className="panel" style={{ gridColumn: '1 / -1' }}>
                      <div className="panel-header">
                        <h3 className="panel-title">🔔 Recent Activity</h3>
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

                  <div className="panel">
                    <div className="panel-header"><h3 className="panel-title">📅 Schedule New Class</h3></div>
                    <form onSubmit={handleAddClass} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Subject" value={newClass.subject} onChange={e => setNewClass({ ...newClass, subject: e.target.value })} required />
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Batch Name" value={newClass.batch} onChange={e => setNewClass({ ...newClass, batch: e.target.value })} required />
                      <input style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white' }} placeholder="Time (e.g. 04:00 PM)" value={newClass.time} onChange={e => setNewClass({ ...newClass, time: e.target.value })} required />
                      <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: '#8b5cf6' }}>{submitting ? 'Adding...' : 'Schedule Class 🗓'}</button>
                    </form>
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
                <div className="panel" style={{ overflowX: 'auto', width: '100%' }}>
                  <div className="panel-header"><h3 className="panel-title">Your Assignments</h3></div>
                  <table style={{ width: '100%' }}>
                    <thead><tr><th>Title</th><th>Subject</th><th>Deadline</th>{user?.role === 'admin' ? <th>Action</th> : <th>Status</th>}</tr></thead>
                    <tbody>
                      {assignments.map((a, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{a.title}</strong>
                            {a.fileUrl && <div style={{ fontSize: '0.8rem', marginTop: '5px' }}><a href={a.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>📄 View Attached Document</a></div>}
                          </td>
                          <td>{a.subject}</td>
                          <td>{a.deadline}</td>
                          {user?.role === 'admin' ? (
                            <td><button onClick={() => handleDeleteAssignment(a._id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>Delete</button></td>
                          ) : (
                            <td><button className="btn btn-primary" onClick={() => alert('Assignment Submitted!')} style={{ padding: '5px 10px' }}>Submit Task</button></td>
                          )}
                        </tr>
                      ))}
                      {assignments.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No assignments available.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'Study Material' && (
                <div className="panel" style={{ width: '100%' }}>
                  <div className="panel-header"><h3 className="panel-title">Uploaded Study Materials</h3></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {notes.map((n, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-glass)', padding: '1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ marginBottom: '5px' }}>{n.title}</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>{n.subject}</p>
                          {n.link && <a href={n.link} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.9rem' }}>📂 View / Download Material</a>}
                        </div>
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDeleteNote(n._id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>Delete</button>
                        )}
                      </div>
                    ))}
                    {notes.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>No materials uploaded yet.</p>}
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
                          {[...tests].reverse().filter(t => testFilter === 'All' || t.subject.includes(testFilter)).map((t, idx) => (
                            <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: '20px', overflow: 'hidden', transition: 'all 0.3s ease' }} className="test-series-card">
                              <div style={{ height: '6px', background: completedTests.includes(t._id.toString()) ? '#10b981' : 'var(--accent-gradient)' }}></div>
                              <div style={{ padding: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>{t.subject}</span>
                                  {completedTests.includes(t._id.toString()) ? (
                                    <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold' }}>✅ COMPLETED</span>
                                  ) : (
                                    <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>🕒 NEW</span>
                                  )}
                                </div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.25rem', lineHeight: '1.4' }}>{t.title}</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <p style={{ color: 'white', fontWeight: 'bold' }}>{t.durationMinutes} Mins</p>
                                    <span>Duration</span>
                                  </div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    <p style={{ color: 'white', fontWeight: 'bold' }}>{t.questionsCount}</p>
                                    <span>Questions</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                  {user?.role === 'admin' ? (
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
                          ))}
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
                  <div className="panel-header"><h3 className="panel-title">👥 Student Management & Approvals</h3></div>
                  <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {studentsList.map(s => (
                      <div key={s._id} style={{ background: 'var(--bg-glass)', padding: '1.5rem', borderRadius: '12px', border: s.isApproved ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.5)', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', background: s.isApproved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: s.isApproved ? '#10b981' : '#f59e0b' }}>
                            {s.isApproved ? 'Approved ✅' : 'Pending ⏳'}
                          </span>
                        </div>
                        <h4 style={{ marginBottom: '5px', fontSize: '1.2rem' }}>{s.name}</h4>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>📧 {s.email}</p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          {!s.isApproved && (
                            <button className="btn btn-primary" onClick={() => handleApproveStudent(s._id)} style={{ flex: 1, background: '#10b981', padding: '0.5rem' }}>Approve User</button>
                          )}
                          <button className="btn btn-primary" onClick={() => handleDeleteStudent(s._id)} style={{ flex: s.isApproved ? 1 : 0.5, background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem' }}>Remove</button>
                        </div>
                      </div>
                    ))}
                    {studentsList.length === 0 && <p style={{ color: 'var(--text-secondary)', gridColumn: '1/-1', textAlign: 'center' }}>No students registered yet.</p>}
                  </div>
                </div>
              )}

              {activeTab !== 'Dashboard' && activeTab !== 'Admin Panel' && activeTab !== 'Classes' && activeTab !== 'Assignments' && activeTab !== 'Study Material' && activeTab !== 'Tests' && activeTab !== 'Attendance' && activeTab !== 'Students' && (
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

      {/* Custom Notification Toast */}
      {
        toast.visible && (
          <div className="toast-vanilla" style={{
            position: 'fixed', bottom: '30px', right: '30px', zIndex: 12000,
            background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', padding: '12px 20px', display: 'flex', alignItems: 'center',
            gap: '12px', boxShadow: '0 15px 40px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
            animation: 'slide-in 0.3s ease-out', borderLeft: `6px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`
          }}>
            <div style={{ color: toast.type === 'success' ? '#10b981' : '#ef4444', display: 'flex' }}>
              {toast.type === 'success' ? (
                <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              )}
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap' }}>{toast.message}</span>
          </div>
        )
      }

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

      {/* Refined Welcome Popup */}
      {
        showWelcome && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 11000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              background: '#1a1c1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '28px',
              width: '100%', maxWidth: '400px', position: 'relative', overflow: 'hidden',
              boxShadow: '0 40px 100px rgba(0,0,0,0.6)', animation: 'slide-in 0.4s cubic-bezier(0.1, 1, 0.3, 1)', padding: '30px 25px'
            }}>
              <div style={{ height: '5px', width: '100%', position: 'absolute', top: 0, left: 0, background: 'var(--accent-gradient)' }}></div>

              <div style={{
                width: '60px', height: '60px', background: 'var(--accent-gradient)', borderRadius: '18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px',
                boxShadow: '0 8px 16px rgba(56, 189, 248, 0.2)'
              }}>
                <svg style={{ width: '28px', height: '28px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
              </div>

              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'white', marginBottom: '8px', textAlign: 'center' }}>
                Welcome back, Warrior! 🎯
              </h2>

              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '25px', textAlign: 'center' }}>
                Happy to see you again! Your coaching dashboard is ready. Let's start preparing for your success.
              </p>

              <button
                onClick={() => setShowWelcome(false)}
                style={{
                  width: '100%', background: 'white', color: 'black', fontWeight: '700', padding: '16px',
                  borderRadius: '16px', border: 'none', cursor: 'pointer', transition: '0.2s', fontSize: '1rem'
                }}
                onMouseEnter={(e) => e.target.style.background = '#e2e8f0'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                Enter Dashboard
              </button>

              <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#64748b' }}>
                EXAM CRACKER COACHING CENTRE
              </div>
            </div>
          </div>
        )
      }
      {/* Professional Auth Modal */}
      {
        showAuthModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(15px)' }} onClick={() => setShowAuthModal(false)}></div>
            <div className="panel" style={{ position: 'relative', width: '100%', maxWidth: '440px', padding: '3rem', boxShadow: '0 60px 120px rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '32px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '6px', background: 'var(--accent-gradient)' }}></div>
              <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', borderRadius: '12px', transition: '0.2s' }}>
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
                    <input style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none', transition: '0.2s' }} placeholder="Your Full Name" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} required />
                  </div>
                )}
                <div>
                  <input type="email" style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none', transition: '0.2s' }} placeholder="Email address" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required />
                </div>
                <div>
                  <input type="password" style={{ width: '100%', padding: '1rem 1.25rem', borderRadius: '16px', border: '1px solid var(--border-glass)', background: 'var(--bg-glass)', color: 'white', outline: 'none', transition: '0.2s' }} placeholder="Password" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />
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
  )
}

export default App
