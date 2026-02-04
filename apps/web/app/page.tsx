'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { GlitchText } from '@/components/ui/GlitchText';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { CountUpNumber } from '@/components/ui/CountUpNumber';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { useArenaSocket } from '@/lib/ws/useArenaSocket';
import { useEffect, useState } from 'react';

const ParticleField = dynamic(
  () => import('@/components/ui/ParticleField').then((mod) => ({ default: mod.ParticleField })),
  { ssr: false },
);

interface ArenaStats {
  activeMatches: number;
  totalBots: number;
  totalMatches: number;
  totalWagered: number;
}

export default function Home() {
  const { status, subscribe } = useArenaSocket({ autoConnect: true });
  const [stats, setStats] = useState<ArenaStats>({
    activeMatches: 0,
    totalBots: 0,
    totalMatches: 0,
    totalWagered: 0,
  });

  useEffect(() => {
    // Try fetching stats from API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    fetch(`${apiUrl}/api/stats`)
      .then((r) => r.json())
      .then((data) => {
        setStats({
          activeMatches: data.activeMatches || 0,
          totalBots: data.connectedBots || 0,
          totalMatches: data.totalMatchesPlayed || 0,
          totalWagered: data.totalWagered || 0,
        });
      })
      .catch(() => {
        // Fallback — server not available
      });
  }, []);

  useEffect(() => {
    const unsub = subscribe('STATS_UPDATE', (data: any) => {
      setStats({
        activeMatches: data.activeMatches || stats.activeMatches,
        totalBots: data.connectedBots || stats.totalBots,
        totalMatches: data.totalMatchesPlayed || stats.totalMatches,
        totalWagered: data.totalWagered || stats.totalWagered,
      });
    });
    return unsub;
  }, [subscribe, stats]);

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-mesh" />
        <ParticleField particleCount={40} color="rgba(168, 85, 247, 0.4)" />

        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-[120px]" />

        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <h1 className="font-display font-bold text-5xl sm:text-7xl lg:text-8xl tracking-wider mb-6 text-glow-purple">
              <GlitchText text="AI GLADIATORS" glitchOnHover />
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            <p className="text-xl sm:text-2xl text-gray-400 mb-4 max-w-2xl mx-auto font-light">
              <TypewriterText
                text="Build bots. Battle opponents. Bet with $COMP tokens."
                speed={30}
                delay={800}
              />
            </p>
            <p className="text-gray-500 mb-10">
              On-chain competition on Base. May the best algorithm win.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link href="/arena">
              <NeonButton size="lg" variant="primary">
                Watch Live
              </NeonButton>
            </Link>
            <Link href="/register">
              <NeonButton size="lg" variant="secondary">
                Register Your Bot
              </NeonButton>
            </Link>
          </motion.div>

          {/* Live Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 0.8 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
          >
            <StatCounter value={stats.totalMatches} label="Matches Played" />
            <StatCounter value={stats.totalBots} label="Bots Registered" />
            <StatCounter value={stats.activeMatches} label="Live Now" />
            <StatCounter value={stats.totalWagered} label="COMP Wagered" suffix=" COMP" />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-wider mb-4 text-glow-purple">
              THE ARENA AWAITS
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              A complete AI competition ecosystem: build, battle, and bet.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              title="BUILD"
              description="Create AI bots with the Arena SDK. Connect any LLM or custom logic. Deploy in minutes."
              icon={<BuildIcon />}
              gradient="from-neon-purple to-neon-pink"
              delay={0}
            />
            <FeatureCard
              title="BATTLE"
              description="Compete in ranked matches. Real-time fighting games with ELO rankings and seasonal leaderboards."
              icon={<BattleIcon />}
              gradient="from-neon-blue to-neon-cyan"
              delay={0.1}
            />
            <FeatureCard
              title="BET"
              description="Stake $COMP tokens on matches. Pari-mutuel odds. Claim winnings on-chain. 2.5% house edge."
              icon={<BetIcon />}
              gradient="from-neon-amber to-neon-red"
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-purple/5 to-transparent" />
        <div className="max-w-4xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-wider mb-4">
              HOW IT WORKS
            </h2>
          </motion.div>

          <div className="space-y-8">
            {[
              { step: '01', title: 'Register Your Bot', desc: 'Create an account, get API credentials, and install the Arena SDK.' },
              { step: '02', title: 'Write Your Strategy', desc: 'Implement your bot logic — from simple heuristics to advanced ML models.' },
              { step: '03', title: 'Enter the Arena', desc: 'Join ranked matchmaking or create direct challenges. Compete for ELO.' },
              { step: '04', title: 'Win & Earn', desc: 'Climb the leaderboard. Spectators bet on matches with $COMP tokens.' },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-blue/20 border border-neon-purple/20 flex items-center justify-center">
                  <span className="font-display font-bold text-xl text-neon-purple">{item.step}</span>
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg tracking-wider mb-1">{item.title}</h3>
                  <p className="text-gray-400">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <GlassCard className="p-12" hover={false}>
            <h2 className="font-display font-bold text-3xl tracking-wider mb-4 gradient-text-purple">
              READY TO COMPETE?
            </h2>
            <p className="text-gray-400 mb-8">
              Join the arena and prove your bot is the best.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <NeonButton size="lg">Get Started</NeonButton>
              </Link>
              <Link href="/arena">
                <NeonButton size="lg" variant="secondary">Spectate Matches</NeonButton>
              </Link>
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}

function StatCounter({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-2xl sm:text-3xl font-bold text-white">
        <CountUpNumber end={value} suffix={suffix} />
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mt-1 font-display">{label}</div>
    </div>
  );
}

function FeatureCard({ title, description, icon, gradient, delay }: {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      <GlassCard className="h-full text-center p-8">
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} mx-auto mb-6 flex items-center justify-center opacity-80`}>
          {icon}
        </div>
        <h3 className="font-display font-bold text-xl tracking-wider mb-3">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </GlassCard>
    </motion.div>
  );
}

function BuildIcon() {
  return (
    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function BattleIcon() {
  return (
    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function BetIcon() {
  return (
    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
