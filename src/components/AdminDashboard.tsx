import React, { useEffect, useState } from 'react';
import { UserProfile, TaxReturn, PendingItem } from '../types';
import { db, logout, signInWithGoogle, getCachedAccessToken } from '../lib/firebase';
import { useTheme } from '../lib/theme';
import { CPALogo } from './CPALogo';
import { sendInviteEmail } from '../lib/gmail';
import { GoogleAuthProvider } from 'firebase/auth';
import { collection, query, onSnapshot, updateDoc, doc, addDoc, setDoc } from 'firebase/firestore';
import { 
  FileText, CheckCircle2, AlertCircle, LogOut, Loader2, Users, ListTodo, 
  FileUp, X, ExternalLink, Link as LinkIcon, Sun, Moon, UserPlus, Mail, Send, Check
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminDashboardProps {
  userProfile: UserProfile;
}

export default function AdminDashboard({ userProfile }: AdminDashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [taxReturns, setTaxReturns] = useState<TaxReturn[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Forms states
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [taxTitle, setTaxTitle] = useState('');
  const [taxFileUrl, setTaxFileUrl] = useState('');
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [taxDateFiled, setTaxDateFiled] = useState(new Date().toISOString().split('T')[0]);

  const [showItemForm, setShowItemForm] = useState(false);
  const [itemTitle, setItemTitle] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemDeadline, setItemDeadline] = useState('');

  // Invite modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'active' | 'pending'>('active');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  useEffect(() => {
    const qUsers = query(collection(db, 'users'));
    const qReturns = query(collection(db, 'taxReturns'));
    const qItems = query(collection(db, 'pendingItems'));

    const unsubUsers = onSnapshot(qUsers, snap => {
      setUsers(snap.docs.map(d => ({ ...d.data(), uid: d.id } as UserProfile)));
    }, (err) => {
      console.warn('Admin users snapshot error:', err);
    });
    
    const unsubReturns = onSnapshot(qReturns, snap => {
      setTaxReturns(snap.docs.map(d => ({ ...d.data(), id: d.id } as TaxReturn)));
    }, (err) => {
      console.warn('Admin returns snapshot error:', err);
    });

    const unsubItems = onSnapshot(qItems, snap => {
      setPendingItems(snap.docs.map(d => ({ ...d.data(), id: d.id } as PendingItem)));
      setLoading(false);
    }, (err) => {
      console.warn('Admin items snapshot error:', err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubReturns();
      unsubItems();
    };
  }, []);

  const handleApproveEngagement = async (uid: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { engagementStatus: 'active' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddTaxReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !taxTitle || !taxFileUrl || !taxDateFiled) return;
    
    try {
      await addDoc(collection(db, 'taxReturns'), {
        userId: selectedUserId,
        title: taxTitle,
        fileUrl: taxFileUrl,
        taxYear: Number(taxYear),
        dateFiled: new Date(taxDateFiled).getTime(),
        dateUploaded: Date.now()
      });
      setShowTaxForm(false);
      setTaxTitle('');
      setTaxFileUrl('');
      setTaxYear(new Date().getFullYear());
      setTaxDateFiled(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddPendingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !itemTitle || !itemDeadline) return;

    try {
      await addDoc(collection(db, 'pendingItems'), {
        userId: selectedUserId,
        title: itemTitle,
        description: itemDesc,
        deadline: new Date(itemDeadline).getTime(),
        status: 'pending'
      });
      setShowItemForm(false);
      setItemTitle('');
      setItemDesc('');
      setItemDeadline('');
    } catch (err) {
      console.error(err);
    }
  };

  // Handler: Send Google Account Invite via Gmail API
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    setIsSendingInvite(true);
    setInviteFeedback(null);

    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanName = inviteName.trim();

    try {
      // 1. Ensure Google OAuth Access Token with Gmail Scope
      let token = getCachedAccessToken();
      if (!token) {
        const authRes = await signInWithGoogle();
        const cred = GoogleAuthProvider.credentialFromResult(authRes);
        token = cred?.accessToken || null;
      }

      if (!token) {
        throw new Error('Google OAuth authorization is required to send emails via Gmail.');
      }

      // 2. Check if client already exists in Firestore
      const existingUser = users.find(u => u.email.toLowerCase() === cleanEmail);
      let targetUid = existingUser?.uid;

      if (!existingUser) {
        const newDocRef = doc(collection(db, 'users'));
        targetUid = newDocRef.id;
        const newProfile: UserProfile = {
          uid: targetUid,
          email: cleanEmail,
          displayName: cleanName,
          engagementStatus: inviteStatus,
          createdAt: Date.now(),
        };
        await setDoc(newDocRef, newProfile);
      } else {
        await updateDoc(doc(db, 'users', existingUser.uid), {
          displayName: cleanName,
          engagementStatus: inviteStatus,
        });
      }

      // Select newly created/updated client so admin can immediately add returns & tracker items!
      if (targetUid) {
        setSelectedUserId(targetUid);
      }

      // 3. Send Email via Gmail API using CPA Account (jm.maglinao.cpa@gmail.com)
      const appUrl = window.location.origin;
      const emailRes = await sendInviteEmail({
        recipientEmail: cleanEmail,
        recipientName: cleanName,
        customMessage: inviteNote,
        appUrl,
        accessToken: token,
      });

      if (!emailRes.success) {
        setInviteFeedback({
          type: 'error',
          message: `Client created in portal, but Gmail invite failed: ${emailRes.error || 'Unknown error'}`
        });
      } else {
        setInviteFeedback({
          type: 'success',
          message: `Invitation successfully sent to ${cleanEmail} via Gmail!`
        });
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteEmail('');
          setInviteName('');
          setInviteNote('');
          setInviteFeedback(null);
        }, 1800);
      }
    } catch (err: any) {
      console.error('Invite error:', err);
      setInviteFeedback({
        type: 'error',
        message: err.message || 'An error occurred while sending invite.'
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  // Handler: Resend Invite for currently selected client
  const handleResendInvite = async (client: UserProfile) => {
    setIsSendingInvite(true);
    setResendStatus(null);
    try {
      let token = getCachedAccessToken();
      if (!token) {
        const authRes = await signInWithGoogle();
        const cred = GoogleAuthProvider.credentialFromResult(authRes);
        token = cred?.accessToken || null;
      }

      if (!token) {
        setResendStatus('Failed: Google OAuth permission required.');
        return;
      }

      const appUrl = window.location.origin;
      const res = await sendInviteEmail({
        recipientEmail: client.email,
        recipientName: client.displayName,
        appUrl,
        accessToken: token,
      });

      if (res.success) {
        setResendStatus(`Invitation sent to ${client.email} via Gmail!`);
        setTimeout(() => setResendStatus(null), 3500);
      } else {
        setResendStatus(`Error: ${res.error}`);
      }
    } catch (err: any) {
      setResendStatus(`Error: ${err.message}`);
    } finally {
      setIsSendingInvite(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sand dark:bg-navy-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  const selectedUser = users.find(u => u.uid === selectedUserId);
  const userReturns = taxReturns.filter(t => t.userId === selectedUserId).sort((a,b) => b.taxYear - a.taxYear);
  const userItems = pendingItems.filter(p => p.userId === selectedUserId).sort((a,b) => a.deadline - b.deadline);

  return (
    <div className="min-h-screen bg-sand dark:bg-navy-dark font-sans flex flex-col md:flex-row text-navy dark:text-sand transition-colors duration-200">
      {/* Sidebar: Users List */}
      <aside className="w-full md:w-80 bg-white dark:bg-navy border-r border-muted-gray/20 dark:border-navy-light h-screen md:sticky top-0 overflow-y-auto flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-muted-gray/20 dark:border-navy-light flex justify-between items-center bg-white dark:bg-navy sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <CPALogo size="sm" subtitle="Admin Portal" lightText={false} />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-gray hover:text-navy dark:hover:text-sand rounded-full transition-colors"
              title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-gold" /> : <Moon className="w-5 h-5 text-navy" />}
            </button>
            <button onClick={logout} className="p-2 text-muted-gray hover:text-navy dark:hover:text-sand rounded-full transition-colors" title="Log out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-gray dark:text-slate-400 uppercase tracking-wider">Clients</h2>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1 text-xs font-bold text-navy dark:text-gold bg-gold/15 dark:bg-gold/20 hover:bg-gold/25 px-2.5 py-1 rounded-lg border border-gold/40 transition-all"
              title="Send Google Account Invite via Gmail"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Invite Client
            </button>
          </div>

          {users.filter(u => u.email !== userProfile.email).map(u => (
            <button
              key={u.uid}
              onClick={() => setSelectedUserId(u.uid)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                selectedUserId === u.uid 
                  ? 'bg-gold-light dark:bg-navy-card border-gold dark:border-gold shadow-sm' 
                  : 'bg-white dark:bg-navy-card/40 border-muted-gray/15 dark:border-navy-light/60 hover:border-gold/50 hover:bg-sand-light dark:hover:bg-navy-card/80'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                {u.clientLogoUrl ? (
                  <img
                    src={u.clientLogoUrl}
                    alt={u.displayName}
                    className="w-9 h-9 rounded-lg object-contain bg-sand-light dark:bg-navy p-0.5 border border-gold/40 shadow-xs flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gold-light dark:bg-navy-card text-gold font-bold text-xs flex items-center justify-center border border-gold/30 flex-shrink-0">
                    {u.displayName?.charAt(0) || 'C'}
                  </div>
                )}
                <div className="truncate flex-1">
                  <div className="font-semibold text-navy dark:text-sand truncate text-sm">{u.displayName}</div>
                  <div className="text-xs text-muted-gray dark:text-slate-400 truncate">{u.email}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  u.engagementStatus === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                  u.engagementStatus === 'pending' ? 'bg-gold/20 text-gold-hover dark:text-gold border border-gold/30' :
                  'bg-sand dark:bg-navy-dark text-navy dark:text-sand border border-muted-gray/20'
                }`}>
                  {u.engagementStatus.toUpperCase()}
                </span>
                {u.engagementStatus === 'pending' && (
                  <span className="text-[10px] font-semibold text-gold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse"></span>
                    New Request
                  </span>
                )}
              </div>
            </button>
          ))}
          {users.filter(u => u.email !== userProfile.email).length === 0 && (
            <div className="text-center py-8 px-4 space-y-3">
              <p className="text-sm text-muted-gray dark:text-slate-400">No clients in system yet.</p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="inline-flex items-center gap-2 text-xs font-bold bg-navy dark:bg-gold text-sand dark:text-navy-dark px-3 py-2 rounded-xl shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                Invite First Client
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-sand dark:bg-navy-dark p-6 md:p-8">
        {!selectedUser ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-gray dark:text-slate-400 py-16">
            <Users className="w-16 h-16 mb-4 text-muted-gray/40" />
            <p className="text-lg font-semibold text-navy dark:text-sand">Select or Invite a client</p>
            <p className="text-sm text-muted-gray dark:text-slate-400 max-w-sm text-center mt-1">
              Choose a client from the sidebar or click "Invite Client" to send a Google Account invitation via Gmail.
            </p>
            <button
              onClick={() => setShowInviteModal(true)}
              className="mt-6 inline-flex items-center gap-2 bg-navy dark:bg-gold text-sand dark:text-navy-dark px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all hover:opacity-90"
            >
              <Mail className="w-4 h-4" />
              Send Invite via Gmail
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Client Header */}
            <div className="bg-white dark:bg-navy p-6 rounded-2xl shadow-sm border border-muted-gray/20 dark:border-navy-light">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  {selectedUser.clientLogoUrl ? (
                    <img
                      src={selectedUser.clientLogoUrl}
                      alt={selectedUser.displayName}
                      className="w-14 h-14 rounded-2xl object-contain bg-sand-light dark:bg-navy-card p-1 border border-gold/40 shadow-xs flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-gold-light dark:bg-navy-card text-gold flex items-center justify-center font-bold text-xl border border-gold/30 flex-shrink-0">
                      {selectedUser.displayName?.charAt(0) || 'C'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-navy dark:text-sand">{selectedUser.displayName}</h1>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        selectedUser.engagementStatus === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200' : 'bg-gold/20 text-gold-hover dark:text-gold border border-gold/30'
                      }`}>
                        {selectedUser.engagementStatus.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-muted-gray dark:text-slate-300 text-sm mt-0.5">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedUser.engagementStatus === 'pending' && (
                    <button
                      onClick={() => handleApproveEngagement(selectedUser.uid)}
                      className="bg-gold hover:bg-gold-hover text-navy-dark font-bold px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-xs transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve Engagement
                    </button>
                  )}
                  <button
                    onClick={() => handleResendInvite(selectedUser)}
                    disabled={isSendingInvite}
                    className="bg-navy dark:bg-navy-card hover:bg-navy-light text-sand dark:text-gold border border-gold/30 px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
                    title="Resend invitation link via Gmail (jm.maglinao.cpa@gmail.com)"
                  >
                    {isSendingInvite ? <Loader2 className="w-4 h-4 animate-spin text-gold" /> : <Send className="w-4 h-4 text-gold" />}
                    <span>Resend Invite Email</span>
                  </button>
                </div>
              </div>

              {resendStatus && (
                <div className={`mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  resendStatus.startsWith('Error') || resendStatus.startsWith('Failed')
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 border border-red-200'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200'
                }`}>
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span>{resendStatus}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Deliverables (Tax Returns) */}
              <section className="bg-white dark:bg-navy rounded-2xl shadow-sm border border-muted-gray/20 dark:border-navy-light overflow-hidden">
                <div className="px-6 py-4 border-b border-muted-gray/20 dark:border-navy-light bg-sand-light dark:bg-navy-card flex justify-between items-center">
                  <h2 className="font-semibold text-navy dark:text-sand flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gold" />
                    Tax Returns
                  </h2>
                  <button
                    onClick={() => setShowTaxForm(!showTaxForm)}
                    className="p-1.5 text-muted-gray hover:text-gold hover:bg-gold-light dark:hover:bg-navy-card rounded-md transition-colors"
                    title="Add Tax Return"
                  >
                    {showTaxForm ? <X className="w-5 h-5" /> : <FileUp className="w-5 h-5" />}
                  </button>
                </div>

                {showTaxForm && (
                  <div className="p-5 border-b border-muted-gray/20 dark:border-navy-light bg-sand dark:bg-navy-card/80">
                    <form onSubmit={handleAddTaxReturn} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-navy dark:text-sand mb-1">Title</label>
                        <input required type="text" value={taxTitle} onChange={e => setTaxTitle(e.target.value)} placeholder="e.g. 2023 Form 1040" className="w-full px-3 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-navy dark:text-sand mb-1">File URL</label>
                          <input required type="url" value={taxFileUrl} onChange={e => setTaxFileUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-navy dark:text-sand mb-1">Tax Year</label>
                          <input required type="number" value={taxYear} onChange={e => setTaxYear(Number(e.target.value))} className="w-full px-3 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-navy dark:text-sand mb-1">Date Filed</label>
                        <input required type="date" value={taxDateFiled} onChange={e => setTaxDateFiled(e.target.value)} className="w-full px-3 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand" />
                      </div>
                      <button type="submit" className="w-full bg-navy dark:bg-gold text-sand dark:text-navy-dark px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-navy-light dark:hover:bg-gold-hover shadow-sm transition-colors">
                        Upload Return
                      </button>
                    </form>
                  </div>
                )}

                <div className="p-0">
                  {userReturns.length === 0 ? (
                    <p className="p-6 text-sm text-muted-gray dark:text-slate-400 text-center">No tax returns uploaded yet.</p>
                  ) : (
                    <ul className="divide-y divide-muted-gray/15 dark:divide-navy-light/40">
                      {userReturns.map(tax => (
                        <li key={tax.id} className="p-4 flex items-center justify-between hover:bg-sand-light dark:hover:bg-navy-card/60 transition-colors">
                          <div>
                            <h3 className="text-sm font-semibold text-navy dark:text-sand">{tax.title}</h3>
                            <p className="text-xs text-muted-gray dark:text-slate-400 mt-1">
                              Year {tax.taxYear} • Filed: {format(tax.dateFiled, 'MMM d, yyyy')}
                              {tax.dateUploaded && ` • Uploaded: ${format(tax.dateUploaded, 'MMM d, yyyy')}`}
                            </p>
                          </div>
                          <a href={tax.fileUrl} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline text-sm font-semibold">View</a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Pending Items */}
              <section className="bg-white dark:bg-navy rounded-2xl shadow-sm border border-muted-gray/20 dark:border-navy-light overflow-hidden">
                <div className="px-6 py-4 border-b border-muted-gray/20 dark:border-navy-light bg-sand-light dark:bg-navy-card flex justify-between items-center">
                  <h2 className="font-semibold text-navy dark:text-sand flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-gold" />
                    Pending Requests
                  </h2>
                  <button
                    onClick={() => setShowItemForm(!showItemForm)}
                    className="p-1.5 text-muted-gray hover:text-gold hover:bg-gold-light dark:hover:bg-navy-card rounded-md transition-colors"
                    title="Add Pending Item"
                  >
                    {showItemForm ? <X className="w-5 h-5" /> : <ListTodo className="w-5 h-5" />}
                  </button>
                </div>

                {showItemForm && (
                  <div className="p-5 border-b border-muted-gray/20 dark:border-navy-light bg-sand dark:bg-navy-card/80">
                    <form onSubmit={handleAddPendingItem} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-navy dark:text-sand mb-1">Task Title</label>
                        <input required type="text" value={itemTitle} onChange={e => setItemTitle(e.target.value)} placeholder="e.g. Upload W-2 Forms" className="w-full px-3 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-navy dark:text-sand mb-1">Description (Optional)</label>
                        <textarea value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Additional instructions..." rows={2} className="w-full px-3 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-navy dark:text-sand mb-1">Deadline</label>
                        <input required type="date" value={itemDeadline} onChange={e => setItemDeadline(e.target.value)} className="w-full px-3 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand" />
                      </div>
                      <button type="submit" className="w-full bg-navy dark:bg-gold text-sand dark:text-navy-dark px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-navy-light dark:hover:bg-gold-hover shadow-sm transition-colors">
                        Create Request
                      </button>
                    </form>
                  </div>
                )}

                <div className="p-0">
                  {userItems.length === 0 ? (
                    <p className="p-6 text-sm text-muted-gray dark:text-slate-400 text-center">No pending items for this client.</p>
                  ) : (
                    <ul className="divide-y divide-muted-gray/15 dark:divide-navy-light/40">
                      {userItems.map(item => (
                        <li key={item.id} className="p-4 hover:bg-sand-light dark:hover:bg-navy-card/60 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className={`text-sm font-semibold ${item.status === 'completed' ? 'text-muted-gray dark:text-slate-400 line-through' : 'text-navy dark:text-sand'}`}>
                              {item.title}
                            </h3>
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${item.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200' : 'bg-gold/20 text-gold-hover dark:text-gold border border-gold/30'}`}>
                              {item.status.toUpperCase()}
                            </span>
                          </div>
                          {item.description && <p className="text-xs text-muted-gray dark:text-slate-300 mb-2">{item.description}</p>}
                          <p className="text-xs text-muted-gray dark:text-slate-400">Due: {format(item.deadline, 'MMM d, yyyy')}</p>
                          
                          {item.replyUrl && (
                            <div className="mt-2.5 p-3 bg-gold-light dark:bg-navy-card rounded-xl border border-gold/30 dark:border-navy-light text-xs text-navy dark:text-sand space-y-1">
                              <span className="font-semibold text-gold-hover dark:text-gold flex items-center gap-1">
                                <LinkIcon className="w-3.5 h-3.5" /> Client Provided Link:
                              </span>
                              <a
                                href={item.replyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-navy dark:text-gold font-medium underline flex items-center gap-1 hover:text-gold-hover break-all"
                              >
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                <span>{item.replyUrl}</span>
                              </a>
                              {item.clientNote && (
                                <p className="text-muted-gray dark:text-slate-300 italic mt-1">"{item.clientNote}"</p>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

            </div>
          </div>
        )}
      </main>

      {/* Modal: Invite Google Account via Gmail */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-navy/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy rounded-2xl max-w-md w-full shadow-2xl border border-muted-gray/20 dark:border-navy-light overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-muted-gray/20 dark:border-navy-light flex items-center justify-between bg-sand-light dark:bg-navy-card">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gold/20 text-gold-hover dark:text-gold flex items-center justify-center border border-gold/30">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-navy dark:text-sand text-base">Invite Client via Gmail</h3>
                  <p className="text-[11px] text-muted-gray dark:text-slate-400">Sends email invitation from jm.maglinao.cpa@gmail.com</p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 text-muted-gray hover:text-navy dark:hover:text-sand rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-navy dark:text-sand mb-1">
                  Google Account Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="client.name@gmail.com"
                  className="w-full px-3.5 py-2.5 border border-muted-gray/30 dark:border-navy-light rounded-xl text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand"
                />
                <span className="text-[11px] text-muted-gray dark:text-slate-400 mt-1 block">
                  The client will use this Google account to activate their dashboard.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy dark:text-sand mb-1">
                  Client / Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="e.g. Jane Doe or Acme Enterprises"
                  className="w-full px-3.5 py-2.5 border border-muted-gray/30 dark:border-navy-light rounded-xl text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy dark:text-sand mb-1">
                  Engagement Status
                </label>
                <select
                  value={inviteStatus}
                  onChange={e => setInviteStatus(e.target.value as 'active' | 'pending')}
                  className="w-full px-3.5 py-2.5 border border-muted-gray/30 dark:border-navy-light rounded-xl text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand"
                >
                  <option value="active">Active Client (Full Dashboard Access)</option>
                  <option value="pending">Pending Proposal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-navy dark:text-sand mb-1">
                  Custom Personal Message (Optional)
                </label>
                <textarea
                  rows={2}
                  value={inviteNote}
                  onChange={e => setInviteNote(e.target.value)}
                  placeholder="Hi Jane, welcome to your CPA Client Portal where you can access your tax returns..."
                  className="w-full px-3.5 py-2.5 border border-muted-gray/30 dark:border-navy-light rounded-xl text-sm outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand resize-none"
                />
              </div>

              {inviteFeedback && (
                <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                  inviteFeedback.type === 'error'
                    ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200'
                    : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                }`}>
                  {inviteFeedback.type === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <Check className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />}
                  <span>{inviteFeedback.message}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2.5 border border-muted-gray/30 dark:border-navy-light rounded-xl text-xs font-semibold text-navy dark:text-sand hover:bg-sand-light dark:hover:bg-navy-card transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingInvite}
                  className="bg-navy dark:bg-gold text-sand dark:text-navy-dark px-5 py-2.5 rounded-xl text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isSendingInvite ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-gold dark:text-navy-dark" />
                      <span>Sending Invite via Gmail...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Invite & Create Client</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
