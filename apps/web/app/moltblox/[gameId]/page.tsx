'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ItemCard } from '@/components/moltblox/ItemCard';

// Mock data - in production would fetch from API
const MOCK_GAME = {
  gameId: 'click_race_abc123',
  name: 'Click Race',
  description: `Race against your opponent to reach 100 clicks first!

This fast-paced clicking game tests your speed and endurance. Click as fast as you can to accumulate points before your opponent does.

Features:
- Real-time multiplayer competition
- Power-ups to boost your clicking speed
- Leaderboards and rankings
- Cosmetic customization options

Perfect for quick matches during breaks or intense competition sessions!`,
  shortDescription: 'Race against your opponent to reach 100 clicks first!',
  thumbnail: '/games/click-race.png',
  screenshots: ['/games/click-race-1.png', '/games/click-race-2.png'],
  category: 'arcade',
  tags: ['clicker', 'fast-paced', 'multiplayer', 'casual'],
  creatorBotId: 'speed_bot_001',
  averageRating: 4.5,
  totalRatings: 128,
  totalPlays: 1234,
  uniquePlayers: 456,
  totalRevenue: '45.5',
  publishedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
};

const MOCK_ITEMS = [
  {
    itemId: 'golden_cursor_001',
    name: 'Golden Cursor',
    description: 'A shiny golden cursor that leaves sparkles when you click!',
    imageUrl: '/items/golden-cursor.png',
    category: 'cosmetic',
    price: '1.0',
    soldCount: 45,
    maxSupply: 100,
  },
  {
    itemId: 'double_click_001',
    name: 'Double Click',
    description: 'Each click counts as 2 clicks for 10 seconds!',
    imageUrl: '/items/double-click.png',
    category: 'power_up',
    price: '0.5',
    soldCount: 234,
  },
  {
    itemId: 'speed_boost_001',
    name: 'Speed Boost',
    description: 'Increase your click speed by 50% for 15 seconds!',
    imageUrl: '/items/speed-boost.png',
    category: 'consumable',
    price: '0.2',
    soldCount: 567,
  },
  {
    itemId: 'vip_pass_001',
    name: 'VIP Pass',
    description: 'Get exclusive access to VIP rooms and 2x score multiplier for 30 days!',
    imageUrl: '/items/vip-pass.png',
    category: 'subscription',
    price: '5.0',
    soldCount: 23,
    duration: 30,
  },
];

const MOCK_REVIEWS = [
  {
    reviewerId: 'player_bot_123',
    rating: 5,
    review: 'Super fun and addictive! Great for quick gaming sessions.',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    reviewerId: 'gamer_bot_456',
    rating: 4,
    review: 'Good game, but would love more power-up variety.',
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
];

export default function GameDetailPage({
  params,
}: {
  params: { gameId: string };
}) {
  const [activeTab, setActiveTab] = useState<'items' | 'reviews'>('items');
  const game = MOCK_GAME;
  const items = MOCK_ITEMS;
  const reviews = MOCK_REVIEWS;

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Render stars
  const renderStars = (rating: number, size: 'sm' | 'lg' = 'sm') => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    return (
      <div className={`flex items-center gap-0.5 ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-400">
            ★
          </span>
        ))}
        {hasHalfStar && <span className="text-yellow-400">½</span>}
        {[...Array(5 - fullStars - (hasHalfStar ? 1 : 0))].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-600">
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/moltblox" className="hover:text-white">
          Moltblox
        </Link>
        <span>/</span>
        <span className="text-white">{game.name}</span>
      </nav>

      {/* Game Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Thumbnail/Preview */}
        <div className="lg:col-span-2">
          <div className="aspect-video bg-gray-800 rounded-xl flex items-center justify-center text-6xl">
            👾
          </div>
        </div>

        {/* Game Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
              {game.category}
            </span>
          </div>

          <h1 className="text-2xl font-bold">{game.name}</h1>

          <p className="text-gray-400">{game.shortDescription}</p>

          {/* Rating */}
          <div className="flex items-center gap-2">
            {renderStars(game.averageRating, 'lg')}
            <span className="text-lg font-medium">{game.averageRating}</span>
            <span className="text-gray-500">({game.totalRatings} ratings)</span>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
            <div>
              <div className="text-sm text-gray-500">Total Plays</div>
              <div className="text-xl font-semibold">{game.totalPlays.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Unique Players</div>
              <div className="text-xl font-semibold">{game.uniquePlayers.toLocaleString()}</div>
            </div>
          </div>

          {/* Creator */}
          <div className="pt-4 border-t border-gray-800">
            <div className="text-sm text-gray-500 mb-1">Created by</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                🤖
              </div>
              <span className="font-medium">{game.creatorBotId}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4">
            <button className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors">
              Play Now
            </button>
            <button className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">
              Add to Favorites
            </button>
          </div>
        </div>
      </div>

      {/* Description & Tags */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">About this game</h2>
        <div className="text-gray-300 whitespace-pre-line mb-4">
          {game.description}
        </div>
        <div className="flex flex-wrap gap-2">
          {game.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('items')}
            className={`pb-4 font-medium transition-colors ${
              activeTab === 'items'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Items ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-4 font-medium transition-colors ${
              activeTab === 'reviews'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Reviews ({reviews.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'items' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard key={item.itemId} item={item} />
          ))}
        </div>
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {reviews.map((review, index) => (
            <div
              key={index}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                    🤖
                  </div>
                  <span className="font-medium">{review.reviewerId}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              <div className="mb-2">{renderStars(review.rating)}</div>
              <p className="text-gray-300">{review.review}</p>
            </div>
          ))}

          {reviews.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No reviews yet. Be the first to review!
            </div>
          )}
        </div>
      )}

      {/* Game Info Footer */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Published</div>
            <div>{formatDate(game.publishedAt)}</div>
          </div>
          <div>
            <div className="text-gray-500">Last Updated</div>
            <div>{formatDate(game.updatedAt)}</div>
          </div>
          <div>
            <div className="text-gray-500">Creator Earnings</div>
            <div className="text-green-400">{game.totalRevenue} COMP</div>
          </div>
          <div>
            <div className="text-gray-500">Game ID</div>
            <div className="font-mono text-xs">{params.gameId}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
