require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const multer = require('multer');
const path = require('path');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    // Use dynamic host instead of hardcoded localhost
    const host = req.headers.host;
    res.json({ url: `http://${host}/uploads/${req.file.filename}` });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27010/examcracker").then(() => {
    console.log('Connected to MongoDB successfully');
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
});

// Schemas
const DashboardStatsSchema = new mongoose.Schema({
    title: String,
    value: String,
    icon: String
});

const ClassSchema = new mongoose.Schema({
    subject: String,
    batch: String,
    time: String,
    status: String,
    statusClass: String // e.g., 'badge-warning', 'badge-info' etc
});

const ActivitySchema = new mongoose.Schema({
    title: String,
    text: String,
    time: String,
    icon: String
});

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'student' },
    isApproved: { type: Boolean, default: false }
});

const NoteSchema = new mongoose.Schema({
    title: String,
    subject: String,
    link: String
});

const AssignmentSchema = new mongoose.Schema({
    title: String,
    subject: String,
    deadline: String,
    fileUrl: String
});

const TestSchema = new mongoose.Schema({
    title: String,
    subject: String,
    durationMinutes: Number,
    questionsCount: Number,
    negativeMark: { type: Number, default: 0 },
    instructions: { type: String, default: '' },
    fileUrl: String,
    answerKey: [Number]
});


const TestResultSchema = new mongoose.Schema({
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tests' },
    userName: String,
    userEmail: String,
    score: Number,
    correct: Number,
    wrong: Number,
    skipped: Number,
    total: Number,
    isPractice: { type: Boolean, default: false },
});

const AttendanceSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // Format: YYYY-MM-DD
    records: [{
        studentId: String,
        name: String,
        email: String,
        status: { type: String, enum: ['Present', 'Absent', 'Late'], default: 'Present' }
    }]
});

// Models
const Stats = mongoose.model('Stats', DashboardStatsSchema);
const Classes = mongoose.model('Classes', ClassSchema);
const Activities = mongoose.model('Activities', ActivitySchema);
const User = mongoose.model('User', UserSchema);
const Notes = mongoose.model('Notes', NoteSchema);
const Assignments = mongoose.model('Assignments', AssignmentSchema);
const Tests = mongoose.model('Tests', TestSchema);
const TestResults = mongoose.model('TestResults', TestResultSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);

// Setup seed route to populate initial data if needed
app.get('/api/seed', async (req, res) => {
    try {
        const statsCount = await Stats.countDocuments();
        if (statsCount === 0) {
            await Stats.insertMany([
                { title: 'Total Students', value: '1,248', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
                { title: 'Active Classes', value: '42', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
                { title: 'Pending Fees', value: '₹45,500', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                { title: 'Avg. Attendance', value: '94%', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' }
            ]);
            await Classes.insertMany([
                { subject: 'Physics (Capacitance)', batch: 'Class 12th Board Target', time: '04:00 PM - 05:30 PM', status: 'Starting Soon', statusClass: 'badge badge-warning' },
                { subject: 'Mathematics (Calculus)', batch: 'JEE Main Target 2027', time: '06:00 PM - 07:30 PM', status: 'Scheduled', statusClass: 'badge-scheduled' },
                { subject: 'Chemistry (Organic)', batch: 'Class 11th Foundation', time: '08:00 PM - 09:30 PM', status: 'Scheduled', statusClass: 'badge-scheduled' }
            ]);
            await Activities.insertMany([
                { title: 'New Student Registration', text: 'Rahul Sharma joined Class 10th Math Batch', time: '10 mins ago', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
                { title: 'Assignment Submitted', text: 'Physics Chapter 4 by 32 students', time: '1 hour ago', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
                { title: 'Fee Payment Received', text: '₹2,500 from Priya Verma (Class 12th)', time: '2 hours ago', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' }
            ]);
            res.json({ message: 'Database seeded successfully' });
        } else {
            res.json({ message: 'Database already has data' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API Routes
app.get('/api/dashboard', async (req, res) => {
    try {
        const stats = await Stats.find();
        const classes = await Classes.find();
        const activities = await Activities.find().sort({ _id: -1 });

        res.json({ stats, classes, activities });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/classes', async (req, res) => {
    try {
        const classes = await Classes.find();
        res.json(classes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/classes', async (req, res) => {
    try {
        const newClass = new Classes(req.body);
        await newClass.save();
        res.json(newClass);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/classes/:id', async (req, res) => {
    try {
        await Classes.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const JWT_SECRET = 'examcracker_super_secret';

app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'User already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const role = email === 'tilakmishra.76@gmail.com' ? 'admin' : 'student';
        const isApproved = role === 'admin';

        const newUser = new User({ name, email, password: hashedPassword, role, isApproved });
        await newUser.save();

        if (!isApproved) {
            return res.json({ message: 'Registration successful! Please wait for Admin approval to login.' });
        }

        const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'User does not exist' });

        if (!user.isApproved && user.role !== 'admin') {
            return res.status(403).json({ error: 'Your account is pending Admin approval.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/notes', async (req, res) => {
    try {
        res.json(await Notes.find());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/notes', async (req, res) => {
    try {
        const newNote = new Notes(req.body);
        await newNote.save();
        res.json(newNote);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/notes/:id', async (req, res) => {
    try {
        await Notes.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/assignments', async (req, res) => {
    try {
        res.json(await Assignments.find());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/assignments', async (req, res) => {
    try {
        const newAssignment = new Assignments(req.body);
        await newAssignment.save();
        res.json(newAssignment);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/assignments/:id', async (req, res) => {
    try {
        await Assignments.findByIdAndDelete(req.params.id);
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tests', async (req, res) => {
    try {
        res.json(await Tests.find());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.post('/api/tests', async (req, res) => {
    try {
        const newTest = new Tests(req.body);
        await newTest.save();
        res.json(newTest);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.delete('/api/tests/:id', async (req, res) => {
    try {
        await Tests.findByIdAndDelete(req.params.id);
        await TestResults.deleteMany({ testId: req.params.id });
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/test-results', async (req, res) => {
    try {
        const existing = await TestResults.findOne({ testId: req.body.testId, userEmail: req.body.userEmail, isPractice: false });
        const newResult = new TestResults({ ...req.body, isPractice: !!existing });
        await newResult.save();
        res.json(newResult);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/test-results/:testId', async (req, res) => {
    try {
        const results = await TestResults.find({ testId: req.params.testId, isPractice: false }).sort({ score: -1, submittedAt: 1 });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user-tests/:email', async (req, res) => {
    try {
        const results = await TestResults.find({ userEmail: req.params.email, isPractice: false });
        const completedTestIds = results.map(r => r.testId.toString());
        res.json(completedTestIds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Students and Attendance Endpoints
app.get('/api/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }, 'name email _id isApproved');
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/students/:id/approve', async (req, res) => {
    try {
        const student = await User.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
        res.json(student);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/students/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'Student deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/attendance', async (req, res) => {
    try {
        const { date } = req.query; // YYYY-MM-DD format
        if (!date) return res.status(400).json({ error: 'Date is required' });

        const attendance = await Attendance.findOne({ date });
        res.json(attendance || { date, records: [] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/attendance', async (req, res) => {
    try {
        const { date, records } = req.body;
        // Upsert the attendance document for that date
        const attendance = await Attendance.findOneAndUpdate(
            { date },
            { date, records },
            { new: true, upsert: true }
        );
        res.json(attendance);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Conditionally start the server if NOT running on Vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export the app for Vercel
module.exports = app;
