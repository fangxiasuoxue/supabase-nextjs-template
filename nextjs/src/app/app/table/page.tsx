"use client";

import React, { useState, useEffect } from 'react';
import { useGlobal } from '@/lib/context/GlobalContext';
import {
    createSPASassClientAuthenticated as createSPASassClient
} from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Loader2, Plus, Trash2, AlertCircle, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/lib/context/LanguageContext';
import Confetti from '@/components/Confetti';

import { Database } from '@/lib/types';

type Task = Database['public']['Tables']['todo_list']['Row'];
type NewTask = Database['public']['Tables']['todo_list']['Insert'];

interface CreateTaskDialogProps {
    onTaskCreated: () => Promise<void>;
}

function CreateTaskDialog({ onTaskCreated }: CreateTaskDialogProps) {
    const { user } = useGlobal();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [newTaskTitle, setNewTaskTitle] = useState<string>('');
    const [newTaskDescription, setNewTaskDescription] = useState<string>('');
    const [isUrgent, setIsUrgent] = useState<boolean>(false);
    const { t } = useLanguage();

    const handleAddTask = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || !user?.id) return;

        try {
            setLoading(true);
            const supabase = await createSPASassClient();
            const newTask: NewTask = {
                title: newTaskTitle.trim(),
                description: newTaskDescription.trim() || null,
                urgent: isUrgent,
                owner: user.id,
                done: false
            };

            const { error: supabaseError } = await supabase.createTask(newTask);
            if (supabaseError) throw supabaseError;

            setNewTaskTitle('');
            setNewTaskDescription('');
            setIsUrgent(false);
            setOpen(false);
            await onTaskCreated();
        } catch (err) {
            setError('Failed to add task');
            console.error('Error adding task:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="btn-primary rounded-2xl px-6 h-12 font-black uppercase tracking-widest text-xs">
                    <Plus className="h-4 w-4 mr-2" />
                    New Entry
                </Button>
            </DialogTrigger>
            <DialogContent className="glass-card rounded-[2rem] p-8 max-w-md">
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl font-black tracking-tight text-foreground flex items-center gap-3">
                        <div className="p-2 bg-cyan-50 rounded-xl">
                            <Plus className="h-5 w-5 text-cyan-600" />
                        </div>
                        创建新任务
                    </DialogTitle>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700 rounded-2xl mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="tech-mono text-[10px] uppercase font-bold">{error}</AlertDescription>
                    </Alert>
                )}
                <form onSubmit={handleAddTask} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Title</label>
                        <Input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            className="bg-white border-slate-300 rounded-2xl h-12 px-4 focus:ring-1 focus:ring-cyan-600/20 focus:border-cyan-600 outline-none tech-mono text-sm"
                            placeholder="Enter task code identifier..."
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest ml-1">Description</label>
                        <Textarea
                            value={newTaskDescription}
                            onChange={(e) => setNewTaskDescription(e.target.value)}
                            className="bg-white border-slate-300 rounded-2xl px-4 py-3 focus:ring-1 focus:ring-cyan-600/20 focus:border-cyan-600 outline-none tech-mono text-sm min-h-[100px]"
                            placeholder="Optional technical details..."
                            rows={3}
                        />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={isUrgent}
                                    onChange={(e) => setIsUrgent(e.target.checked)}
                                    className="peer sr-only"
                                />
                                <div className="w-10 h-6 bg-slate-200 rounded-full border border-slate-300 peer-checked:bg-red-100 peer-checked:border-red-300 transition-all" />
                                <div className="absolute left-1 top-1 w-4 h-4 bg-slate-400 rounded-full peer-checked:left-5 peer-checked:bg-red-500 transition-all" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-red-600 transition-colors">Priority: High</span>
                        </label>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="btn-primary rounded-2xl px-8 h-12 font-black uppercase tracking-widest text-xs"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Execute
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function TaskManagementPage() {
    const { user } = useGlobal();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [initialLoading, setInitialLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');
    const [filter, setFilter] = useState<boolean | null>(null);
    const [showConfetti, setShowConfetti] = useState<boolean>(false);

    useEffect(() => {
        if (user?.id) {
            loadTasks();
        }
    }, [filter, user?.id]);

    const loadTasks = async (): Promise<void> => {
        try {
            const isFirstLoad = initialLoading;
            if (!isFirstLoad) setLoading(true);

            const supabase = await createSPASassClient();
            const { data, error: supabaseError } = await supabase.getMyTodoList(1, 100, 'created_at', filter);

            if (supabaseError) throw supabaseError;
            setTasks(data || []);
        } catch (err) {
            setError('Failed to load tasks');
            console.error('Error loading tasks:', err);
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    };

    const handleRemoveTask = async (id: number): Promise<void> => {
        try {
            const supabase = await createSPASassClient();
            const { error: supabaseError } = await supabase.removeTask(id);
            if (supabaseError) throw supabaseError;
            await loadTasks();
        } catch (err) {
            setError('Failed to remove task');
            console.error('Error removing task:', err);
        }
    };

    const handleMarkAsDone = async (id: number): Promise<void> => {
        try {
            const supabase = await createSPASassClient();
            const { error: supabaseError } = await supabase.updateAsDone(id);
            if (supabaseError) throw supabaseError;
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2000);

            await loadTasks();
        } catch (err) {
            setError('Failed to update task');
            console.error('Error updating task:', err);
        }
    };

    if (initialLoading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-cyan-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Syncing Task Database...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-cyan-600 mb-1">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-600">Workflow / Execution Tracking</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-foreground">任务管理 <span className="text-cyan-600">.</span></h1>
                    <p className="text-muted-foreground text-sm max-w-2xl text-muted-foreground">追踪系统运维任务、节点配置流程及日常技术待办事项。</p>
                </div>
                <CreateTaskDialog onTaskCreated={loadTasks} />
            </div>

            <div className="grid gap-8">
                <div className="glass-card rounded-[2rem] overflow-hidden">
                    <div className="p-8 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => setFilter(null)}
                                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-2 ${filter === null ? 'text-cyan-700' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                全部任务
                                {filter === null && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600" />}
                            </button>
                            <button
                                onClick={() => setFilter(false)}
                                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-2 ${filter === false ? 'text-cyan-700' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                进行中
                                {filter === false && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600" />}
                            </button>
                            <button
                                onClick={() => setFilter(true)}
                                className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all relative py-2 ${filter === true ? 'text-cyan-700' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                已完成
                                {filter === true && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600" />}
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground tech-mono">
                            <span className="uppercase tracking-widest opacity-50">Database Status:</span>
                            <span className="text-green-600 flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                Optimized
                            </span>
                        </div>
                    </div>

                    <div className="p-8 relative min-h-[400px]">
                        {loading && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[2px] z-10">
                                <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                            </div>
                        )}

                        {tasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 opacity-30 grayscale">
                                <div className="w-20 h-20 rounded-full border-2 border-slate-300 flex items-center justify-center mb-6">
                                    <CheckCircle className="h-10 w-10" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Active Deployments</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {tasks.map((task) => (
                                    <div
                                        key={task.id}
                                        className={`group relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 ${
                                            task.done
                                                ? 'bg-slate-50 border-slate-200 opacity-60'
                                                : task.urgent
                                                    ? 'bg-red-50 border-red-200 shadow-sm'
                                                    : 'bg-white border-slate-200 shadow-sm hover:border-cyan-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-6 relative z-10">
                                            <div className="flex-1 min-w-0 space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <h3 className={`text-lg font-black tracking-tight ${task.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                        {task.title}
                                                    </h3>
                                                    {task.urgent && !task.done && (
                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em] bg-red-50 text-red-700 border border-red-200 rounded-md">
                                                            P0 / Urgent
                                                        </span>
                                                    )}
                                                </div>
                                                {task.description && (
                                                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{task.description}</p>
                                                )}
                                                <div className="flex items-center gap-4 pt-2">
                                                    <div className="flex items-center gap-1.5 opacity-60">
                                                        <CalendarDays className="h-3 w-3" />
                                                        <span className="text-[10px] tech-mono font-bold uppercase tracking-wider">
                                                            T-Stamp: {new Date(task.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <div className="h-1 w-1 rounded-full bg-slate-300" />
                                                    <span className="text-[10px] tech-mono font-bold uppercase tracking-wider opacity-60">ID: {task.id.toString().padStart(4, '0')}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                                                {!task.done && (
                                                    <Button
                                                        onClick={() => handleMarkAsDone(task.id)}
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-10 w-10 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-xl"
                                                    >
                                                        <CheckCircle className="h-5 w-5" />
                                                    </Button>
                                                )}
                                                <Button
                                                    onClick={() => handleRemoveTask(task.id)}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-10 w-10 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>
                                        
                                        {!task.done && (
                                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                                                <div className="w-24 h-24 rounded-full border-4 border-cyan-600" />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Confetti active={showConfetti} />
        </div>
    );
}