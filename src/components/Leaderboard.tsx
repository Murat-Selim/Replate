'use client';

export default function Leaderboard() {
    const leaders = [
        { name: 'Vitalik.eth', xp: 2400, saved: 45.2, avatar: '👤' },
        { name: 'BaseUser1', xp: 1850, saved: 32.1, avatar: '👤' },
        { name: 'EcoWarrior', xp: 1200, saved: 21.5, avatar: '👤' },
        { name: 'ZeroWasteFan', xp: 950, saved: 15.8, avatar: '👤' },
        { name: 'Jessy.base', xp: 450, saved: 8.2, avatar: '👤' },
    ];

    return (
        <div className="animate-fadeIn space-y-10 pb-12">
            <div className="text-center space-y-2 pt-6">
                <h2 className="text-4xl font-extrabold text-primary tracking-tight">Leaderboard</h2>
                <p className="text-sm font-medium text-text-muted">Top waste-preventers on Base</p>
            </div>

            <div className="space-y-4">
                {leaders.map((leader, index) => (
                    <div
                        key={leader.name}
                        className={`flex items-center justify-between p-6 rounded-[32px] border transition-all ${index === 0
                                ? 'bg-primary text-white border-primary shadow-xl scale-105'
                                : 'bg-white/40 border-primary/5 shadow-sm'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <span className={`text-xl font-black w-8 ${index === 0 ? 'text-white' : 'text-primary/40'}`}>
                                {index + 1}
                            </span>
                            <div className="text-2xl">{leader.avatar}</div>
                            <div className="flex flex-col">
                                <span className="font-extrabold tracking-tight">{leader.name}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${index === 0 ? 'text-white/60' : 'text-primary/40'}`}>
                                    {leader.saved}kg CO2 Saved
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-xl font-black">{leader.xp}</span>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${index === 0 ? 'text-white/40' : 'text-primary/20'}`}>
                                XP
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-8 bg-primary/5 rounded-[40px] text-center">
                <p className="text-xs text-primary font-bold uppercase tracking-[0.2em] mb-2 opacity-50">Your Rank</p>
                <div className="flex justify-between items-center px-4">
                    <span className="text-2xl font-black">#42</span>
                    <span className="text-sm font-bold text-primary">Next rank in 50 XP</span>
                </div>
            </div>
        </div>
    );
}
