import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyDQdEooDscqa_lRc8Fo3E6YS-eu59obVcY",
    authDomain: "student-profile-dashboar-75564.firebaseapp.com",
    databaseURL: "https://student-profile-dashboar-75564-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "student-profile-dashboar-75564",
    storageBucket: "student-profile-dashboar-75564.firebasestorage.app",
    messagingSenderId: "432406211304",
    appId: "1:432406211304:web:4e268fc1ff5771784e375d",
    measurementId: "G-3RHL7LZKCK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
