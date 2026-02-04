'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeonButton } from '@/components/ui/NeonButton';
import { cn } from '@/lib/utils';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showModal, setShowModal] = useState(false);

  if (isConnected && address) {
    return (
      <NeonButton
        variant="secondary"
        size="sm"
        onClick={() => disconnect()}
        className="font-mono"
      >
        <span className="w-2 h-2 bg-neon-green rounded-full mr-2 inline-block" />
        {address.slice(0, 6)}...{address.slice(-4)}
      </NeonButton>
    );
  }

  return (
    <>
      <NeonButton
        size="sm"
        onClick={() => setShowModal(true)}
        disabled={isPending}
      >
        {isPending ? 'Connecting...' : 'Connect'}
      </NeonButton>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-md border border-white/10"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-lg tracking-wider">CONNECT WALLET</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                {connectors.map((connector) => (
                  <button
                    key={connector.uid}
                    onClick={() => {
                      connect({ connector });
                      setShowModal(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 glass-hover rounded-xl transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-lg">
                      {connector.name === 'MetaMask' && (
                        <svg className="w-6 h-6 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                          <rect width="24" height="24" fill="#E4761B" rx="4"/>
                        </svg>
                      )}
                      {connector.name !== 'MetaMask' && (
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{connector.name}</div>
                      <div className="text-xs text-gray-500">
                        {connector.name === 'Injected' ? 'Browser wallet' : `Connect with ${connector.name}`}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
