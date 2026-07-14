import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { collection, deleteDoc, doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB-NJc5KvUvTpVCoEDCgcNIO7xZjVxh04U",
  authDomain: "mens-trip-san-francisco.firebaseapp.com",
  projectId: "mens-trip-san-francisco",
  storageBucket: "mens-trip-san-francisco.firebasestorage.app",
  messagingSenderId: "1050615044656",
  appId: "1:1050615044656:web:5d78ab0f84f2e476b52bf5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;
let authPromise = null;

export function ensureAnonymousUser() {
  if (currentUser) return Promise.resolve(currentUser);
  if (authPromise) return authPromise;
  authPromise = new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, async user => {
      if (user) {
        currentUser = user;
        stop();
        resolve(user);
        return;
      }
      try { await signInAnonymously(auth); }
      catch (error) { stop(); reject(error); }
    });
  });
  return authPromise;
}

export async function setBarVote(barId, vote) {
  const user = await ensureAnonymousUser();
  const ref = doc(db, "barVotes", `${barId}_${user.uid}`);
  if (vote === null) {
    await deleteDoc(ref);
    return;
  }
  await setDoc(ref, { barId, userId: user.uid, vote, updatedAt: serverTimestamp() });
}

export async function subscribeToBarVotes(onChange, onError) {
  const user = await ensureAnonymousUser();
  return onSnapshot(collection(db, "barVotes"), snapshot => {
    const totals = {};
    const mine = {};
    snapshot.forEach(item => {
      const data = item.data();
      if (!data.barId || !["up","down"].includes(data.vote)) return;
      totals[data.barId] ??= {up:0,down:0};
      totals[data.barId][data.vote] += 1;
      if (data.userId === user.uid) mine[data.barId] = data.vote;
    });
    onChange({totals,mine});
  }, onError);
}
