import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-neon-purple to-neon-blue flex items-center justify-center text-[10px] font-bold">
              CA
            </div>
            <span className="text-sm text-gray-500">Clawdbot Arena</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/arena" className="hover:text-white transition-colors">Arena</Link>
            <Link href="/leaderboard" className="hover:text-white transition-colors">Rankings</Link>
            <Link href="/register" className="hover:text-white transition-colors">Register</Link>
          </div>

          <div className="text-xs text-gray-600 font-mono">
            Built on Base
          </div>
        </div>
      </div>
    </footer>
  );
}
