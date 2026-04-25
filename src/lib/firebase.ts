import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
	prompt: 'select_account',
});

export const signIn = async () => {
	try {
		await signInWithPopup(auth, googleProvider);
	} catch (error: any) {
		const code = error?.code as string | undefined;

		// Popup auth can fail on some hosted environments. Redirect is more reliable.
		if (
			code === 'auth/popup-blocked' ||
			code === 'auth/popup-closed-by-user' ||
			code === 'auth/cancelled-popup-request' ||
			code === 'auth/unauthorized-domain'
		) {
			await signInWithRedirect(auth, googleProvider);
			return;
		}

		throw error;
	}
};

export const logout = () => signOut(auth);
