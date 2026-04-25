import React, { useState, useEffect } from 'react';
import { 
  getAuth, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { db, auth, signIn, logout } from './lib/firebase';
import { Goal, Task, Schedule, ScheduledTask } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Target, 
  ListChecks, 
  Sparkles, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  LogOut, 
  Calendar,
  ChevronRight,
  Loader2,
  Clock,
  GripVertical
} from 'lucide-react';
import { cn } from './lib/utils';
import { generateTaskPlan } from './lib/gemini';
import { format } from 'date-fns';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'goals' | 'tasks' | 'planner' | 'schedules'>('planner');
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Data Subscriptions
  useEffect(() => {
    if (!user) return;

    const qGoals = query(collection(db, 'goals'), where('userId', '==', user.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      setGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));
    });

    const qTasks = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });

    const qSchedules = query(collection(db, 'schedules'), where('userId', '==', user.uid));
    const unsubSchedules = onSnapshot(qSchedules, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Schedule));
      setSchedules(data.sort((a, b) => b.createdAt - a.createdAt));
    });

    return () => {
      unsubGoals();
      unsubTasks();
      unsubSchedules();
    };
  }, [user]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#030303]">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  if (!user) return <AuthScreen error={authError} onSignIn={async () => {
    setAuthError(null);
    try {
      await signIn();
    } catch (error: any) {
      setAuthError(error?.message || 'Google sign-in failed. Check Firebase Auth domain and provider settings.');
    }
  }} />;

  return (
    <div className="h-screen flex bg-zinc-950 text-zinc-300 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col p-6 shrink-0 h-full">
        <div className="flex items-center space-x-3 mb-10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight text-white">Mero</span>
        </div>

        <div className="space-y-1">
          <NavItem 
            active={activeTab === 'planner'} 
            onClick={() => setActiveTab('planner')} 
            label="Scheduler"
          />
          <NavItem 
            active={activeTab === 'goals'} 
            onClick={() => setActiveTab('goals')} 
            label="Active Goals"
          />
          <NavItem 
            active={activeTab === 'tasks'} 
            onClick={() => setActiveTab('tasks')} 
            label="Inboxes"
          />
          <NavItem 
            active={activeTab === 'schedules'} 
            onClick={() => setActiveTab('schedules')} 
            label="History"
          />
        </div>

        <div className="mt-auto space-y-6">
          <div className="p-4 rounded-xl bg-zinc-800/30 border border-zinc-700/50">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-3">Today's Progress</p>
            <div className="flex justify-between text-xs text-white mb-2 font-medium">
              <span>Goal Focus</span>
              <span>{Math.round((schedules[0]?.tasks.filter(t => t.completed).length || 0) / (schedules[0]?.tasks.length || 1) * 100)}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(schedules[0]?.tasks.filter(t => t.completed).length || 0) / (schedules[0]?.tasks.length || 1) * 100}%` }}
                className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-4 border-t border-zinc-800">
            <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-lg border border-zinc-700 shadow-sm" />
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
              <button 
                onClick={logout}
                className="text-[10px] text-zinc-500 hover:text-white flex items-center space-x-1 uppercase tracking-wider font-bold transition-colors"
              >
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-500 flex items-center gap-2">
              Today <span className="w-1 h-1 rounded-full bg-zinc-700" /> <span className="text-zinc-300 font-semibold">{format(new Date(), 'EEEE, MMM do')}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setActiveTab('planner')}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all shadow-lg shadow-indigo-600/15 active:scale-95"
            >
              Plan with AI
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'goals' && (
              <motion.div 
                key="goals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-10 max-w-5xl mx-auto h-full"
              >
                <GoalsView user={user} goals={goals} />
              </motion.div>
            )}
            {activeTab === 'tasks' && (
              <motion.div 
                key="tasks"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-10 max-w-5xl mx-auto h-full"
              >
                <InboxView user={user} tasks={tasks} />
              </motion.div>
            )}
            {activeTab === 'planner' && (
              <motion.div 
                key="planner"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-10 max-w-7xl mx-auto h-full"
              >
                <PlannerView 
                  user={user} 
                  goals={goals} 
                  tasks={tasks} 
                  onPlanCreated={() => setActiveTab('schedules')}
                />
              </motion.div>
            )}
            {activeTab === 'schedules' && (
              <motion.div 
                key="schedules"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-10 max-w-5xl mx-auto h-full"
              >
                <SchedulesView schedules={schedules} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-all duration-200 group text-left",
        active 
          ? "bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700/50" 
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30"
      )}
    >
      <div className={cn(
        "w-1.5 h-1.5 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0)]",
        active ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] scale-110" : "bg-transparent"
      )} />
      <span className="text-sm font-medium tracking-tight leading-relaxed">{label}</span>
    </button>
  );
}

function AuthScreen({
  error,
  onSignIn,
}: {
  error: string | null;
  onSignIn: () => void | Promise<void>;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030303] overflow-hidden relative">
      {/* Background Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/20 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8 relative z-10"
      >
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="space-y-2">
          <img className="w-32 h-32 mx-auto" src="/images/icon/logo.png" alt="simply ai task pri logo" />
          <p className="text-white/40 text-lg">AI-Optimized Task Planning</p>
        </div>
        <button
          onClick={onSignIn}
          className="px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-white/90 transition-all flex items-center space-x-3 mx-auto group"
        >
          <span>Continue with Google</span>
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        {error && (
          <p className="max-w-md mx-auto text-sm text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
            {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}

// Components for Views
function GoalsView({ user, goals }: { user: User, goals: Goal[] }) {
  const [newGoal, setNewGoal] = useState("");
  
  const addGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    await addDoc(collection(db, 'goals'), {
      userId: user.uid,
      title: newGoal,
      createdAt: Date.now(),
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    });
    setNewGoal("");
  };

  const deleteGoal = async (id: string) => {
    await deleteDoc(doc(db, 'goals', id));
  };

  return (
    <div className="space-y-10">
      <div className="relative">
        <h2 className="text-3xl font-semibold text-white tracking-tight">Focus Directives</h2>
        <p className="text-zinc-500 mt-1 max-w-lg">Defined outcomes help the generator prioritize your cognitive load.</p>
      </div>

      <div className="bg-zinc-900/40 rounded-2xl p-8 border border-zinc-800/80 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
        
        <form onSubmit={addGoal} className="flex gap-3 mb-8">
          <input 
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="e.g. Master React context optimization..."
            className="flex-1 bg-zinc-950/50 border border-zinc-800 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-zinc-700"
          />
          <button className="bg-zinc-100 text-zinc-950 px-6 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white active:scale-95 transition-all">
            Define
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence>
            {goals.map(goal => (
              <motion.div 
                key={goal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/50 flex items-center justify-between group hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: goal.color }} />
                  <span className="text-sm font-medium text-zinc-200">{goal.title}</span>
                </div>
                <button onClick={() => deleteGoal(goal.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-1.5 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function InboxView({ user, tasks }: { user: User, tasks: Task[] }) {
  const [newTask, setNewTask] = useState("");

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    await addDoc(collection(db, 'tasks'), {
      userId: user.uid,
      content: newTask,
      completed: false,
      createdAt: Date.now()
    });
    setNewTask("");
  };

  const toggleTask = async (task: Task) => {
    await updateDoc(doc(db, 'tasks', task.id), { completed: !task.completed });
  };

  const deleteTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id));
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-semibold text-white tracking-tight">Task Scratchpad</h2>
        <p className="text-zinc-500">Unprocessed thoughts for the AI to organize.</p>
      </div>

      <div className="bg-zinc-900/40 rounded-2xl p-8 border border-zinc-800 shadow-xl">
        <form onSubmit={addTask} className="relative mb-10">
          <input 
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Type a new task and press ENTER..."
            className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-6 py-5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-zinc-800 text-zinc-100"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
            <span className="text-[9px] font-bold text-zinc-600 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 uppercase tracking-tighter">Enter</span>
            <button className="p-2.5 bg-zinc-100 text-zinc-950 rounded-lg hover:bg-white active:scale-95 transition-all">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <AnimatePresence>
            {tasks.map(task => (
              <motion.div 
                key={task.id}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/40 flex items-center justify-between group hover:bg-zinc-900/40 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <button onClick={() => toggleTask(task)} className="text-zinc-700 hover:text-indigo-400 transition-colors active:scale-90">
                    {task.completed ? <CheckCircle2 className="w-5 h-5 text-indigo-500" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <span className={cn("text-base font-medium transition-colors", task.completed ? "text-zinc-600 line-through" : "text-zinc-300")}>
                    {task.content}
                  </span>
                </div>
                <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 p-2 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div className="py-12 text-center text-zinc-600 font-medium italic">
              Scratchpad is empty.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlannerView({ user, goals, tasks, onPlanCreated }: { user: User, goals: Goal[], tasks: Task[], onPlanCreated: () => void }) {
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'day' | 'week'>('day');
  const [planning, setPlanning] = useState(false);

  const startPlanning = async () => {
    if (planning) return;
    setPlanning(true);
    
    const activeGoals = goals.filter(g => selectedGoals.includes(g.id));
    const activeTasks = tasks.map(t => t.content);

    const resultTasks = await generateTaskPlan({
      goals: activeGoals.map(g => ({ title: g.title, description: g.description })),
      userTasks: activeTasks,
      timeRange: timeRange === 'day' ? 'today' : 'this week'
    });

    const scheduleData = {
      userId: user.uid,
      title: `${timeRange === 'day' ? 'Daily' : 'Weekly'} Plan - ${format(new Date(), 'MMM dd')}`,
      timeRange,
      startDate: Date.now(),
      goalIds: selectedGoals,
      tasks: resultTasks.map((t: any, i: number) => ({
        id: `${Date.now()}-${i}`,
        ...t,
        completed: false
      })),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await addDoc(collection(db, 'schedules'), scheduleData);
    setPlanning(false);
    onPlanCreated();
  };

  return (
    <div className="grid grid-cols-12 gap-10 h-full">
      {/* Configuration Section */}
      <section className="col-span-5 flex flex-col gap-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold tracking-tight text-white leading-tight">Plan with AI Intelligence</h2>
          <p className="text-zinc-500 font-medium leading-relaxed">Select focus goals and sync your scratchpad for a cohesive schedule.</p>
        </div>

        <div className="bg-zinc-900/40 rounded-2xl p-7 border border-zinc-800 shadow-xl space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            1. Priority Synthesis
          </h3>
          <div className="flex flex-wrap gap-2">
            {goals.map(goal => (
              <button
                key={goal.id}
                onClick={() => setSelectedGoals(prev => 
                  prev.includes(goal.id) ? prev.filter(id => id !== goal.id) : [...prev, goal.id]
                )}
                className={cn(
                  "px-4 py-2 rounded-full border text-[11px] font-bold uppercase tracking-widest transition-all",
                  selectedGoals.includes(goal.id)
                    ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                )}
              >
                {goal.title}
              </button>
            ))}
            {goals.length === 0 && (
              <p className="text-xs text-zinc-600 italic">No focus goals defined.</p>
            )}
          </div>
        </div>

        <div className="bg-zinc-900/40 rounded-2xl p-7 border border-zinc-800 shadow-xl space-y-6 flex-1 flex flex-col overflow-hidden">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 flex items-center gap-2 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            2. Content Sync
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {tasks.map(task => (
              <div key={task.id} className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400 leading-relaxed">
                {task.content}
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center space-y-3 opacity-20 py-10">
                <ListChecks className="w-10 h-10" />
                <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">Scratchpad is empty</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Action Section */}
      <section className="col-span-12 lg:col-span-7 flex flex-col">
        <div className="bg-zinc-900/60 rounded-3xl p-10 border border-zinc-800 h-full relative overflow-hidden flex flex-col shadow-2xl backdrop-blur-sm">
          {/* Atmosphere Glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-indigo-600/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-violet-600/5 blur-[120px] rounded-full" />
          
          <div className="relative z-10 flex flex-col items-center justify-center h-full text-center space-y-10">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/30 flex items-center justify-center shadow-2xl shadow-indigo-500/10 relative group">
              <div className="absolute inset-0 bg-indigo-500/10 blur-xl group-hover:bg-indigo-500/20 transition-all rounded-3xl" />
              <Sparkles className="w-12 h-12 text-indigo-400 group-hover:scale-110 transition-transform relative z-10" />
            </div>
            
            <div className="space-y-3 max-w-sm">
              <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">Autonomous Scheduler</h3>
              <p className="text-sm font-medium text-zinc-500 leading-relaxed">The engine will synthesize your scratchpad into a time-blocked strategy.</p>
            </div>

            <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800/80 shadow-sm relative z-10">
              <button 
                onClick={() => setTimeRange('day')}
                className={cn("px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.1em] transition-all", timeRange === 'day' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-zinc-600 hover:text-zinc-400")}
              >
                Today
              </button>
              <button 
                onClick={() => setTimeRange('week')}
                className={cn("px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.1em] transition-all", timeRange === 'week' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-zinc-600 hover:text-zinc-400")}
              >
                Week
              </button>
            </div>

            <button
              onClick={startPlanning}
              disabled={planning || tasks.length === 0}
              className={cn(
                "w-full max-w-sm py-5 rounded-2xl font-bold text-sm uppercase tracking-[0.2em] transition-all relative z-10 flex items-center justify-center gap-3 active:scale-95 shadow-glow",
                planning 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700" 
                  : "bg-white text-zinc-950 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] active:shadow-none"
              )}
            >
              {planning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-5 h-5" />
                  <span>Commence Planning</span>
                </>
              )}
            </button>

            <div className="pt-6 border-t border-zinc-800/50 w-full max-w-xs relative z-10">
              <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest flex items-center justify-center gap-2">
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                System Ready for Input
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SchedulesView({ schedules }: { schedules: Schedule[] }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (schedules.length === 0) return (
    <div className="text-center py-20 space-y-4">
      <Calendar className="w-16 h-16 text-white/10 mx-auto" />
      <h2 className="text-2xl font-semibold">No schedules yet</h2>
      <p className="text-white/40">Generate your first plan in the Planner tab.</p>
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="space-y-16">
        {schedules.map(schedule => (
          <div key={schedule.id} className="space-y-8">
            <div className="flex items-end justify-between border-b border-white/10 pb-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{schedule.title}</h3>
                <p className="text-sm text-white/40 font-medium">{format(schedule.startDate, 'EEEE, MMMM do')}</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right mr-4">
                  <p className="text-[10px] uppercase font-bold text-white/20 tracking-widest">Progress</p>
                  <p className="text-sm font-mono text-indigo-400">
                    {schedule.tasks.filter(t => t.completed).length} / {schedule.tasks.length}
                  </p>
                </div>
                <span className="text-xs font-semibold px-4 py-1.5 bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20 capitalize">
                  {schedule.timeRange}
                </span>
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={async (event) => {
                const { active, over } = event;
                if (over && active.id !== over.id) {
                  const oldIndex = schedule.tasks.findIndex(t => t.id === active.id);
                  const newIndex = schedule.tasks.findIndex(t => t.id === over.id);
                  const newTasks = arrayMove(schedule.tasks, oldIndex, newIndex);
                  await updateDoc(doc(db, 'schedules', schedule.id), { tasks: newTasks });
                }
              }}
            >
              <SortableContext
                items={schedule.tasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid gap-3">
                  {schedule.tasks.map((task) => (
                    <SortableTaskItem 
                      key={task.id} 
                      task={task} 
                      onToggle={async () => {
                        const updatedTasks = schedule.tasks.map(t => 
                          t.id === task.id ? { ...t, completed: !t.completed } : t
                        );
                        await updateDoc(doc(db, 'schedules', schedule.id), { tasks: updatedTasks });
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortableTaskItem({ task, onToggle }: { task: ScheduledTask, onToggle: () => Promise<void> | void, key?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group px-6 py-5 rounded-2xl border flex items-center justify-between transition-all duration-300 relative",
        isDragging ? "z-50 scale-[1.03] shadow-2xl bg-zinc-900 border-indigo-500/50 opacity-100" : "bg-zinc-900/60 border-zinc-800/80 shadow-md",
        task.completed && !isDragging && "opacity-50",
        task.isAiGenerated && !isDragging && "bg-indigo-900/[0.03] border-indigo-500/20 after:absolute after:inset-0 after:bg-indigo-500/[0.02] after:pointer-events-none after:rounded-2xl"
      )}
    >
      {/* Accent Line */}
      <div className={cn(
        "absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-all duration-500",
        task.completed ? "bg-zinc-700" : (
          task.priority === 'high' ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]" : 
          task.priority === 'medium' ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" : 
          "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
        )
      )} />

      <div className="flex items-center space-x-5 flex-1 min-w-0 pr-4">
        <button 
          {...attributes} 
          {...listeners} 
          className="shrink-0 p-1 text-zinc-800 hover:text-zinc-500 cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center space-x-4 mb-2">
            <span className={cn(
              "text-[9px] font-extrabold uppercase tracking-[0.15em] shrink-0",
              task.completed ? "text-zinc-600" : (
                task.priority === 'high' ? "text-red-400" : 
                task.priority === 'medium' ? "text-amber-500" : 
                "text-emerald-500"
              )
            )}>
              {task.priority === 'high' ? 'High Impact' : task.priority === 'medium' ? 'Standard' : 'Minor'}
            </span>
            {task.isAiGenerated && (
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded flex items-center gap-1.5 border border-indigo-500/20">
                <Sparkles className="w-2.5 h-2.5" />
                AI Enhanced
              </span>
            )}
          </div>

          <h4 className={cn(
            "text-lg font-semibold tracking-tight transition-all duration-300", 
            task.completed ? "text-zinc-600 line-through lowercase italic" : "text-zinc-100"
          )}>
            {task.content}
          </h4>
          
          {task.goalAlignment && (
            <div className="mt-2 flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-zinc-950 text-[9px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-800">
                {task.goalAlignment}
              </span>
            </div>
          )}
        </div>
      </div>
      
      <button 
        onClick={onToggle}
        className={cn(
          "shrink-0 w-7 h-7 rounded shadow-inner flex items-center justify-center transition-all duration-300",
          task.completed 
            ? "bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.4)]" 
            : "bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700"
        )}
      >
        {task.completed && <CheckCircle2 className="w-4 h-4 text-zinc-950" strokeWidth={4} />}
      </button>
    </div>
  );
}

