const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'student' }
});

const User = mongoose.model('User', UserSchema);

async function seedAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const email = 'tilakmishra.76@gmail.com';
        const existing = await User.findOne({ email });
        if (existing) {
            console.log('Admin already exists. Deleting and recreating...');
            await User.deleteOne({ email });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('TILA123@', salt);

        const newAdmin = new User({
            name: 'Tilak Mishra',
            email: email,
            password: hashedPassword,
            role: 'admin'
        });

        await newAdmin.save();
        console.log('Admin user seeded perfectly!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

seedAdmin();
