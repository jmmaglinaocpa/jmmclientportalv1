import React, { useState } from 'react';
import { UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db, logout } from '../lib/firebase';
import { useTheme } from '../lib/theme';
import { CPALogo } from './CPALogo';
import { FileSignature, LogOut, CheckCircle2, Sun, Moon, Edit2, User, X, Loader2 } from 'lucide-react';

interface RequestProposalProps {
  userProfile: UserProfile;
}

export default function RequestProposal({ userProfile }: RequestProposalProps) {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  // Client Name Edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        engagementStatus: 'pending'
      });
    } catch (error) {
      console.error('Error requesting proposal:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setIsSavingName(true);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        displayName: newName.trim(),
      });
      setIsEditingName(false);
    } catch (err) {
      console.error('Error updating client name:', err);
    } finally {
      setIsSavingName(false);
    }
  };

  const isPending = userProfile.engagementStatus === 'pending';

  return (
    <div className="min-h-screen bg-sand dark:bg-navy-dark flex flex-col text-navy dark:text-sand transition-colors duration-200">
      <header className="bg-navy dark:bg-navy-dark text-sand border-b border-navy-light dark:border-navy-light/60 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CPALogo size="sm" />
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setNewName(userProfile.displayName);
              setIsEditingName(true);
            }}
            className="flex items-center gap-1.5 text-sm text-sand/80 hover:text-sand transition-colors"
            title="Edit client name"
          >
            <span>{userProfile.displayName}</span>
            <Edit2 className="w-3.5 h-3.5 text-gold" />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 text-sand/70 hover:text-sand rounded-full transition-colors"
            title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-gold" /> : <Moon className="w-5 h-5 text-sand" />}
          </button>
          <button
            onClick={logout}
            className="p-2 text-sand/70 hover:text-sand hover:bg-navy-light rounded-full transition-colors"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white dark:bg-navy rounded-2xl shadow-sm border border-muted-gray/20 dark:border-navy-light p-8 md:p-10 text-center space-y-6">
          
          {isPending ? (
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-full flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-navy dark:text-sand mb-2">Proposal Requested</h2>
                <p className="text-muted-gray dark:text-slate-300 text-sm">
                  Thank you, <span className="font-semibold text-navy dark:text-sand">{userProfile.displayName}</span>. We have received your request for an engagement proposal with <span className="font-semibold text-navy dark:text-sand">Jan Michael Maglinao, CPA</span>. We will review your details and be in touch shortly.
                </p>
              </div>

              <div className="pt-2 border-t border-muted-gray/15 dark:border-navy-light/60">
                <button
                  type="button"
                  onClick={() => {
                    setNewName(userProfile.displayName);
                    setIsEditingName(true);
                  }}
                  className="text-xs font-semibold text-gold hover:underline inline-flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Change Client Name ({userProfile.displayName})
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 bg-gold-light dark:bg-gold/20 text-gold rounded-2xl flex items-center justify-center border border-gold/30">
                <FileSignature className="w-8 h-8" />
              </div>
              
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h2 className="text-2xl font-bold text-navy dark:text-sand">Welcome, {userProfile.displayName}</h2>
                  <button
                    onClick={() => {
                      setNewName(userProfile.displayName);
                      setIsEditingName(true);
                    }}
                    className="p-1 text-muted-gray hover:text-gold"
                    title="Edit Name"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-muted-gray dark:text-slate-300 text-sm">
                  You don't have an active engagement with us yet. Request a proposal to get started with professional accounting services from <span className="font-semibold text-navy dark:text-sand">Jan Michael Maglinao, CPA</span>.
                </p>
              </div>

              <button
                onClick={handleRequest}
                disabled={loading}
                className="w-full bg-gold hover:bg-gold-hover text-white px-6 py-3.5 rounded-xl font-semibold shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Requesting...' : 'Request Engagement Proposal'}
              </button>
            </div>
          )}
          
        </div>
      </main>

      {/* Edit Client Name Modal */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy border border-muted-gray/20 dark:border-navy-light rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 text-left">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-navy dark:text-sand flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                Edit Client Name
              </h3>
              <button
                onClick={() => setIsEditingName(false)}
                className="text-muted-gray hover:text-navy dark:hover:text-sand p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-muted-gray dark:text-slate-300">
              Update how your client or business name is displayed in your portal and to Jan Michael Maglinao, CPA.
            </p>

            <div>
              <label className="block text-xs font-semibold text-navy dark:text-sand mb-1.5">
                Client Name / Company Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. John Doe or Acme Enterprises LLC"
                className="w-full px-3.5 py-2.5 border border-muted-gray/30 dark:border-navy-light rounded-xl text-sm outline-none focus:border-gold bg-sand-light dark:bg-navy-dark text-navy dark:text-sand font-medium"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="px-4 py-2.5 text-xs font-semibold text-muted-gray hover:text-navy dark:hover:text-sand rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newName.trim() || isSavingName}
                onClick={handleSaveName}
                className="px-5 py-2.5 text-xs font-semibold bg-gold hover:bg-gold-hover text-white rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-all"
              >
                {isSavingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

