'use client';

import { useAccount, useConnect, useDisconnect, useBalance } from 'wagmi';
import { useState } from 'react';

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });

  const [showModal, setShowModal] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        {/* Balance Display */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg text-sm">
          <span className="text-gray-400">Balance:</span>
          <span className="font-mono text-white">
            {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : '...'}
          </span>
        </div>

        {/* Address & Disconnect */}
        <button
          onClick={() => disconnect()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          <span className="font-mono text-sm">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-semibold transition-all disabled:opacity-50"
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {/* Wallet Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Connect Wallet</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => {
                    connect({ connector });
                    setShowModal(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                >
                  <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                    {connector.name === 'MetaMask' && '🦊'}
                    {connector.name === 'Coinbase Wallet' && '💙'}
                    {connector.name === 'WalletConnect' && '🔗'}
                    {!['MetaMask', 'Coinbase Wallet', 'WalletConnect'].includes(connector.name) && '👛'}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{connector.name}</div>
                    <div className="text-sm text-gray-400">
                      {connector.name === 'MetaMask' && 'Connect using MetaMask'}
                      {connector.name === 'Coinbase Wallet' && 'Connect using Coinbase'}
                      {connector.name === 'WalletConnect' && 'Scan with mobile wallet'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <p className="mt-6 text-center text-sm text-gray-500">
              By connecting, you agree to our Terms of Service
            </p>
          </div>
        </div>
      )}
    </>
  );
}
