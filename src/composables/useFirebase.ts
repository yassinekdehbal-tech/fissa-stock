import { initializeApp } from 'firebase/app'
import { getDatabase, ref, push, set, onValue, remove, update, get, type DatabaseReference } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyAjRxW1hHY7ikmcm2-QOOvZDhUxl9CeE3Y",
  authDomain: "fissa-stock.firebaseapp.com",
  databaseURL: "https://fissa-stock-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "fissa-stock",
  storageBucket: "fissa-stock.firebasestorage.app",
  messagingSenderId: "657308229308",
  appId: "1:657308229308:web:6677ba616259cf8915bab9"
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

export function useFirebase() {
  return {
    db,
    dbRef: (path: string) => ref(db, path),
    push: (reference: DatabaseReference) => push(reference),
    set,
    get,
    onValue,
    remove,
    update
  }
}
