import React, { useEffect, useState } from 'react';
import { UserProfile, TaxReturn, PendingItem } from '../types';
import { db, logout } from '../lib/firebase';
import { useTheme } from '../lib/theme';
import { CPALogo } from './CPALogo';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { FileText, Download, CheckCircle2, Circle, AlertCircle, LogOut, Clock, CalendarDays, Loader2, Link as LinkIcon, Edit2, ExternalLink, X, Send, Sun, Moon, User, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardProps {
  userProfile: UserProfile;
}

export default function Dashboard({ userProfile }: DashboardProps) {
  const { theme, toggleTheme } = useTheme();
  const [taxReturns, setTaxReturns] = useState<TaxReturn[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Active reply form state per item ID
  const [replyingItemId, setReplyingItemId] = useState<string | null>(null);
  const [replyUrl, setReplyUrl] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Client Profile Edit state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const returnsQuery = query(
      collection(db, 'taxReturns'),
      where('userId', '==', userProfile.uid),
    );

    const itemsQuery = query(
      collection(db, 'pendingItems'),
      where('userId', '==', userProfile.uid),
    );

    const unsubscribeReturns = onSnapshot(returnsQuery, (snapshot) => {
      const returnsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaxReturn));
      returnsData.sort((a, b) => b.taxYear - a.taxYear);
      setTaxReturns(returnsData);
    }, (error) => {
      console.warn('Error listening to tax returns:', error);
    });

    const unsubscribeItems = onSnapshot(itemsQuery, (snapshot) => {
      const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingItem));
      itemsData.sort((a, b) => a.deadline - b.deadline);
      setPendingItems(itemsData);
      setLoading(false);
    }, (error) => {
      console.warn('Error listening to pending items:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeReturns();
      unsubscribeItems();
    };
  }, [userProfile.uid]);

  const handleToggleComplete = async (item: PendingItem) => {
    try {
      const newStatus = item.status === 'completed' ? 'pending' : 'completed';
      await updateDoc(doc(db, 'pendingItems', item.id), {
        status: newStatus
      });
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleOpenReplyForm = (item: PendingItem) => {
    setReplyingItemId(item.id);
    setReplyUrl(item.replyUrl || '');
    setClientNote(item.clientNote || '');
  };

  const handleSaveReply = async (itemId: string) => {
    if (!replyUrl.trim()) return;
    setIsSubmittingReply(true);
    try {
      await updateDoc(doc(db, 'pendingItems', itemId), {
        replyUrl: replyUrl.trim(),
        clientNote: clientNote.trim(),
        status: 'completed' // auto mark completed when submitting reply
      });
      setReplyingItemId(null);
      setReplyUrl('');
      setClientNote('');
    } catch (error) {
      console.error('Error saving reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const openProfileModal = () => {
    setNewName(userProfile.displayName || '');
    setNewLogoUrl(userProfile.clientLogoUrl || '');
    setIsEditingProfile(true);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        setNewLogoUrl(dataUrl);
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!newName.trim()) return;
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', userProfile.uid);
      await updateDoc(userRef, {
        displayName: newName.trim(),
        clientLogoUrl: newLogoUrl.trim() || '',
      });
      setIsEditingProfile(false);
    } catch (err) {
      console.error('Error updating client profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const pendingCount = pendingItems.filter(item => item.status === 'pending').length;

  return (
    <div className="min-h-screen bg-sand dark:bg-navy-dark font-sans text-navy dark:text-sand transition-colors duration-200">
      <header className="bg-navy dark:bg-navy-dark text-sand border-b border-navy-light dark:border-navy-light/60 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <CPALogo size="sm" />
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={openProfileModal}
            className="flex items-center gap-2.5 hidden sm:flex text-right hover:opacity-90 transition-opacity"
            title="Click to edit client profile & logo"
          >
            {userProfile.clientLogoUrl ? (
              <img
                src={userProfile.clientLogoUrl}
                alt={userProfile.displayName}
                className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-navy-card p-0.5 border border-gold/40 shadow-xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-navy-light text-gold flex items-center justify-center font-bold text-xs border border-gold/30">
                {userProfile.displayName?.charAt(0) || 'C'}
              </div>
            )}
            <div className="text-left">
              <span className="text-sm font-semibold text-sand flex items-center gap-1">
                {userProfile.displayName}
                <Edit2 className="w-3 h-3 text-gold" />
              </span>
              <span className="text-[11px] text-sand/70 block">{userProfile.email}</span>
            </div>
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 text-sand/70 hover:text-sand rounded-full transition-colors"
            title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-gold" /> : <Moon className="w-5 h-5 text-sand" />}
          </button>
          <div className="w-px h-6 bg-navy-light hidden sm:block"></div>
          <button
            onClick={logout}
            className="p-2 text-sand/70 hover:text-sand hover:bg-navy-light rounded-full transition-colors flex items-center gap-2"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-navy p-6 rounded-2xl border border-muted-gray/20 dark:border-navy-light shadow-sm">
          <div className="flex items-start sm:items-center gap-4">
            {userProfile.clientLogoUrl ? (
              <img
                src={userProfile.clientLogoUrl}
                alt={userProfile.displayName}
                className="w-14 h-14 rounded-2xl object-contain bg-sand-light dark:bg-navy-card p-1.5 border border-gold/40 shadow-xs flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gold-light dark:bg-navy-card text-gold flex items-center justify-center font-bold text-xl border border-gold/30 flex-shrink-0">
                {userProfile.displayName?.charAt(0) || 'C'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-navy dark:text-sand">
                  Welcome, {userProfile.displayName}
                </h1>
                <button
                  onClick={openProfileModal}
                  className="p-1.5 text-muted-gray hover:text-gold hover:bg-sand-light dark:hover:bg-navy-card rounded-lg transition-colors"
                  title="Edit Client Name & Upload Logo"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-gray dark:text-slate-300 mt-1 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                Active Engagement • Account: <span className="font-medium text-navy dark:text-sand">{userProfile.email}</span>
              </p>
            </div>
          </div>
          <div>
            <button
              onClick={openProfileModal}
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 bg-sand dark:bg-navy-card text-navy dark:text-sand hover:bg-gold-light dark:hover:bg-navy-card/80 border border-muted-gray/20 dark:border-navy-light rounded-xl transition-colors shadow-sm"
            >
              <Upload className="w-3.5 h-3.5 text-gold" />
              Upload Logo / Edit Name
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gold animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Action Items & Status */}
            <div className="lg:col-span-1 space-y-8">
              
              <section className="bg-white dark:bg-navy rounded-2xl shadow-sm border border-muted-gray/20 dark:border-navy-light overflow-hidden">
                <div className="px-6 py-4 border-b border-muted-gray/20 dark:border-navy-light bg-sand-light dark:bg-navy-card flex justify-between items-center">
                  <h2 className="font-semibold text-navy dark:text-sand flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-gold" />
                    Pending Items
                  </h2>
                  {pendingCount > 0 && (
                    <span className="bg-gold/20 text-gold-hover dark:text-gold text-xs font-semibold px-2.5 py-0.5 rounded-full border border-gold/30">
                      {pendingCount}
                    </span>
                  )}
                </div>
                
                <div className="p-0">
                  {pendingItems.length === 0 ? (
                    <div className="p-8 text-center text-muted-gray dark:text-slate-300">
                      <CheckCircle2 className="w-10 h-10 text-muted-gray/40 mx-auto mb-3" />
                      <p className="text-sm">You're all caught up.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-muted-gray/15 dark:divide-navy-light/40">
                      {pendingItems.map((item) => {
                        const isReplying = replyingItemId === item.id;
                        return (
                          <li key={item.id} className={`p-5 transition-colors ${item.status === 'completed' ? 'bg-sand-light/50 dark:bg-navy-card/40' : 'bg-white dark:bg-navy hover:bg-sand-light/60 dark:hover:bg-navy-card/60'}`}>
                            <div className="flex gap-4 items-start">
                              <button 
                                onClick={() => handleToggleComplete(item)}
                                className={`mt-0.5 flex-shrink-0 transition-colors ${item.status === 'completed' ? 'text-emerald-500 hover:text-emerald-600' : 'text-muted-gray/50 hover:text-gold'}`}
                                title={item.status === 'completed' ? "Mark as pending" : "Mark as completed"}
                              >
                                {item.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <p className={`text-sm font-medium ${item.status === 'completed' ? 'text-muted-gray dark:text-slate-400 line-through' : 'text-navy dark:text-sand'}`}>
                                    {item.title}
                                  </p>
                                </div>
                                {item.description && (
                                  <p className="text-xs text-muted-gray dark:text-slate-300 mt-1">
                                    {item.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 text-xs font-medium">
                                  <Clock className={`w-3.5 h-3.5 ${item.status === 'pending' && item.deadline < Date.now() ? 'text-red-500' : 'text-muted-gray'}`} />
                                  <span className={`${item.status === 'pending' && item.deadline < Date.now() ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-gray dark:text-slate-400'}`}>
                                    Due: {format(item.deadline, 'MMM d, yyyy')}
                                  </span>
                                </div>

                                {/* Display Existing Reply Link if Present */}
                                {item.replyUrl && !isReplying && (
                                  <div className="mt-3 p-3 bg-gold-light dark:bg-navy-card/80 rounded-xl border border-gold/30 dark:border-navy-light text-xs text-navy dark:text-sand space-y-1">
                                    <div className="font-semibold flex items-center justify-between">
                                      <span className="flex items-center gap-1.5 text-gold-hover dark:text-gold">
                                        <LinkIcon className="w-3.5 h-3.5" />
                                        Uploaded File / Link:
                                      </span>
                                      <button 
                                        onClick={() => handleOpenReplyForm(item)}
                                        className="text-gold-hover dark:text-gold hover:underline flex items-center gap-0.5 text-[11px]"
                                      >
                                        <Edit2 className="w-3 h-3" /> Edit
                                      </button>
                                    </div>
                                    <a 
                                      href={item.replyUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-navy dark:text-gold font-medium underline truncate block hover:text-gold-hover flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{item.replyUrl}</span>
                                    </a>
                                    {item.clientNote && (
                                      <p className="text-muted-gray dark:text-slate-300 italic mt-1">
                                        "{item.clientNote}"
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Action button to add reply */}
                                {!item.replyUrl && !isReplying && (
                                  <button
                                    onClick={() => handleOpenReplyForm(item)}
                                    className="mt-3 text-xs text-navy dark:text-gold font-medium hover:bg-gold-light dark:hover:bg-navy-card flex items-center gap-1.5 bg-sand dark:bg-navy-card/60 px-3 py-1.5 rounded-lg border border-muted-gray/20 dark:border-navy-light transition-colors"
                                  >
                                    <LinkIcon className="w-3.5 h-3.5 text-gold" />
                                    Provide File Link / Reply
                                  </button>
                                )}

                                {/* Inline Reply Form */}
                                {isReplying && (
                                  <div className="mt-3 p-3.5 bg-sand-light dark:bg-navy-card border border-muted-gray/30 dark:border-navy-light rounded-xl space-y-3">
                                    <div className="flex justify-between items-center text-xs font-semibold text-navy dark:text-sand">
                                      <span>Provide Document / Reply</span>
                                      <button 
                                        onClick={() => setReplyingItemId(null)}
                                        className="text-muted-gray hover:text-navy dark:hover:text-sand"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-medium text-muted-gray dark:text-slate-300 mb-1">
                                        File Link / Cloud Storage URL *
                                      </label>
                                      <input
                                        type="url"
                                        required
                                        placeholder="https://drive.google.com/... or dropbox link"
                                        value={replyUrl}
                                        onChange={(e) => setReplyUrl(e.target.value)}
                                        className="w-full text-xs px-2.5 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-medium text-muted-gray dark:text-slate-300 mb-1">
                                        Note for CPA (Optional)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g., Here are my W2 forms..."
                                        value={clientNote}
                                        onChange={(e) => setClientNote(e.target.value)}
                                        className="w-full text-xs px-2.5 py-2 border border-muted-gray/30 dark:border-navy-light rounded-lg outline-none focus:border-gold bg-white dark:bg-navy-dark text-navy dark:text-sand"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => setReplyingItemId(null)}
                                        className="px-2.5 py-1.5 text-xs text-muted-gray hover:text-navy dark:hover:text-sand rounded-md"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={!replyUrl.trim() || isSubmittingReply}
                                        onClick={() => handleSaveReply(item.id)}
                                        className="px-3 py-1.5 text-xs bg-gold hover:bg-gold-hover text-white rounded-md font-medium flex items-center gap-1 disabled:opacity-50 shadow-sm"
                                      >
                                        <Send className="w-3 h-3" />
                                        Submit Reply
                                      </button>
                                    </div>
                                  </div>
                                )}

                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>

            </div>

            {/* Right Column: Tax Returns & Documents */}
            <div className="lg:col-span-2 space-y-8">
              
              <section className="bg-white dark:bg-navy rounded-2xl shadow-sm border border-muted-gray/20 dark:border-navy-light overflow-hidden">
                <div className="px-6 py-4 border-b border-muted-gray/20 dark:border-navy-light bg-sand-light dark:bg-navy-card">
                  <h2 className="font-semibold text-navy dark:text-sand flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gold" />
                    Filed Tax Returns
                  </h2>
                </div>

                <div className="p-6">
                  {taxReturns.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-muted-gray/20 dark:border-navy-light rounded-xl">
                      <FileText className="w-12 h-12 text-muted-gray/40 mx-auto mb-3" />
                      <h3 className="text-navy dark:text-sand font-medium mb-1">No returns available yet</h3>
                      <p className="text-muted-gray dark:text-slate-300 text-sm">Your filed returns will appear here for download.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {taxReturns.map((tax) => (
                        <div key={tax.id} className="group border border-muted-gray/20 dark:border-navy-light rounded-xl p-5 hover:border-gold dark:hover:border-gold transition-all bg-white dark:bg-navy-card/60 shadow-sm">
                          <div className="flex items-start justify-between mb-4">
                            <div className="p-2.5 bg-gold-light dark:bg-gold/20 text-gold rounded-lg border border-gold/20">
                              <FileText className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-semibold bg-sand dark:bg-navy text-navy dark:text-gold px-2.5 py-1 rounded-md border border-muted-gray/20 dark:border-navy-light">
                              Tax Year {tax.taxYear}
                            </span>
                          </div>
                          
                          <h3 className="font-bold text-navy dark:text-sand mb-1 line-clamp-1" title={tax.title}>
                            {tax.title}
                          </h3>
                          <div className="space-y-1 text-xs text-muted-gray dark:text-slate-300 mb-5">
                            <div className="flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5 text-gold" />
                              <span>Filed: {format(tax.dateFiled, 'MMM d, yyyy')}</span>
                            </div>
                            {tax.dateUploaded && (
                              <div className="flex items-center gap-1.5 text-muted-gray/80 dark:text-slate-400">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Uploaded: {format(tax.dateUploaded, 'MMM d, yyyy')}</span>
                              </div>
                            )}
                          </div>
                          
                          <a 
                            href={tax.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-sand hover:bg-gold hover:text-white dark:bg-navy-dark dark:hover:bg-gold dark:hover:text-navy-dark text-navy dark:text-sand py-2.5 rounded-lg text-sm font-medium border border-muted-gray/20 dark:border-navy-light transition-all shadow-sm"
                          >
                            <Download className="w-4 h-4 text-gold group-hover:text-white dark:group-hover:text-navy-dark" />
                            Download PDF
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

            </div>
          </div>
        )}
      </main>

      {/* Edit Client Profile & Logo Modal */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 bg-navy/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy border border-muted-gray/20 dark:border-navy-light rounded-2xl p-6 max-w-md w-full shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-navy dark:text-sand flex items-center gap-2">
                <User className="w-5 h-5 text-gold" />
                Edit Client Profile & Logo
              </h3>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="text-muted-gray hover:text-navy dark:hover:text-sand p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-muted-gray dark:text-slate-300">
              Update how your client / business name and brand logo are displayed across your portal and in Jan Michael Maglinao, CPA's admin dashboard.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-navy dark:text-sand mb-1.5">
                  Client / Business Name
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

              <div>
                <label className="block text-xs font-semibold text-navy dark:text-sand mb-1.5">
                  Client Logo
                </label>
                
                {newLogoUrl ? (
                  <div className="flex items-center gap-4 p-3 bg-sand-light dark:bg-navy-card rounded-xl border border-muted-gray/20 dark:border-navy-light">
                    <img
                      src={newLogoUrl}
                      alt="Logo Preview"
                      className="w-14 h-14 rounded-xl object-contain bg-white dark:bg-navy p-1 border border-gold/40 shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-navy dark:text-sand">Logo Active</p>
                      <p className="text-[11px] text-muted-gray dark:text-slate-400">Reflected in client & admin dashboards</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewLogoUrl('')}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                      title="Remove Logo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-muted-gray/30 dark:border-navy-light hover:border-gold dark:hover:border-gold rounded-xl cursor-pointer bg-sand-light/50 dark:bg-navy-dark/50 transition-colors group">
                      <Upload className="w-6 h-6 text-muted-gray group-hover:text-gold mb-1" />
                      <span className="text-xs font-semibold text-navy dark:text-sand group-hover:text-gold">
                        Upload Logo Image
                      </span>
                      <span className="text-[10px] text-muted-gray dark:text-slate-400 mt-0.5">
                        PNG, JPG, SVG up to 5MB
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoFileUpload}
                        className="hidden"
                      />
                    </label>

                    <div className="relative flex items-center justify-center">
                      <div className="border-t border-muted-gray/20 dark:border-navy-light w-full"></div>
                      <span className="bg-white dark:bg-navy px-2 text-[10px] uppercase font-semibold text-muted-gray tracking-wider absolute">or URL</span>
                    </div>

                    <div className="relative">
                      <ImageIcon className="w-4 h-4 text-muted-gray absolute left-3 top-3" />
                      <input
                        type="url"
                        value={newLogoUrl}
                        onChange={(e) => setNewLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="w-full pl-9 pr-3.5 py-2 border border-muted-gray/30 dark:border-navy-light rounded-xl text-xs outline-none focus:border-gold bg-sand-light dark:bg-navy-dark text-navy dark:text-sand"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-muted-gray/15 dark:border-navy-light">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2.5 text-xs font-semibold text-muted-gray hover:text-navy dark:hover:text-sand rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newName.trim() || isSavingProfile}
                onClick={handleSaveProfile}
                className="px-5 py-2.5 text-xs font-semibold bg-gold hover:bg-gold-hover text-white rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-all"
              >
                {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

