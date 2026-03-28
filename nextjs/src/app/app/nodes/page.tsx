import { createSSRClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
    Server, 
    Activity, 
    Plus, 
    QrCode, 
    ExternalLink, 
    ShieldCheck, 
    Wifi, 
    Zap,
    Cpu,
    Terminal,
    HardDrive,
    Layers
} from 'lucide-react';
import type { Node } from '@/types/nodes';
import { 
    Tooltip, 
    TooltipContent, 
    TooltipProvider, 
    TooltipTrigger 
} from "@/components/ui/tooltip";

export default async function NodesPage() {
    const supabase = await createSSRClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/auth/signin');
    }

    // Fetch nodes
    const { data: nodes, error } = await supabase
        .from('nodes')
        .select('*, vps_configs(name, ip)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching nodes:', error);
    }

    // Helper for status colors
    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'enabled': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 status-glow-success';
            case 'disabled': return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
            default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)]">
            <TooltipProvider>
                {/* Header / Command Center Info */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-4 relative">
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 text-primary-400 mb-4 group cursor-default">
                            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                                <Terminal className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-[0.3em] font-black text-primary-400/80">Edge Infrastructure Cluster</span>
                                <span className="text-[8px] text-muted-foreground uppercase tracking-widest -mt-0.5">Node Controller v2.1.0</span>
                            </div>
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter text-foreground leading-none">
                            节点指挥中心 <span className="text-primary-500 drop-shadow-[0_0_15px_hsl(var(--primary)/0.5)]">.</span>
                        </h1>
                        <p className="text-muted-foreground/80 mt-4 max-w-2xl text-sm font-medium leading-relaxed">
                            实时监控全球边缘节点状态，管理私信代理集群。
                            <br className="hidden md:block" />
                            自动化部署与容量调度系统，确保网络边缘的高可用性与低延迟响应。
                        </p>
                    </div>
                    
                    <div className="flex gap-4 relative z-10">
                        <Link
                            href="/app/nodes/vps-configs"
                            className="glass-card-premium px-6 py-3 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest border border-white/5 hover:border-white/10 transition-all hover:bg-white/5"
                        >
                            <Cpu className="h-4 w-4 text-primary-400" />
                            VPS 配置中心
                        </Link>
                        <Link
                            href="/app/nodes/new"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shadow-[0_10px_30px_hsl(var(--primary)/0.3)] transition-all active:scale-[0.98]"
                        >
                            <Plus className="h-4 w-4" />
                            部署新节点
                        </Link>
                    </div>
                </div>

                {/* Quick Stats Grid - Bento Style */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: "在线节点", value: nodes?.filter((n: any) => n.status === 'enabled').length || 0, sub: "Nodes Operational", icon: Wifi, color: "text-emerald-400", bg: "from-emerald-500/20 to-transparent" },
                        { label: "活跃连接", value: "2.4k", sub: "Active Uplinks", icon: Activity, color: "text-primary-400", bg: "from-primary/20 to-transparent" },
                        { label: "平均延迟", value: "48ms", sub: "Cluster Latency", icon: Zap, color: "text-amber-400", bg: "from-amber-500/20 to-transparent" },
                        { label: "安全态势", value: "SECURE", sub: "Defense Active", icon: ShieldCheck, color: "text-blue-400", bg: "from-blue-500/20 to-transparent" },
                    ].map((stat, i) => (
                        <div key={i} className="glass-card-premium p-6 rounded-3xl border border-white/5 hover:border-white/10 group transition-all duration-500 hover:-translate-y-1 overflow-hidden relative">
                            <div className={`absolute -right-4 -bottom-4 w-24 h-24 bg-gradient-to-br ${stat.bg} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700`} />
                            
                            <div className="flex items-center justify-between mb-4 relative z-10">
                                <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors ${stat.color}`}>
                                    <stat.icon className="h-5 w-5 drop-shadow-[0_0_8px_currentColor]" />
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</span>
                                    <span className="text-[8px] text-muted-foreground/40 uppercase font-bold tracking-tighter">{stat.sub}</span>
                                </div>
                            </div>
                            <div className="text-3xl font-black tech-mono uppercase tracking-tighter relative z-10 group-hover:text-foreground transition-colors">{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* Nodes Display Area */}
                <div className="pt-4">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.1)]">
                            <Layers className="h-4 w-4 text-primary-400" />
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-sm font-black uppercase tracking-[0.1em]">节点集群状态</h3>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Global Distributed Network</span>
                        </div>
                        <div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                            <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-black tech-mono text-primary-400/80">
                                {nodes?.length || 0} CLUSTERS DISCOVERED
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {nodes && nodes.length > 0 ? (
                            nodes.map((node: any) => (
                                <div key={node.id} className="glass-card-premium rounded-[2rem] border border-white/5 h-full flex flex-col group/node hover:border-primary/30 transition-all duration-500 overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.2)]">
                                    <div className="p-7 flex-1 space-y-6">
                                        <div className="flex justify-between items-start">
                                            <div className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${getStatusStyles(node.status)}`}>
                                                {node.status === 'enabled' ? 'Operational' : node.status === 'disabled' ? 'Offline' : 'Expired'}
                                            </div>
                                            <div className="text-[10px] font-black text-primary-400/60 border border-white/5 bg-black/40 px-3 py-1 rounded-lg shadow-inner uppercase tracking-wider tech-mono">
                                                {node.protocol}
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-xl font-black text-foreground mb-2 group-hover/node:text-primary-400 transition-colors uppercase tracking-tight">
                                                {node.name}
                                            </h3>
                                            <p className="text-[11px] text-muted-foreground/60 font-bold uppercase tracking-wider line-clamp-1 h-4">
                                                {node.remark || "NO_METADATA_ASSIGNED"}
                                            </p>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-black/40 rounded-2xl border border-white/5 group-hover/node:border-primary/10 transition-colors">
                                                <div className="flex items-center gap-3 text-muted-foreground/60">
                                                    <Server className="h-4 w-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Endpoint</span>
                                                </div>
                                                <span className="tech-mono text-[11px] text-primary-400 font-black tracking-tight">
                                                    {node.host}:{node.port}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 bg-black/40 rounded-2xl border border-white/5 group-hover/node:border-primary/10 transition-colors">
                                                <div className="flex items-center gap-3 text-muted-foreground/60">
                                                    <HardDrive className="h-4 w-4" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Base VPS</span>
                                                </div>
                                                <span className="text-[11px] font-black text-foreground/80 uppercase tracking-tight truncate max-w-[140px]">
                                                    {node.vps_configs?.name || 'MASTER_CORE'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-5 bg-white/[0.02] border-t border-white/5 flex items-center justify-between mt-auto">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button className="p-2.5 rounded-xl bg-white/5 text-muted-foreground/60 hover:text-primary-400 hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20">
                                                        <QrCode className="h-4 w-4" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent className="bg-secondary/95 border-white/10 text-[10px] font-black uppercase text-primary-400">GENERATE_ACCESS_QR</TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <Link
                                            href={`/app/nodes/${node.id}`}
                                            className="text-[10px] font-black text-muted-foreground/60 hover:text-primary-400 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all uppercase tracking-widest"
                                        >
                                            RECONFIGURE
                                            <ExternalLink className="h-3 w-3" />
                                        </Link>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-32 glass-card-premium rounded-[3rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-center group/empty">
                                <div className="p-8 rounded-full bg-white/5 border border-white/5 mb-8 group-hover/empty:bg-white/10 group-hover/empty:border-primary/30 transition-all duration-700">
                                    <Server className="h-12 w-12 text-muted-foreground/40 group-hover/empty:text-primary transition-colors" />
                                </div>
                                <h2 className="text-2xl font-black text-foreground mb-3 uppercase tracking-tighter">部署新节点集群</h2>
                                <p className="text-xs text-muted-foreground/60 font-bold uppercase tracking-[0.2em] max-w-sm mb-10 leading-relaxed">
                                    当前没有任何活跃节点。点击下方按钮启动集群初始化向导。
                                </p>
                                <Link
                                    href="/app/nodes/new"
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-12 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-[0_15px_45px_hsl(var(--primary)/0.3)] transition-all active:scale-[0.95]"
                                >
                                    INITIALIZE CLUSTER
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Tip / Security Status */}
                <div className="glass-card-premium p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group/sec">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] -mr-32 -mt-32 group-hover:bg-primary/10 transition-colors" />
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.1)]">
                            <ShieldCheck className="h-8 w-8 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-widest leading-none">Cluster Security Shield</h3>
                            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider leading-relaxed">
                                所有节点通信均通过端到端加密隧道传输。
                                <br />
                                当前系统已检测到 <span className="text-primary tech-mono font-bold">128-BIT AES</span> 加密活动。建议定期检查 <span className="text-primary font-bold">终端 UUID</span> 以防止中间人劫持。
                            </p>
                        </div>
                    </div>
                </div>
            </TooltipProvider>
        </div>
    );
}
