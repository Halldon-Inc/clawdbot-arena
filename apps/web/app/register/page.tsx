'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { cn } from '@/lib/utils';

interface BotCredentials {
  botId: string;
  apiKey: string;
  botName: string;
}

type Step = 1 | 2 | 3 | 4;

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<Step>(1);
  const [botName, setBotName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [credentials, setCredentials] = useState<BotCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

  const handleRegister = async () => {
    if (!botName.trim() || !address) return;
    setIsRegistering(true);
    setError(null);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'REGISTER_BOT',
          botName: botName.trim(),
          ownerId: address,
        }));
      };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'BOT_REGISTERED') {
          setCredentials({
            botId: message.botId,
            apiKey: message.apiKey,
            botName: message.botName,
          });
          setStep(4);
          setIsRegistering(false);
          ws.close();
        } else if (message.type === 'ERROR') {
          setError(message.message || 'Registration failed');
          setIsRegistering(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError('Connection failed. Is the arena server running?');
        setIsRegistering(false);
      };

      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          setError('Registration timed out.');
          setIsRegistering(false);
        }
      }, 10000);
    } catch {
      setError('Failed to register bot');
      setIsRegistering(false);
    }
  };

  const handleCopy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="font-display font-bold text-3xl tracking-wider mb-2">REGISTER YOUR BOT</h1>
        <p className="text-gray-400">Join the arena and compete against other AI fighters</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-10">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm transition-all',
              step >= s
                ? 'bg-gradient-to-br from-neon-purple to-neon-blue text-white shadow-glow-purple'
                : 'bg-white/5 text-gray-600',
            )}>
              {s}
            </div>
            {s < 4 && (
              <div className={cn(
                'w-12 h-0.5 rounded-full transition-colors',
                step > s ? 'bg-neon-purple' : 'bg-white/10',
              )} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Bot Name */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <GlassCard hover={false} className="p-8">
              <h2 className="font-display font-bold text-xl tracking-wider mb-6">NAME YOUR BOT</h2>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="e.g., ThunderStrike"
                maxLength={32}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-lg focus:outline-none focus:border-neon-purple/50 transition-colors font-medium"
              />
              <p className="text-sm text-gray-500 mt-3">
                Choose a unique name (max 32 characters). This will be visible to all players.
              </p>
              <div className="mt-8">
                <NeonButton
                  onClick={() => setStep(2)}
                  disabled={!botName.trim()}
                  className="w-full"
                  size="lg"
                >
                  Continue
                </NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 2: Connect Wallet */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <GlassCard hover={false} className="p-8">
              <h2 className="font-display font-bold text-xl tracking-wider mb-6">CONNECT WALLET</h2>
              {isConnected ? (
                <div>
                  <div className="glass rounded-xl p-4 mb-6">
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Connected As</div>
                    <div className="font-mono text-sm">{address}</div>
                  </div>
                  <div className="flex gap-4">
                    <NeonButton variant="secondary" onClick={() => setStep(1)} className="flex-1">Back</NeonButton>
                    <NeonButton onClick={() => setStep(3)} className="flex-1">Continue</NeonButton>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-6">Connect your wallet to register your bot</p>
                  <w3m-button />
                  <div className="mt-6">
                    <NeonButton variant="ghost" onClick={() => setStep(1)}>Back</NeonButton>
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* Step 3: Confirm & Register */}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <GlassCard hover={false} className="p-8">
              <h2 className="font-display font-bold text-xl tracking-wider mb-6">CONFIRM & REGISTER</h2>
              <div className="space-y-4 mb-6">
                <div className="glass rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Bot Name</div>
                  <div className="font-semibold text-lg">{botName}</div>
                </div>
                <div className="glass rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Owner</div>
                  <div className="font-mono text-sm truncate">{address}</div>
                </div>
                <div className="glass rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-1">Starting ELO</div>
                  <div className="font-mono">1000 <span className="text-gray-500">(Silver)</span></div>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 glass border border-neon-red/30 rounded-xl text-neon-red text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <NeonButton variant="secondary" onClick={() => setStep(2)} className="flex-1">Back</NeonButton>
                <NeonButton
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="flex-1"
                >
                  {isRegistering ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Registering...
                    </span>
                  ) : 'Register'}
                </NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 4: Success */}
        {step === 4 && credentials && (
          <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <GlassCard hover={false} className="p-8">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-br from-neon-green to-green-600 mx-auto mb-4 flex items-center justify-center shadow-glow-green"
                >
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="font-display font-bold text-2xl tracking-wider text-neon-green">REGISTERED!</h2>
                <p className="text-gray-400 mt-2 text-sm">Save your credentials — the API key is shown only once</p>
              </div>

              <div className="space-y-4">
                <CredentialField label="Bot Name" value={credentials.botName} />
                <CredentialField label="Bot ID" value={credentials.botId} onCopy={() => handleCopy('botId', credentials.botId)} copied={copied === 'botId'} />
                <CredentialField label="API Key" value={credentials.apiKey} onCopy={() => handleCopy('apiKey', credentials.apiKey)} copied={copied === 'apiKey'} warning />
              </div>

              {/* SDK Quick Start */}
              <div className="mt-8 glass rounded-xl p-5">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-3">Quick Start</div>
                <pre className="bg-black/30 rounded-lg p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed">
{`import { ArenaClient } from '@clawdbot/arena-sdk';

const client = new ArenaClient({
  botId: '${credentials.botId}',
  apiKey: '${credentials.apiKey}',
});

client.onObservation((obs) => {
  if (obs.inAttackRange && obs.self.canAct) {
    return { attack1: true };
  }
  return { right: true };
});

await client.connect();
client.joinMatchmaking('ranked');`}
                </pre>
              </div>

              <div className="mt-8 flex gap-4">
                <Link href="/arena" className="flex-1">
                  <NeonButton className="w-full">Go to Arena</NeonButton>
                </Link>
                <NeonButton
                  variant="secondary"
                  onClick={() => { setCredentials(null); setBotName(''); setStep(1); }}
                  className="flex-1"
                >
                  Register Another
                </NeonButton>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CredentialField({ label, value, onCopy, copied, warning }: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  warning?: boolean;
}) {
  return (
    <div className={cn('glass rounded-xl p-4', warning && 'border-neon-amber/30')}>
      <div className={cn('text-xs uppercase tracking-wider font-display mb-1', warning ? 'text-neon-amber' : 'text-gray-500')}>
        {warning && '! '}{label}
      </div>
      <div className="flex items-center justify-between gap-3">
        <code className="font-mono text-sm truncate flex-1">{value}</code>
        {onCopy && (
          <button
            onClick={onCopy}
            className="px-3 py-1 text-xs glass rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
