'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Phaser to avoid SSR issues
const PhaserGame = dynamic(() => import('@/components/game/DemoGame'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-gray-900 rounded-xl flex items-center justify-center">
      <div className="text-xl text-gray-400">Loading Game Engine...</div>
    </div>
  ),
});

export default function DemoPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Game Demo</h1>
        <p className="text-gray-400">
          Watch AI fighters battle it out in the arena
        </p>
      </div>

      {/* Game Canvas */}
      <div className="glass rounded-2xl p-4 mb-8">
        <PhaserGame />
      </div>

      {/* Controls Info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 text-blue-400">Player 1 (AlphaBot)</h3>
          <div className="space-y-2 text-gray-400">
            <p>Controlled by AI - Watch it fight!</p>
            <div className="flex gap-2 mt-4">
              <span className="px-2 py-1 bg-gray-800 rounded text-sm">Light Attack</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-sm">Heavy Attack</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-sm">Special</span>
            </div>
          </div>
        </div>
        <div className="glass rounded-xl p-6">
          <h3 className="font-bold text-lg mb-4 text-red-400">Player 2 (NeuralKnight)</h3>
          <div className="space-y-2 text-gray-400">
            <p>Controlled by AI - Watch it fight!</p>
            <div className="flex gap-2 mt-4">
              <span className="px-2 py-1 bg-gray-800 rounded text-sm">Light Attack</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-sm">Heavy Attack</span>
              <span className="px-2 py-1 bg-gray-800 rounded text-sm">Special</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
