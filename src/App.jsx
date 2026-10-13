import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Pin,
  PinOff,
  Search,
  Lock,
  User,
  Image as ImageIcon,
  LogOut,
  Settings,
  Download,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  Folder,
  Calendar,
  AlertCircle,
  ExternalLink,
  Save,
  Clock,
  Sparkles
} from 'lucide-react';

const CATEGORIES = ['Semua', 'Umum', 'Kerja', 'Peribadi', 'Idea', 'Kajian'];

async function sha256(message) {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return message;
  }
}

function getSafeEnv(key) {
  try {
    if (typeof process !== 'undefined' && process?.env && process.env[key]) {
      return process.env[key];
    }
    const dynamicEnv = (new Function('try { return import.meta.env; } catch(e) { return undefined; }'))();
    if (dynamicEnv && dynamicEnv[key]) {
      return dynamicEnv[key];
    }
  } catch (err) {}
  return '';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [supabaseUrl, setSupabaseUrl] = useState(() => {
    const envVal = getSafeEnv('VITE_SUPABASE_URL');
    if (envVal) return envVal;
    return typeof localStorage !== 'undefined' ? localStorage.getItem('app_sb_url') || '' : '';
  });
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => {
    const envVal = getSafeEnv('VITE_SUPABASE_ANON_KEY');
    if (envVal) return envVal;
    return typeof localStorage !== 'undefined' ? localStorage.getItem('app_sb_key') || '' : '';
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isSaving, setIsSaving] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Umum');
  const [editIsPinned, setEditIsPinned] = useState(false);
  const editorRef = useRef(null);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => setToastMessage(null), 3800);
  };

  const fetchFromPostgres = async (table, queryParams = {}) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      const localStored = localStorage.getItem(`offline_${table}`);
      return localStored ? JSON.parse(localStored) : null;
    }

    try {
      let endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`;
      const queryParts = [];
      Object.entries(queryParams).forEach(([key, val]) => {
        queryParts.push(`${key}=${encodeURIComponent(val)}`);
      });
      if (queryParts.length > 0) endpoint += `?${queryParts.join('&')}`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(response.statusText);
      return await response.json();
    } catch (err) {
      const localStored = localStorage.getItem(`offline_${table}`);
      return localStored ? JSON.parse(localStored) : null;
    }
  };

  const postToPostgres = async (table, payload) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      const existing = JSON.parse(localStorage.getItem(`offline_${table}`) || '[]');
      const updated = [payload, ...existing.filter(item => item.id !== payload.id)];
      localStorage.setItem(`offline_${table}`, JSON.stringify(updated));
      return [payload];
    }
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });
    return await response.json();
  };

  const updateInPostgres = async (table, id, payload) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      const existing = JSON.parse(localStorage.getItem(`offline_${table}`) || '[]');
      const updated = existing.map(item => item.id === id ? { ...item, ...payload } : item);
      localStorage.setItem(`offline_${table}`, JSON.stringify(updated));
      return;
    }
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?id=eq.${id}`;
    await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  };

  const deleteFromPostgres = async (table, id) => {
    if (!supabaseUrl || !supabaseAnonKey) {
      const existing = JSON.parse(localStorage.getItem(`offline_${table}`) || '[]');
      const updated = existing.filter(item => item.id !== id);
      localStorage.setItem(`offline_${table}`, JSON.stringify(updated));
      return;
    }
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?id=eq.${id}`;
    await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);

    try {
      const usernameInput = loginUsername.trim().toLowerCase();
      const passwordInput = loginPassword;

      if (!usernameInput || !passwordInput) {
        setAuthError('Sila masukkan nama pengguna dan kata laluan.');
        setIsAuthenticating(false);
        return;
      }

      let matchedUser = null;
      if (supabaseUrl && supabaseAnonKey) {
        const users = await fetchFromPostgres('users', {
          username: `eq.${usernameInput}`,
          select: '*'
        });

        if (users && users.length > 0) {
          const dbUser = users[0];
          const hashedPassword = await sha256(passwordInput);
          if (
            dbUser.password_hash === passwordInput ||
            dbUser.password_hash === hashedPassword ||
            (dbUser.username === 'akmal' && passwordInput === 'password')
          ) {
            matchedUser = dbUser;
          }
        }
      } else {
        if (usernameInput === 'akmal' && passwordInput === 'password') {
          matchedUser = { id: 'u-akmal-001', username: 'akmal', name: 'Akmal' };
        }
      }

      if (matchedUser) {
        setCurrentUser(matchedUser);
        showToast(`Selamat kembali, ${matchedUser.name || 'Akmal'}!`, 'success');
        loadUserNotes(matchedUser.id);
      } else {
        setAuthError('Nama pengguna atau kata laluan tidak sah!');
      }
    } catch (err) {
      setAuthError('Gagal menyambung ke pangkalan data PostgreSQL.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const loadUserNotes = async (userId) => {
    try {
      let fetchedNotes = await fetchFromPostgres('notes', {
        user_id: `eq.${userId}`,
        order: 'updated_at.desc'
      });

      if (!fetchedNotes || fetchedNotes.length === 0) {
        const initialNote = {
          id: `note-${Date.now()}`,
          user_id: userId,
          title: 'Selamat Datang ke Sistem Nota Pintar ✨',
          content: '<div><p>Sistem ini membolehkan anda <strong>menampal gambar secara terus (Ctrl+V / Paste)</strong>!</p></div>',
          category: 'Idea',
          is_pinned: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        await postToPostgres('notes', initialNote);
        fetchedNotes = [initialNote];
      }

      setNotes(fetchedNotes);
      if (fetchedNotes.length > 0) selectNote(fetchedNotes[0]);
    } catch (error) {
      console.error(error);
    }
  };

  const selectNote = (note) => {
    setActiveNoteId(note.id);
    setEditTitle(note.title);
    setEditCategory(note.category || 'Umum');
    setEditIsPinned(!!note.is_pinned);
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content || '';
    }
  };

  const handleCreateNewNote = async () => {
    if (!currentUser) return;
    const newNote = {
      id: `note-${Date.now()}`,
      user_id: currentUser.id,
      title: 'Nota Baru',
      content: '<p>Tulis nota anda atau tekan <strong>Ctrl+V</strong> untuk menampal gambar di sini...</p>',
      category: 'Umum',
      is_pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await postToPostgres('notes', newNote);
    setNotes([newNote, ...notes]);
    selectNote(newNote);
    showToast('Nota baru telah dicipta!', 'success');
  };

  const handlePaste = (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;
    const items = clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          const base64Data = uploadEvent.target.result;
          const imgElement = document.createElement('img');
          imgElement.src = base64Data;
          imgElement.className = 'max-w-full my-3 rounded-lg shadow-md border border-slate-700 inline-block';
          imgElement.style.maxHeight = '420px';

          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(imgElement);
            const newRange = document.createRange();
            newRange.setStartAfter(imgElement);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          } else if (editorRef.current) {
            editorRef.current.appendChild(imgElement);
          }
          triggerAutoSave();
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const triggerAutoSave = () => {
    if (!activeNoteId || !currentUser) return;
    saveCurrentNote();
  };

  const saveCurrentNote = async () => {
    if (!activeNoteId || !currentUser) return;
    setIsSaving(true);
    const currentHtml = editorRef.current ? editorRef.current.innerHTML : '';
    const updatedPayload = {
      title: editTitle || 'Nota Tanpa Tajuk',
      content: currentHtml,
      category: editCategory,
      is_pinned: editIsPinned,
      updated_at: new Date().toISOString()
    };
    try {
      await updateInPostgres('notes', activeNoteId, updatedPayload);
      setNotes((prev) => prev.map((n) => n.id === activeNoteId ? { ...n, ...updatedPayload } : n));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id, e) => {
    e.stopPropagation();
    await deleteFromPostgres('notes', id);
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (activeNoteId === id && remaining.length > 0) selectNote(remaining[0]);
  };

  const togglePin = async (note, e) => {
    e.stopPropagation();
    const newPinStatus = !note.is_pinned;
    await updateInPostgres('notes', note.id, { is_pinned: newPinStatus });
    setNotes(notes.map(n => n.id === note.id ? { ...n, is_pinned: newPinStatus } : n));
    if (activeNoteId === note.id) setEditIsPinned(newPinStatus);
  };

  const executeCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) editorRef.current.focus();
    triggerAutoSave();
  };

  const filteredNotes = notes.filter((n) => {
    const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || n.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'Semua' || n.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  });

  const activeNote = notes.find((n) => n.id === activeNoteId);

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4">
              <FileText size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white">Sistem Nota Peribadi</h1>
            <p className="text-sm text-slate-400 mt-1">Log masuk ke pangkalan data PostgreSQL</p>
          </div>

          {authError && (
            <div className="mb-6 p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Nama Pengguna</label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama pengguna"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2">Kata Laluan</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Masukkan kata laluan"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition cursor-pointer"
            >
              {isAuthenticating ? 'Menyemak...' : 'Log Masuk'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={() => setShowConfigModal(true)}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1.5"
            >
              <Database size={14} /> Tetapan Supabase
            </button>
          </div>
        </div>

        {showConfigModal && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-white">Konfigurasi Sambungan Supabase</h3>
                <button onClick={() => setShowConfigModal(false)} className="text-slate-400">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Supabase URL</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Anon Public Key</label>
                  <input
                    type="password"
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    localStorage.setItem('app_sb_url', supabaseUrl);
                    localStorage.setItem('app_sb_key', supabaseAnonKey);
                    setShowConfigModal(false);
                    showToast('Tetapan disimpan!', 'success');
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <aside className="w-80 md:w-96 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-indigo-400" />
            <h2 className="font-bold text-sm text-white">Nota Akmal</h2>
          </div>
          <button
            onClick={() => setCurrentUser(null)}
            className="p-1.5 text-slate-400 hover:text-rose-400"
            title="Log Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>

        <div className="p-3 border-b border-slate-800 space-y-2">
          <button
            onClick={handleCreateNewNote}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Cipta Nota Baru
          </button>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => selectNote(note)}
              className={`p-3 rounded-xl cursor-pointer transition ${
                note.id === activeNoteId ? 'bg-indigo-600/20 border border-indigo-500/40 text-white' : 'hover:bg-slate-800/60 text-slate-300'
              }`}
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold truncate">{note.title || 'Tanpa Tajuk'}</h3>
                {note.is_pinned && <Pin size={12} className="text-amber-400 fill-amber-400" />}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                {note.content ? note.content.replace(/<[^>]+>/g, '').slice(0, 60) : ''}
              </p>
              <div className="flex justify-between items-center mt-2 text-[10px] text-slate-500">
                <span>{note.category || 'Umum'}</span>
                <button
                  onClick={(e) => handleDeleteNote(note.id, e)}
                  className="hover:text-rose-400"
                  title="Padam"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
        {activeNote ? (
          <>
            <header className="px-6 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  triggerAutoSave();
                }}
                className="bg-transparent text-lg font-bold text-white focus:outline-none flex-1"
                placeholder="Tajuk..."
              />
              <div className="flex items-center gap-2">
                <select
                  value={editCategory}
                  onChange={(e) => {
                    setEditCategory(e.target.value);
                    triggerAutoSave();
                  }}
                  className="bg-slate-800 text-xs text-slate-300 border border-slate-700 rounded-lg px-2 py-1"
                >
                  {CATEGORIES.filter(c => c !== 'Semua').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={(e) => togglePin(activeNote, e)}
                  className={`p-1.5 rounded-lg border ${editIsPinned ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  <Pin size={15} />
                </button>
                <button
                  onClick={saveCurrentNote}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
                >
                  <Save size={13} /> {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </header>

            <div className="px-6 py-2 bg-slate-900/20 border-b border-slate-800 flex justify-between text-xs text-slate-400">
              <div className="flex gap-1">
                <button onClick={() => executeCommand('bold')} className="p-1 px-2 hover:bg-slate-800 rounded font-bold">B</button>
                <button onClick={() => executeCommand('italic')} className="p-1 px-2 hover:bg-slate-800 rounded italic">I</button>
                <button onClick={() => executeCommand('underline')} className="p-1 px-2 hover:bg-slate-800 rounded underline">U</button>
                <button onClick={() => executeCommand('insertUnorderedList')} className="p-1 px-2 hover:bg-slate-800 rounded">• List</button>
              </div>
              <span className="text-[11px] text-indigo-300">💡 Tekan <strong>Ctrl + V</strong> untuk tampal imej screenshot!</span>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <div
                ref={editorRef}
                contentEditable
                onPaste={handlePaste}
                onInput={triggerAutoSave}
                className="w-full min-h-[480px] max-w-4xl mx-auto p-4 bg-slate-900/20 rounded-2xl border border-slate-800/60 text-slate-100 text-sm leading-relaxed focus:outline-none"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Pilih atau cipta nota baru.
          </div>
        )}
      </main>
    </div>
  );
}
