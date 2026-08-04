import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile } from './types';
import Login from './components/Login';
import RequestProposal from './components/RequestProposal';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      
      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      const userEmail = (user.email || '').trim().toLowerCase();
      const userRef = doc(db, 'users', user.uid);
      let userSnap = await getDoc(userRef);

      // Check if there is a placeholder doc created by Admin prior to user login
      try {
        const qUsers = query(collection(db, 'users'));
        const usersSnap = await getDocs(qUsers);
        const invitedPlaceholder = usersSnap.docs
          .map(d => ({ ...d.data(), uid: d.id } as UserProfile))
          .find(d => d.uid !== user.uid && d.email && d.email.trim().toLowerCase() === userEmail);

        if (invitedPlaceholder) {
          const oldUid = invitedPlaceholder.uid;

          // Migrate tax returns
          const qReturns = query(collection(db, 'taxReturns'), where('userId', '==', oldUid));
          const returnsSnap = await getDocs(qReturns);
          for (const rDoc of returnsSnap.docs) {
            await updateDoc(doc(db, 'taxReturns', rDoc.id), { userId: user.uid });
          }

          // Migrate pending items
          const qItems = query(collection(db, 'pendingItems'), where('userId', '==', oldUid));
          const itemsSnap = await getDocs(qItems);
          for (const iDoc of itemsSnap.docs) {
            await updateDoc(doc(db, 'pendingItems', iDoc.id), { userId: user.uid });
          }

          // Save migrated profile to user.uid
          const activeProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: invitedPlaceholder.displayName || user.displayName || 'Client',
            clientLogoUrl: invitedPlaceholder.clientLogoUrl || '',
            engagementStatus: invitedPlaceholder.engagementStatus || 'active',
            createdAt: invitedPlaceholder.createdAt || Date.now(),
          };

          await setDoc(userRef, activeProfile);
          await deleteDoc(doc(db, 'users', oldUid));
          userSnap = await getDoc(userRef);
        }
      } catch (err) {
        console.warn('Error checking/migrating invited client profile:', err);
      }

      if (!userSnap.exists()) {
        // Create new user profile
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Client',
          engagementStatus: 'none',
          createdAt: Date.now(),
        };
        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);
      } else {
        setUserProfile(userSnap.data() as UserProfile);
      }
      
      // Subscribe to profile changes
      const unsubscribeProfile = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          setUserProfile(doc.data() as UserProfile);
        }
      }, (error) => {
        console.warn('Profile snapshot listener error:', error);
      });
      
      setLoading(false);
      return () => unsubscribeProfile();
    });

    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-sand dark:bg-navy-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  if (!authUser || !userProfile) {
    return <Login />;
  }

  if (userProfile.email === 'jm.maglinao.cpa@gmail.com') {
    return <AdminDashboard userProfile={userProfile} />;
  }

  if (userProfile.engagementStatus === 'none' || userProfile.engagementStatus === 'pending') {
    return <RequestProposal userProfile={userProfile} />;
  }

  return <Dashboard userProfile={userProfile} />;
}
