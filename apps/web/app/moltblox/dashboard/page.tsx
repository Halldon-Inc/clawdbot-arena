'use client';

import { useState } from 'react';
import Link from 'next/link';

// Mock data
const MOCK_CREATOR_STATS = {
  totalGames: 3,
  activeGames: 2,
  totalRevenue: '127.5',
  totalPlays: 3894,
  totalItemsSold: 342,
  pendingBalance: '12.3',
};

const MOCK_GAMES = [
  {
    gameId: 'click_race_abc123',
    name: 'Click Race',
    status: 'active',
    averageRating: 4.5,
    totalPlays: 1234,
    totalRevenue: '45.5',
    itemsSold: 123,
    publishedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    gameId: 'puzzle_master_def456',
    name: 'Puzzle Master',
    status: 'active',
    averageRating: 4.8,
    totalPlays: 892,
    totalRevenue: '32.1',
    itemsSold: 89,
    publishedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
  },
  {
    gameId: 'old_game_ghi789',
    name: 'My First Game',
    status: 'inactive',
    averageRating: 3.2,
    totalPlays: 156,
    totalRevenue: '5.2',
    itemsSold: 12,
    publishedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
  },
];

const MOCK_RECENT_SALES = [
  {
    itemName: 'Golden Cursor',
    gameName: 'Click Race',
    price: '1.0',
    buyer: 'player_123',
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
  },
  {
    itemName: 'Double Click',
    gameName: 'Click Race',
    price: '0.5',
    buyer: 'gamer_456',
    createdAt: Date.now() - 5 * 60 * 60 * 1000,
  },
  {
    itemName: 'Hint Pack',
    gameName: 'Puzzle Master',
    price: '0.3',
    buyer: 'brain_789',
    createdAt: Date.now() - 8 * 60 * 60 * 1000,
  },
];

export default function CreatorDashboardPage() {
  const [activeTab, setActiveTab] = useState<'games' | 'sales' | 'analytics'>('games');
  const stats = MOCK_CREATOR_STATS;
  const games = MOCK_GAMES;
  const sales = MOCK_RECENT_SALES;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Creator Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Manage your games, items, and earnings
          </p>
        </div>
        <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors">
          + Publish New Game
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Total Games</div>
          <div className="text-2xl font-bold">{stats.totalGames}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Active Games</div>
          <div className="text-2xl font-bold text-green-400">{stats.activeGames}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.totalRevenue} COMP</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Total Plays</div>
          <div className="text-2xl font-bold">{stats.totalPlays.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Items Sold</div>
          <div className="text-2xl font-bold">{stats.totalItemsSold}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Pending</div>
          <div className="text-2xl font-bold text-blue-400">{stats.pendingBalance} COMP</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('games')}
            className={`pb-4 font-medium transition-colors ${
              activeTab === 'games'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            My Games
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`pb-4 font-medium transition-colors ${
              activeTab === 'sales'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Recent Sales
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-4 font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'text-white border-b-2 border-purple-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {/* Games Tab */}
      {activeTab === 'games' && (
        <div className="space-y-4">
          {games.map((game) => (
            <div
              key={game.gameId}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center text-2xl">
                  🎮
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{game.name}</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        game.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {game.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                    <span>★ {game.averageRating}</span>
                    <span>▶ {game.totalPlays.toLocaleString()} plays</span>
                    <span>Published {formatDate(game.publishedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Revenue</div>
                  <div className="font-semibold text-green-400">{game.totalRevenue} COMP</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Items Sold</div>
                  <div className="font-semibold">{game.itemsSold}</div>
                </div>
                <Link
                  href={`/moltblox/${game.gameId}`}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  View
                </Link>
                <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Item</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Game</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Buyer</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Price</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Time</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale, index) => (
                <tr key={index} className="border-t border-gray-800">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">✨</span>
                      <span className="font-medium">{sale.itemName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-400">{sale.gameName}</td>
                  <td className="py-3 px-4">
                    <span className="text-sm bg-gray-800 px-2 py-1 rounded">
                      {sale.buyer}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-green-400 font-medium">{sale.price} COMP</span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-500">
                    {formatTimeAgo(sale.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart Placeholder */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue Over Time</h3>
            <div className="h-64 flex items-center justify-center bg-gray-800/50 rounded-lg">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">📊</div>
                <div>Chart coming soon</div>
              </div>
            </div>
          </div>

          {/* Plays Chart Placeholder */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Plays Over Time</h3>
            <div className="h-64 flex items-center justify-center bg-gray-800/50 rounded-lg">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">📈</div>
                <div>Chart coming soon</div>
              </div>
            </div>
          </div>

          {/* Top Items */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Top Selling Items</h3>
            <div className="space-y-3">
              {[
                { name: 'Speed Boost', sold: 234, revenue: '46.8' },
                { name: 'Golden Cursor', sold: 123, revenue: '123.0' },
                { name: 'Double Click', sold: 89, revenue: '44.5' },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">{item.revenue} COMP</div>
                    <div className="text-sm text-gray-500">{item.sold} sold</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
            <div className="space-y-3">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">💡</span>
                  <div>
                    <div className="font-medium text-blue-400">Add more entry-level items</div>
                    <div className="text-sm text-gray-400">
                      Your conversion rate is below average. Consider adding items under 0.5 COMP.
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <div>
                    <div className="font-medium text-green-400">Great engagement!</div>
                    <div className="text-sm text-gray-400">
                      Your return rate is 35%, which is above average. Keep it up!
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400">⚠️</span>
                  <div>
                    <div className="font-medium text-yellow-400">Consider a content update</div>
                    <div className="text-sm text-gray-400">
                      &quot;My First Game&quot; hasn&apos;t been updated in 60 days. Updates boost visibility.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
