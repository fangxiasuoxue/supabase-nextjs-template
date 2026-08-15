import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function AuthLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;
    const testimonials = [
        {
            quote: "This template helped us launch our SaaS product in just two weeks. The authentication and multi-tenancy features are rock solid.",
            author: "Sarah Chen",
            role: "CTO, TechStart",
            avatar: "SC"
        },
        {
            quote: "The best part is how well thought out the organization management is. It saved us months of development time.",
            author: "Michael Roberts",
            role: "Founder, DataFlow",
            avatar: "MR"
        },
        {
            quote: "Clean code, great documentation, and excellent support. Exactly what we needed to get our MVP off the ground.",
            author: "Jessica Kim",
            role: "Lead Developer, CloudScale",
            avatar: "JK"
        }
    ];

    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden items-center justify-center p-4">
            <div className="w-full max-w-6xl grid lg:grid-cols-2 glass-card-premium bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden relative z-10">
                {/* Visual Side */}
                <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-cyan-50 to-white border-r border-slate-200">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-cyan-100 border border-cyan-200 flex items-center justify-center">
                                <span className="text-cyan-700 font-black text-xs">J</span>
                            </div>
                            <span className="text-xl font-black tracking-tighter uppercase text-slate-900">{productName} <span className="text-cyan-600">PRO</span></span>
                        </div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.4em] font-black">Next-Gen Node Infrastructure</p>
                    </div>

                    <div className="space-y-8">
                        <h3 className="text-4xl font-black tracking-tighter leading-none uppercase text-slate-900">
                            Secure <br />
                            <span className="text-cyan-600">Identity</span> <br />
                            Terminal
                        </h3>
                        <div className="space-y-4">
                            {testimonials.slice(0, 2).map((testimonial, index) => (
                                <div
                                    key={index}
                                    className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
                                >
                                    <p className="text-xs text-slate-600 font-medium leading-relaxed italic mb-4">
                                        "{testimonial.quote}"
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-[10px] font-black text-cyan-700 border border-cyan-200">
                                            {testimonial.avatar}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">{testimonial.author}</p>
                                            <p className="text-[8px] text-cyan-600 font-black uppercase tracking-tighter lowercase">{testimonial.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-slate-200">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Protocol v4.0.2</span>
                        <div className="flex gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        </div>
                    </div>
                </div>

                {/* Interaction Side */}
                <div className="relative flex flex-col justify-center py-16 px-8 sm:px-12 lg:px-16 bg-white">
                    <Link
                        href="/"
                        className="absolute left-10 top-10 flex items-center text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-600 transition-all group"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 mr-2 group-hover:-translate-x-1 transition-transform" />
                        Return to Origin
                    </Link>

                    <div className="w-full max-w-sm mx-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}