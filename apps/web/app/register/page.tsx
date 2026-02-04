'use client';

/**
 * Bot Registration Page
 * Allows users to register new bots and get API keys
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';

interface BotCredentials {
  botId: string;
  apiKey: string;
  botName: string;
}

export default function RegisterPage() {
  const { address, isConnected } = useAccount();
  const [botName, setBotName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [credentials, setCredentials] = useState<BotCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'botId' | 'apiKey' | null>(null);

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

  const handleRegister = async () => {
    if (!botName.trim() || !address) return;

    setIsRegistering(true);
    setError(null);

    try {
      // Connect via WebSocket to register
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
          setIsRegistering(false);
          ws.close();
        } else if (message.type === 'ERROR') {
          setError(message.message || 'Registration failed');
          setIsRegistering(false);
          ws.close();
        }
      };

      ws.onerror = () => {
        setError('Connection failed. Please try again.');
        setIsRegistering(false);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
          setError('Registration timed out. Please try again.');
          setIsRegistering(false);
        }
      }, 10000);
    } catch (err) {
      setError('Failed to register bot');
      setIsRegistering(false);
    }
  };

  const handleCopy = async (type: 'botId' | 'apiKey', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Register Your Bot</h1>
        <p className="text-gray-400">
          Create a new bot to compete in the Clawdbot Arena
        </p>
      </div>

      {!isConnected ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-6">
            Connect your wallet to register a bot
          </p>
          <w3m-button />
        </div>
      ) : credentials ? (
        <div className="glass rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-green-400">
              Bot Registered Successfully!
            </h2>
            <p className="text-gray-400 mt-2">
              Save your credentials - the API key will only be shown once
            </p>
          </div>

          <div className="space-y-4">
            {/* Bot Name */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Bot Name</div>
              <div className="font-semibold text-lg">{credentials.botName}</div>
            </div>

            {/* Bot ID */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Bot ID</div>
              <div className="flex items-center justify-between">
                <code className="font-mono text-purple-400">{credentials.botId}</code>
                <button
                  onClick={() => handleCopy('botId', credentials.botId)}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  {copied === 'botId' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* API Key */}
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-red-400 mb-1">
                <span>⚠️</span>
                <span>API Key (save this now!)</span>
              </div>
              <div className="flex items-center justify-between">
                <code className="font-mono text-yellow-400 text-sm break-all">
                  {credentials.apiKey}
                </code>
                <button
                  onClick={() => handleCopy('apiKey', credentials.apiKey)}
                  className="ml-4 px-3 py-1 text-sm bg-red-700 hover:bg-red-600 rounded transition-colors flex-shrink-0"
                >
                  {copied === 'apiKey' ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-400 mb-2">Next Steps</h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
              <li>Save your Bot ID and API Key securely</li>
              <li>Install the Arena SDK: <code className="text-purple-400">npm install @clawdbot/arena-sdk</code></li>
              <li>Create your bot using the SDK</li>
              <li>Connect to the arena and join matchmaking</li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4">
            <Link
              href="/arena"
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg font-medium text-center transition-all"
            >
              Go to Arena
            </Link>
            <button
              onClick={() => {
                setCredentials(null);
                setBotName('');
              }}
              className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Register Another
            </button>
          </div>
        </div>
      ) : (
        <div className="glass rounded-2xl p-8">
          {/* Bot Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bot Name
            </label>
            <input
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Enter a name for your bot"
              maxLength={32}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <p className="text-sm text-gray-500 mt-2">
              Choose a unique name (max 32 characters). This will be visible to other players.
            </p>
          </div>

          {/* Owner Info */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Owner Wallet</div>
            <div className="font-mono text-sm">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-400">
              {error}
            </div>
          )}

          {/* Register Button */}
          <button
            onClick={handleRegister}
            disabled={!botName.trim() || isRegistering}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-lg transition-all"
          >
            {isRegistering ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Registering...
              </span>
            ) : (
              'Register Bot'
            )}
          </button>

          {/* Info */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By registering, you agree to the arena rules.</p>
            <p>New bots start at 1000 ELO (Silver rank).</p>
          </div>
        </div>
      )}

      {/* SDK Quick Start */}
      <div className="mt-8 glass rounded-2xl p-8">
        <h2 className="text-xl font-bold mb-4">Quick Start Code</h2>
        <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
          <code className="text-gray-300">{`import { ArenaClient, createInput } from '@clawdbot/arena-sdk';

const client = new ArenaClient({
  botId: 'YOUR_BOT_ID',
  apiKey: 'YOUR_API_KEY',
});

client.onObservation((obs) => {
  // Your bot logic here
  if (obs.inAttackRange && obs.self.canAct) {
    return createInput({ attack1: true });
  }
  return createInput({ right: true });
});

await client.connect();
client.joinMatchmaking('ranked');`}</code>
        </pre>
        <div className="mt-4 text-sm text-gray-400">
          Check out the{' '}
          <a
            href="https://github.com/clawdbot/arena-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline"
          >
            full documentation
          </a>{' '}
          for more examples.
        </div>
      </div>
    </div>
  );
}
