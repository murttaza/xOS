import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { PasswordEntry } from '../types';
import { cn } from '../lib/utils';
import { isElectron } from '../lib/platform';
import {
    Shield, Search, Plus, Pin, PinOff, Copy, Eye, EyeOff, Trash2,
    ExternalLink, KeyRound, User, Link as LinkIcon, StickyNote, RefreshCw,
    Pencil, Check
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { ModeHeader } from './ModeHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

// ── Password generator ─────────────────────────────────────────
const GEN_SETS = {
    lower: 'abcdefghijklmnopqrstuvwxyz',
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
};

function generatePassword(len = 20, opts = { upper: true, digits: true, symbols: true }) {
    let alphabet = GEN_SETS.lower;
    if (opts.upper) alphabet += GEN_SETS.upper;
    if (opts.digits) alphabet += GEN_SETS.digits;
    if (opts.symbols) alphabet += GEN_SETS.symbols;
    const out = new Array(len);
    const buf = new Uint32Array(len);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(buf);
    } else {
        for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 0xffffffff);
    }
    for (let i = 0; i < len; i++) out[i] = alphabet[buf[i] % alphabet.length];
    return out.join('');
}

function strength(pw: string): { label: string; score: number; color: string } {
    if (!pw) return { label: '—', score: 0, color: 'bg-muted' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { label: 'Weak', score, color: 'bg-red-500' };
    if (score <= 4) return { label: 'Okay', score, color: 'bg-yellow-500' };
    if (score <= 5) return { label: 'Strong', score, color: 'bg-emerald-500' };
    return { label: 'Excellent', score, color: 'bg-emerald-400' };
}

function faviconUrl(urlStr?: string) {
    if (!urlStr) return null;
    try {
        const u = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch {
        return null;
    }
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() || '')
        .join('') || '?';
}

// ── Main component ─────────────────────────────────────────────
export function PasswordsMode() {
    const isPasswordsMode = useStore(s => s.isPasswordsMode);
    const togglePasswordsMode = useStore(s => s.togglePasswordsMode);
    const passwords = useStore(s => s.passwords);
    const fetchPasswords = useStore(s => s.fetchPasswords);
    const createPassword = useStore(s => s.createPassword);
    const updatePassword = useStore(s => s.updatePassword);
    const deletePassword = useStore(s => s.deletePassword);
    const revealPassword = useStore(s => s.revealPassword);
    const touchPassword = useStore(s => s.touchPassword);
    const togglePinPassword = useStore(s => s.togglePinPassword);

    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<PasswordEntry | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [revealed, setRevealed] = useState<Record<number, string>>({});

    useEffect(() => {
        if (isPasswordsMode) fetchPasswords();
    }, [isPasswordsMode, fetchPasswords]);

    // Esc closes mode
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!isPasswordsMode) return;
            if (e.key === 'Escape') {
                // Don't close if dialog is open; dialog handles it
                if (!editorOpen) togglePasswordsMode();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isPasswordsMode, togglePasswordsMode, editorOpen]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return passwords;
        return passwords.filter(p =>
            p.name.toLowerCase().includes(q) ||
            (p.username || '').toLowerCase().includes(q) ||
            (p.url || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q)
        );
    }, [passwords, query]);

    const pinned = filtered.filter(p => p.isPinned);
    const others = filtered.filter(p => !p.isPinned);

    const selected = useMemo(
        () => passwords.find(p => p.id === selectedId) || null,
        [passwords, selectedId]
    );

    // Auto-select first when nothing selected
    useEffect(() => {
        if (selectedId === null && passwords.length > 0) {
            setSelectedId(passwords[0].id ?? null);
        }
        if (selectedId !== null && !passwords.some(p => p.id === selectedId)) {
            setSelectedId(passwords[0]?.id ?? null);
        }
    }, [passwords, selectedId]);

    const flash = (key: string) => {
        setCopiedId(key);
        setTimeout(() => setCopiedId(k => (k === key ? null : k)), 1200);
    };

    const copyText = async (text: string, flashKey: string) => {
        try {
            await navigator.clipboard.writeText(text);
            flash(flashKey);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const handleCopyPassword = async (p: PasswordEntry) => {
        if (!p.id) return;
        const pt = await revealPassword(p.id);
        if (pt) {
            await copyText(pt, `pw-${p.id}`);
            touchPassword(p.id);
            // Auto-clear clipboard after 30s (best-effort)
            setTimeout(() => {
                navigator.clipboard.readText().then(c => {
                    if (c === pt) navigator.clipboard.writeText('').catch(() => {});
                }).catch(() => {});
            }, 30000);
        }
    };

    const handleCopyUsername = async (p: PasswordEntry) => {
        if (!p.id) return;
        await copyText(p.username || '', `un-${p.id}`);
    };

    const handleTogglePin = async (p: PasswordEntry) => {
        if (!p.id) return;
        await togglePinPassword(p.id, p.isPinned ? 0 : 1);
    };

    const handleReveal = async (p: PasswordEntry) => {
        if (!p.id) return;
        const pid = p.id;
        if (revealed[pid]) {
            setRevealed(r => {
                const next: Record<number, string> = {};
                for (const k of Object.keys(r)) {
                    const nk = Number(k);
                    if (nk !== pid) next[nk] = r[nk];
                }
                return next;
            });
            return;
        }
        const pt = await revealPassword(pid);
        setRevealed(r => ({ ...r, [pid]: pt }));
    };

    const openCreate = () => {
        setEditingEntry({
            name: '',
            username: '',
            url: '',
            notes: '',
            category: '',
            isPinned: 0,
        });
        setEditorOpen(true);
    };

    const openEdit = (p: PasswordEntry) => {
        setEditingEntry({ ...p });
        setEditorOpen(true);
    };

    const handleDelete = async (p: PasswordEntry) => {
        if (!p.id) return;
        if (confirm(`Delete "${p.name}"? This can't be undone.`)) {
            await deletePassword(p.id);
        }
    };

    const openUrl = (url?: string) => {
        if (!url) return;
        const href = url.startsWith('http') ? url : `https://${url}`;
        window.open(href, '_blank', 'noopener,noreferrer');
    };

    if (!isPasswordsMode) return null;

    if (!isElectron) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[55] bg-background flex items-center justify-center no-drag"
                >
                    <div className="text-center space-y-3 max-w-sm px-6">
                        <Shield className="h-10 w-10 mx-auto text-primary/60" />
                        <h2 className="text-lg font-semibold">Desktop only</h2>
                        <p className="text-sm text-muted-foreground">
                            Passwords mode lives on your device. Open the desktop app to use it.
                        </p>
                        <Button variant="outline" onClick={togglePasswordsMode}>Close</Button>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={cn(
                    "fixed inset-0 z-[55] text-foreground overflow-hidden flex flex-col font-sans no-drag",
                    "bg-background"
                )}
            >
                <ModeHeader
                    modeLabel="Passwords"
                    modeIcon={Shield}
                    onGoHome={togglePasswordsMode}
                    showMobileBack
                    onMobileBack={togglePasswordsMode}
                    rightContent={
                        <Button
                            size="sm"
                            onClick={openCreate}
                            className="h-8 gap-1.5"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New
                        </Button>
                    }
                />

                {/* Body */}
                <div className="flex-1 overflow-hidden px-3 sm:px-4 lg:px-6 pb-4 pt-1">
                    <div className="h-full max-w-screen-2xl mx-auto grid grid-cols-12 gap-3 lg:gap-5">
                        {/* Left: List */}
                        <div className="col-span-12 lg:col-span-5 xl:col-span-4 glass-card rounded-2xl overflow-hidden flex flex-col">
                            <div className="p-3 border-b border-border/40">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        autoFocus
                                        placeholder="Search accounts..."
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        className="h-9 pl-9 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-4">
                                {passwords.length === 0 ? (
                                    <EmptyState onCreate={openCreate} />
                                ) : (
                                    <>
                                        {pinned.length > 0 && (
                                            <Section title="Pinned" icon={<Pin className="h-3 w-3" />}>
                                                {pinned.map(p => (
                                                    <EntryRow
                                                        key={p.id}
                                                        entry={p}
                                                        active={p.id === selectedId}
                                                        onSelect={() => setSelectedId(p.id ?? null)}
                                                        onCopyPassword={() => handleCopyPassword(p)}
                                                        onCopyUsername={() => handleCopyUsername(p)}
                                                        onTogglePin={() => handleTogglePin(p)}
                                                        copiedId={copiedId}
                                                    />
                                                ))}
                                            </Section>
                                        )}

                                        {others.length > 0 && (
                                            <Section title="All" icon={<KeyRound className="h-3 w-3" />}>
                                                {others.map(p => (
                                                    <EntryRow
                                                        key={p.id}
                                                        entry={p}
                                                        active={p.id === selectedId}
                                                        onSelect={() => setSelectedId(p.id ?? null)}
                                                        onCopyPassword={() => handleCopyPassword(p)}
                                                        onCopyUsername={() => handleCopyUsername(p)}
                                                        onTogglePin={() => handleTogglePin(p)}
                                                        copiedId={copiedId}
                                                    />
                                                ))}
                                            </Section>
                                        )}

                                        {filtered.length === 0 && (
                                            <div className="text-center text-xs text-muted-foreground py-8">
                                                No matches for "{query}"
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Right: Detail */}
                        <div className="hidden lg:flex col-span-7 xl:col-span-8 glass-card rounded-2xl overflow-hidden flex-col">
                            {selected ? (
                                <EntryDetail
                                    key={selected.id}
                                    entry={selected}
                                    revealed={selected.id ? revealed[selected.id] : undefined}
                                    onReveal={() => handleReveal(selected)}
                                    onCopyPassword={() => handleCopyPassword(selected)}
                                    onCopyUsername={() => handleCopyUsername(selected)}
                                    onCopyField={(text, key) => copyText(text, key)}
                                    onTogglePin={() => handleTogglePin(selected)}
                                    onEdit={() => openEdit(selected)}
                                    onDelete={() => handleDelete(selected)}
                                    onOpenUrl={() => openUrl(selected.url)}
                                    copiedId={copiedId}
                                />
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                                    <div className="text-center space-y-3">
                                        <Shield className="h-12 w-12 mx-auto opacity-30" />
                                        <p className="text-sm">Select an account</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <PasswordEditor
                    open={editorOpen}
                    entry={editingEntry}
                    onClose={() => {
                        setEditorOpen(false);
                        setEditingEntry(null);
                    }}
                    onSave={async (entry, plaintext) => {
                        if (entry.id) {
                            await updatePassword(entry, plaintext);
                        } else {
                            await createPassword(entry, plaintext || '');
                        }
                        setEditorOpen(false);
                        setEditingEntry(null);
                    }}
                />
            </motion.div>
        </AnimatePresence>
    );
}

// ── Sub-components ─────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1.5 px-2 pt-1 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {icon}
                {title}
            </div>
            <div className="space-y-1">{children}</div>
        </div>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <div className="py-12 text-center space-y-4 px-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary/80" />
            </div>
            <div className="space-y-1">
                <h3 className="text-sm font-semibold">No passwords yet</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Stored locally on this device and encrypted with your OS keychain.
                </p>
            </div>
            <Button onClick={onCreate} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add your first account
            </Button>
        </div>
    );
}

function Avatar({ entry }: { entry: PasswordEntry }) {
    const fav = faviconUrl(entry.url);
    const [broken, setBroken] = useState(false);
    if (fav && !broken) {
        return (
            <img
                src={fav}
                alt=""
                onError={() => setBroken(true)}
                className="h-9 w-9 rounded-lg object-cover bg-muted shrink-0"
            />
        );
    }
    return (
        <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
            {initials(entry.name)}
        </div>
    );
}

function EntryRow({
    entry, active, onSelect, onCopyPassword, onCopyUsername, onTogglePin, copiedId,
}: {
    entry: PasswordEntry;
    active: boolean;
    onSelect: () => void;
    onCopyPassword: () => void;
    onCopyUsername: () => void;
    onTogglePin: () => void;
    copiedId: string | null;
}) {
    const pwCopied = copiedId === `pw-${entry.id}`;
    const unCopied = copiedId === `un-${entry.id}`;
    return (
        <button
            onClick={onSelect}
            className={cn(
                "w-full group flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors",
                active ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-accent/50"
            )}
        >
            <Avatar entry={entry} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{entry.name}</span>
                    {entry.isPinned ? <Pin className="h-2.5 w-2.5 text-primary shrink-0" /> : null}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                    {entry.username || entry.url || '—'}
                </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <IconBtn
                    title="Copy username"
                    onClick={(e) => { e.stopPropagation(); onCopyUsername(); }}
                    flashing={unCopied}
                >
                    {unCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <User className="h-3.5 w-3.5" />}
                </IconBtn>
                <IconBtn
                    title="Copy password"
                    onClick={(e) => { e.stopPropagation(); onCopyPassword(); }}
                    flashing={pwCopied}
                >
                    {pwCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </IconBtn>
                <IconBtn
                    title={entry.isPinned ? "Unpin" : "Pin"}
                    onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                >
                    {entry.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </IconBtn>
            </div>
        </button>
    );
}

function IconBtn({
    children, onClick, title, flashing,
}: {
    children: React.ReactNode;
    onClick: (e: React.MouseEvent) => void;
    title: string;
    flashing?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                flashing ? "bg-emerald-500/15" : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
        >
            {children}
        </button>
    );
}

function EntryDetail({
    entry, revealed, onReveal, onCopyPassword, onCopyUsername, onCopyField,
    onTogglePin, onEdit, onDelete, onOpenUrl, copiedId,
}: {
    entry: PasswordEntry;
    revealed: string | undefined;
    onReveal: () => void;
    onCopyPassword: () => void;
    onCopyUsername: () => void;
    onCopyField: (text: string, key: string) => void;
    onTogglePin: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onOpenUrl: () => void;
    copiedId: string | null;
}) {
    const pwCopied = copiedId === `pw-${entry.id}`;
    const unCopied = copiedId === `un-${entry.id}`;
    const urlCopied = copiedId === `url-${entry.id}`;
    const s = strength(revealed || '');

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/40 flex items-start gap-3">
                <Avatar entry={entry} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold truncate">{entry.name}</h2>
                        {entry.isPinned ? <Pin className="h-3.5 w-3.5 text-primary" /> : null}
                    </div>
                    {entry.category && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {entry.category}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTogglePin} title={entry.isPinned ? 'Unpin' : 'Pin'}>
                        {entry.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} title="Delete">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Fields */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-3">
                <FieldRow
                    icon={<User className="h-3.5 w-3.5" />}
                    label="Username"
                    value={entry.username || '—'}
                    copyFlash={unCopied}
                    onCopy={onCopyUsername}
                    mono
                />

                <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <KeyRound className="h-3.5 w-3.5" />
                            Password
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReveal} title={revealed ? 'Hide' : 'Reveal'}>
                                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                                variant={pwCopied ? 'default' : 'ghost'}
                                size="icon"
                                className={cn("h-7 w-7", pwCopied && "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30")}
                                onClick={onCopyPassword}
                                title="Copy password (auto-clears in 30s)"
                            >
                                {pwCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    </div>
                    <div className="mt-1 font-mono text-sm tracking-wider break-all min-h-[1.25rem]">
                        {revealed ? revealed : '••••••••••••'}
                    </div>
                    {revealed && (
                        <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                    className={cn("h-full transition-all duration-300", s.color)}
                                    style={{ width: `${Math.min(100, (s.score / 6) * 100)}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{s.label}</span>
                        </div>
                    )}
                </div>

                {entry.url && (
                    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                <LinkIcon className="h-3.5 w-3.5" />
                                Website
                            </div>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenUrl} title="Open in browser">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant={urlCopied ? 'default' : 'ghost'}
                                    size="icon"
                                    className={cn("h-7 w-7", urlCopied && "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30")}
                                    onClick={() => onCopyField(entry.url || '', `url-${entry.id}`)}
                                    title="Copy URL"
                                >
                                    {urlCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>
                        <div className="mt-1 text-sm truncate text-foreground/90">{entry.url}</div>
                    </div>
                )}

                {entry.notes && (
                    <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            <StickyNote className="h-3.5 w-3.5" />
                            Notes
                        </div>
                        <div className="text-sm whitespace-pre-wrap text-foreground/90">{entry.notes}</div>
                    </div>
                )}

                {entry.lastUsed && (
                    <div className="text-[10px] text-muted-foreground pt-1">
                        Last used {new Date(entry.lastUsed).toLocaleString()}
                    </div>
                )}
            </div>
        </div>
    );
}

function FieldRow({
    icon, label, value, onCopy, copyFlash, mono,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onCopy?: () => void;
    copyFlash?: boolean;
    mono?: boolean;
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {icon}
                    {label}
                </div>
                {onCopy && (
                    <Button
                        variant={copyFlash ? 'default' : 'ghost'}
                        size="icon"
                        className={cn("h-7 w-7", copyFlash && "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30")}
                        onClick={onCopy}
                        title={`Copy ${label.toLowerCase()}`}
                    >
                        {copyFlash ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                )}
            </div>
            <div className={cn("mt-1 text-sm break-all", mono && "font-mono")}>{value}</div>
        </div>
    );
}

// ── Editor Dialog ──────────────────────────────────────────────
function PasswordEditor({
    open, entry, onClose, onSave,
}: {
    open: boolean;
    entry: PasswordEntry | null;
    onClose: () => void;
    onSave: (entry: PasswordEntry, plaintext?: string) => Promise<void>;
}) {
    const [form, setForm] = useState<PasswordEntry>({
        name: '', username: '', url: '', notes: '', category: '', isPinned: 0,
    });
    const [plaintext, setPlaintext] = useState('');
    const [currentPw, setCurrentPw] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [genLen, setGenLen] = useState(20);
    const [saving, setSaving] = useState(false);
    const revealPassword = useStore(s => s.revealPassword);
    const loadedRef = useRef<number | null>(null);

    useEffect(() => {
        if (entry) {
            setForm({
                id: entry.id,
                name: entry.name,
                username: entry.username || '',
                url: entry.url || '',
                notes: entry.notes || '',
                category: entry.category || '',
                isPinned: entry.isPinned ? 1 : 0,
            });
            setPlaintext('');
            setCurrentPw('');
            setShowPw(false);
            // When editing, load the existing password so user can see/edit it
            if (entry.id && loadedRef.current !== entry.id) {
                loadedRef.current = entry.id;
                revealPassword(entry.id).then(pt => {
                    setCurrentPw(pt);
                    setPlaintext(pt);
                });
            } else if (!entry.id) {
                loadedRef.current = null;
            }
        }
    }, [entry, revealPassword]);

    const isEdit = !!form.id;
    const s = strength(plaintext);

    const handleGenerate = useCallback(() => {
        const next = generatePassword(genLen, { upper: true, digits: true, symbols: true });
        setPlaintext(next);
        setShowPw(true);
    }, [genLen]);

    const handleSave = async () => {
        if (!form.name.trim()) return;
        setSaving(true);
        try {
            // On edit: only send plaintext if changed from loaded value
            const shouldSendPassword = !isEdit || plaintext !== currentPw;
            await onSave(form, shouldSendPassword ? plaintext : undefined);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {isEdit ? 'Edit account' : 'New account'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</label>
                        <Input
                            autoFocus
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Gmail, Bank, etc."
                            className="h-9 mt-1"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Username / Email</label>
                        <Input
                            value={form.username}
                            onChange={(e) => setForm(f => ({ ...f, username: e.target.value }))}
                            placeholder="you@example.com"
                            className="h-9 mt-1"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</label>
                        <div className="flex gap-1.5 mt-1">
                            <div className="relative flex-1">
                                <Input
                                    type={showPw ? 'text' : 'password'}
                                    value={plaintext}
                                    onChange={(e) => setPlaintext(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-9 pr-9 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(p => !p)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                                >
                                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </button>
                            </div>
                            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleGenerate} title={`Generate ${genLen}-char password`}>
                                <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                        {plaintext && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className={cn("h-full transition-all duration-300", s.color)}
                                        style={{ width: `${Math.min(100, (s.score / 6) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground w-14 text-right">{s.label}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-muted-foreground">Length</span>
                            <input
                                type="range"
                                min={8}
                                max={48}
                                value={genLen}
                                onChange={(e) => setGenLen(Number(e.target.value))}
                                className="flex-1 accent-primary"
                            />
                            <span className="text-[10px] font-mono text-muted-foreground w-6 text-right">{genLen}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Website</label>
                            <Input
                                value={form.url}
                                onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))}
                                placeholder="example.com"
                                className="h-9 mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Category</label>
                            <Input
                                value={form.category}
                                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                                placeholder="Work, Personal..."
                                className="h-9 mt-1"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</label>
                        <Textarea
                            value={form.notes}
                            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Security questions, backup codes, etc."
                            className="mt-1 min-h-[70px] text-sm"
                        />
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={!!form.isPinned}
                            onChange={(e) => setForm(f => ({ ...f, isPinned: e.target.checked ? 1 : 0 }))}
                            className="accent-primary"
                        />
                        Pin to top
                    </label>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!form.name.trim() || saving}>
                            {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
