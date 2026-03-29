import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { useTaskTimer } from './hooks/useTaskTimer';
import { TaskBoard } from './components/TaskBoard';
import { StatsBlock } from './components/StatsBlock';
import { CalendarBlock } from './components/CalendarBlock';
import { ActiveTaskTimer } from './components/ActiveTaskTimer';
import { useStore } from './store';
import { getLocalDateString } from './lib/utils';
import { useWindowFocus } from './hooks/useWindowFocus';
import { isElectron } from './lib/platform';
import { useShallow } from 'zustand/react/shallow';

import { ThemeProvider } from './components/ThemeProvider';
import { ModeToggle } from './components/ModeToggle';

const NotesMode = lazy(() => import('./components/NotesMode').then(m => ({ default: m.NotesMode })));
const YearMode = lazy(() => import('./components/YearMode').then(m => ({ default: m.YearMode })));
const BudgetMode = lazy(() => import('./components/BudgetMode').then(m => ({ default: m.BudgetMode })));

import { HeaderPrayers } from './components/HeaderPrayers';
import { FocusMode } from './components/FocusMode';
import { FocusOverlay } from './components/FocusOverlay';
import { ReactiveBlock } from './components/ReactiveBlock';
import { motion, AnimatePresence } from 'framer-motion';
import { WindowControls } from './components/WindowControls';

import { DevelopmentButton } from './components/DevelopmentButton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { Switch } from './components/ui/switch';
import { Label } from './components/ui/label';
import { Settings2, HelpCircle, Download, BookOpen, CalendarDays, LogOut, Wallet } from 'lucide-react';
import { api } from './api';
import { supabase } from './lib/supabase';

function App() {
  // Grouped selectors to minimize subscription count
  const {
    fetchTasks, fetchStats, fetchDailyLog, fetchDevItems,
    fetchRepeatingTasks, checkMissedTasks, syncTimers,
    isMurtazaMode, setIsMurtazaMode,
    isHardcoreMode, setIsHardcoreMode,
    osPrefix, setOsPrefix,
    toggleNotesMode, toggleYearMode, toggleBudgetMode,
    fetchBudgetCategories,
  } = useStore(useShallow(state => ({
    fetchTasks: state.fetchTasks,
    fetchStats: state.fetchStats,
    fetchDailyLog: state.fetchDailyLog,
    fetchDevItems: state.fetchDevItems,
    fetchRepeatingTasks: state.fetchRepeatingTasks,
    checkMissedTasks: state.checkMissedTasks,
    isMurtazaMode: state.isMurtazaMode,
    setIsMurtazaMode: state.setIsMurtazaMode,
    isHardcoreMode: state.isHardcoreMode,
    setIsHardcoreMode: state.setIsHardcoreMode,
    osPrefix: state.osPrefix,
    setOsPrefix: state.setOsPrefix,
    syncTimers: state.syncTimers,
    toggleNotesMode: state.toggleNotesMode,
    toggleYearMode: state.toggleYearMode,
    toggleBudgetMode: state.toggleBudgetMode,
    fetchBudgetCategories: state.fetchBudgetCategories,
  })));

  const isFocusMode = useStore(state => state.isFocusMode);
  const dailyLog = useStore(state => state.dailyLog);
  const isTransitioning = useStore(state => state.isTransitioning);

  const [_windowSize, setWindowSize] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const APP_VERSION = __APP_VERSION__ || '5.0.0';

  // Window focus state for pausing background work
  const isWindowFocused = useWindowFocus();

  // Single global timer — drives all active task timers from one interval
  useTaskTimer();

  useEffect(() => {
    Promise.all([
      fetchTasks(),
      fetchStats(),
      fetchDailyLog(getLocalDateString()),
      fetchDevItems(),
      fetchRepeatingTasks(),
      syncTimers(),
      fetchBudgetCategories(),
    ]).then(() => {
      checkMissedTasks();
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []); // Initial fetch only - run once

  // Sync all data from Supabase when window regains focus (cross-device)
  useEffect(() => {
    if (isWindowFocused) {
      syncTimers();
      fetchTasks();
      fetchStats();
      fetchDailyLog(getLocalDateString());
    }
  }, [isWindowFocused, syncTimers, fetchTasks, fetchStats, fetchDailyLog]);

  // Periodic timer sync while window is focused (cross-device, 30s interval)
  useEffect(() => {
    if (!isWindowFocused) return;
    const interval = setInterval(() => { syncTimers(); }, 30000);
    return () => clearInterval(interval);
  }, [isWindowFocused, syncTimers]);

  useEffect(() => {
    // Only check for date change when window is focused — saves CPU when minimized
    if (!isWindowFocused) return;

    const interval = setInterval(() => {
      const currentDate = getLocalDateString();
      if (currentDate !== dailyLog?.date) {
        fetchDailyLog(currentDate);
        fetchStats();
        checkMissedTasks();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [dailyLog, fetchDailyLog, fetchStats, checkMissedTasks, isWindowFocused]);

  // Handle Overlay Mode Transition (Electron only)
  useEffect(() => {
    if (isElectron) {
      if (isMurtazaMode) {
        window.ipcRenderer.send('set-overlay-mode', true);
        document.body.style.backgroundColor = 'transparent';
      } else {
        window.ipcRenderer.send('set-overlay-mode', false);
        document.body.style.backgroundColor = '';
      }
    }
  }, [isMurtazaMode]);

  // Handle Notes and Year Mode Shortcuts (Electron global shortcuts)
  useEffect(() => {
    if (!isElectron) return;
    const removeListener = window.ipcRenderer.on('toggle-notes-mode', () => {
      toggleNotesMode();
    });
    const removeYearListener = window.ipcRenderer.on('toggle-year-mode', () => {
      toggleYearMode();
    });
    const removeBudgetListener = window.ipcRenderer.on('toggle-budget-mode', () => {
      toggleBudgetMode();
    });
    return () => {
      removeListener();
      removeYearListener();
      removeBudgetListener();
    };
  }, [toggleNotesMode, toggleYearMode, toggleBudgetMode]);

  useEffect(() => {
    if (!isElectron) return;
    const removeSizeListener = window.ipcRenderer.on('window-size-state', (_, size: unknown) => {
      setWindowSize(prev => prev === (size as number) ? prev : (size as number));
    });
    return () => {
      removeSizeListener();
    }
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      const data = await api.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xOS_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data', err);
    }
  }, []);



  if (isMurtazaMode && isElectron) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="mos-theme">
        <FocusOverlay />
        <Suspense><NotesMode /></Suspense>
        <Suspense><YearMode /></Suspense>
        <Suspense><BudgetMode /></Suspense>

        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[9999] bg-black flex items-center justify-center no-drag pointer-events-none"
            >
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="text-7xl text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
              >
                م
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </ThemeProvider>
    )
  }

  if (isLoading) {
    return (
      <ThemeProvider defaultTheme="dark" storageKey="mos-theme">
        <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-4xl font-bold text-primary"
          >
            {osPrefix}OS
          </motion.div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading your data...</p>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider defaultTheme="dark" storageKey="mos-theme">
      {isFocusMode ? (
        <FocusMode />
      ) : (
        <div className={`h-[100dvh] relative overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-background/95 rounded-none border border-border shadow-2xl no-scrollbar`} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Drag Bar — Electron only */}
          {isElectron && <div className="w-full h-2.5 drag shrink-0 fixed top-0 left-0 right-0 z-[100]" />}

          {/* Ambient Background Gradient */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background/95" />
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 dark:bg-primary/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/5 dark:bg-accent/10 rounded-full blur-[50px] translate-y-1/2 -translate-x-1/4" />
          </div>

          <div className={`relative max-w-screen-2xl mx-auto w-full h-full flex flex-col ${isMurtazaMode ? 'bg-transparent' : 'bg-transparent'} text-foreground p-3 sm:p-4 lg:p-6 gap-4 sm:gap-4 lg:gap-8 font-sans selection:bg-primary/20 selection:text-primary transition-colors duration-150 overflow-x-hidden overflow-y-auto lg:overflow-hidden no-scrollbar`}>
            {/* Header */}
            <motion.header
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              onDoubleClick={() => isElectron && window.ipcRenderer.send('maximize-window')}
              className={`sticky top-4 z-50 rounded-2xl px-3 sm:px-4 lg:px-6 py-3 lg:py-4 flex justify-between items-center backdrop-blur-xl ${isMurtazaMode ? 'bg-background/90 border border-border shadow-lg shadow-black/10' : 'glass'} drag`}
            >
              <div className="flex items-center gap-2">
                <motion.h1
                  className="text-2xl font-bold tracking-tight text-primary dark:text-primary transition-all duration-150 hover:drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)] cursor-pointer no-drag flex items-baseline gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => isElectron && setIsMurtazaMode(!isMurtazaMode)}
                >
                  <span>{isMurtazaMode && isElectron ? "مُرتضیٰ" : `${osPrefix}OS`}</span>
                  <span className="text-xs font-mono text-muted-foreground opacity-50">v{APP_VERSION}</span>
                </motion.h1>

                {!isMurtazaMode && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 hover:opacity-50 transition-opacity no-drag">
                        <Settings2 className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3 no-drag space-y-3" side="right">
                      <div className="flex items-center gap-2">
                        <Input
                          value={osPrefix}
                          onChange={(e) => setOsPrefix(e.target.value.slice(0, 1))}
                          maxLength={1}
                          className="h-8 text-center font-bold"
                        />
                        <span className="text-sm font-medium text-muted-foreground">OS</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="hardcore-mode" className="text-xs font-medium">Hardcore</Label>
                        <Switch
                          id="hardcore-mode"
                          checked={isHardcoreMode}
                          onCheckedChange={setIsHardcoreMode}
                          className="scale-75"
                        />
                      </div>
                      
                      <div className="border-t border-border pt-3 space-y-2">
                        <Button
                          variant="outline"
                          className="w-full text-xs flex gap-2 items-center"
                          onClick={handleExportData}
                        >
                          <Download className="h-3 w-3" />
                          Export Data Backup
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full text-xs flex gap-2 items-center text-destructive hover:text-destructive"
                          onClick={() => supabase.auth.signOut()}
                        >
                          <LogOut className="h-3 w-3" />
                          Sign Out
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 no-drag">
                <HeaderPrayers />
              </div>



              <div className="flex items-center gap-1 sm:gap-4 no-drag">
                {import.meta.env.DEV && <DevelopmentButton />}

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full opacity-[0.08] hover:opacity-50 transition-opacity duration-300"
                      id="help-guide-button"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-0 no-drag" side="bottom" align="end">
                    <div className="p-4 space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Keyboard Shortcuts</h4>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Notes Mode</span>
                            <kbd className="px-2 py-0.5 text-[10px] font-mono bg-muted rounded border border-border text-muted-foreground">Ctrl + `</kbd>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Year Mode</span>
                            <kbd className="px-2 py-0.5 text-[10px] font-mono bg-muted rounded border border-border text-muted-foreground">Ctrl + Num1</kbd>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Budget Mode</span>
                            <kbd className="px-2 py-0.5 text-[10px] font-mono bg-muted rounded border border-border text-muted-foreground">Ctrl + Num2</kbd>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Focus Mode</span>
                            <span className="text-[10px] text-muted-foreground/60 italic">via active timer</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Toggle Theme</span>
                            <span className="text-[10px] text-muted-foreground/60 italic">☀/☾ button</span>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-border pt-3">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Quick Guide</h4>
                        <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
                          <li className="flex gap-2"><span className="text-primary/60">•</span>Click the logo to enter overlay mode</li>
                          <li className="flex gap-2"><span className="text-primary/60">•</span>Pin the window with the pin button</li>
                          <li className="flex gap-2"><span className="text-primary/60">•</span>Start a timer on any task, then enter Focus Mode for distraction-free work</li>
                          <li className="flex gap-2"><span className="text-primary/60">•</span>Double-click the header to maximize</li>
                          <li className="flex gap-2"><span className="text-primary/60">•</span>Use Notes Mode to organize by subjects</li>
                          <li className="flex gap-2"><span className="text-primary/60">•</span>Track streaks & progress in Year Mode</li>
                        </ul>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {!isElectron && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 lg:h-7 lg:w-7 rounded-full opacity-70 hover:opacity-100 transition-opacity"
                      onClick={() => toggleNotesMode()}
                      title="Notes Mode"
                    >
                      <BookOpen className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 lg:h-7 lg:w-7 rounded-full opacity-70 hover:opacity-100 transition-opacity"
                      onClick={() => toggleYearMode()}
                      title="Year Mode"
                    >
                      <CalendarDays className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 lg:h-7 lg:w-7 rounded-full opacity-70 hover:opacity-100 transition-opacity"
                      onClick={() => toggleBudgetMode()}
                      title="Budget Mode"
                    >
                      <Wallet className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    </Button>
                  </>
                )}
                <ModeToggle />
                <WindowControls />
              </div>
            </motion.header>

            {/* Main Grid */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="grid grid-cols-12 gap-3 sm:gap-4 lg:gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden"
            >
              {/* Left Column: Stats only */}
              <div className="col-span-12 lg:col-span-3 lg:overflow-hidden">
                <ReactiveBlock className={`${isMurtazaMode ? 'bg-background/80 border border-border rounded-3xl' : 'glass-card'} p-0 lg:p-6 transition-all duration-150 no-drag lg:h-full overflow-y-auto no-scrollbar`}>
                  <ErrorBoundary fallbackTitle="Stats">
                    <StatsBlock />
                  </ErrorBoundary>
                </ReactiveBlock>
              </div>

              {/* Middle Column: Task Board */}
              <div className="col-span-12 lg:col-span-6 lg:overflow-hidden">
                <ReactiveBlock className={`${isMurtazaMode ? 'bg-background/80 border border-border rounded-3xl' : 'glass-card'} lg:overflow-hidden lg:h-full transition-all duration-150 no-drag`}>
                  <ErrorBoundary fallbackTitle="Task Board">
                    <TaskBoard />
                  </ErrorBoundary>
                </ReactiveBlock>
              </div>

              {/* Right Column: Calendar */}
              <div className="col-span-12 lg:col-span-3 lg:overflow-hidden">
                <ReactiveBlock className={`${isMurtazaMode ? 'bg-background/80 border border-border rounded-3xl' : 'glass-card'} lg:overflow-hidden flex flex-col lg:h-full transition-all duration-150 no-drag`}>
                  <ErrorBoundary fallbackTitle="Calendar">
                    <CalendarBlock />
                  </ErrorBoundary>
                </ReactiveBlock>
              </div>
            </motion.div>

            <ActiveTaskTimer />
          </div>
        </div>
      )}
      <Suspense><NotesMode /></Suspense>
      <Suspense><YearMode /></Suspense>
      <Suspense><BudgetMode /></Suspense>

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-black flex items-center justify-center no-drag pointer-events-none"
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-7xl text-primary drop-shadow-[0_0_15px_hsl(var(--primary)/0.6)]"
            >
              م
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeProvider >
  );
}


export default App;
