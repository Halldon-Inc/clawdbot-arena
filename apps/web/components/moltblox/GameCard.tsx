'use client';

import Link from 'next/link';
import Image from 'next/image';

interface GameCardProps {
  game: {
    gameId: string;
    name: string;
    shortDescription: string;
    thumbnail: string;
    category: string;
    creatorBotId: string;
    averageRating: number;
    totalPlays: number;
    totalRevenue: string;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  arcade: 'bg-purple-500/20 text-purple-400',
  puzzle: 'bg-blue-500/20 text-blue-400',
  strategy: 'bg-green-500/20 text-green-400',
  action: 'bg-red-500/20 text-red-400',
  rpg: 'bg-yellow-500/20 text-yellow-400',
  simulation: 'bg-cyan-500/20 text-cyan-400',
  sports: 'bg-orange-500/20 text-orange-400',
  card: 'bg-pink-500/20 text-pink-400',
  board: 'bg-indigo-500/20 text-indigo-400',
  other: 'bg-gray-500/20 text-gray-400',
};

export function GameCard({ game }: GameCardProps) {
  const categoryColor = CATEGORY_COLORS[game.category] || CATEGORY_COLORS.other;

  // Format play count
  const formatPlays = (plays: number) => {
    if (plays >= 1000) {
      return `${(plays / 1000).toFixed(1)}k`;
    }
    return plays.toString();
  };

  // Render star rating
  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center gap-0.5">
        {[...Array(fullStars)].map((_, i) => (
          <span key={`full-${i}`} className="text-yellow-400">
            ★
          </span>
        ))}
        {hasHalfStar && <span className="text-yellow-400">½</span>}
        {[...Array(emptyStars)].map((_, i) => (
          <span key={`empty-${i}`} className="text-gray-600">
            ★
          </span>
        ))}
        <span className="ml-1 text-sm text-gray-400">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Link
      href={`/moltblox/${game.gameId}`}
      className="group block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-800">
        <div className="absolute inset-0 flex items-center justify-center text-4xl">
          {game.category === 'arcade' && '👾'}
          {game.category === 'puzzle' && '🧩'}
          {game.category === 'strategy' && '♟️'}
          {game.category === 'action' && '⚔️'}
          {game.category === 'rpg' && '🗡️'}
          {game.category === 'simulation' && '🏗️'}
          {!['arcade', 'puzzle', 'strategy', 'action', 'rpg', 'simulation'].includes(game.category) && '🎮'}
        </div>
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-purple-600/0 group-hover:bg-purple-600/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-purple-600 px-4 py-2 rounded-lg font-medium">
            Play Now
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category Badge */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs px-2 py-1 rounded-full ${categoryColor}`}>
            {game.category}
          </span>
          <span className="text-xs text-gray-500">
            by {game.creatorBotId.slice(0, 12)}...
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-lg mb-1 group-hover:text-purple-400 transition-colors">
          {game.name}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-400 line-clamp-2 mb-3">
          {game.shortDescription}
        </p>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm">
          {/* Rating */}
          {renderStars(game.averageRating)}

          {/* Plays */}
          <div className="flex items-center gap-1 text-gray-400">
            <span>▶</span>
            <span>{formatPlays(game.totalPlays)}</span>
          </div>
        </div>

        {/* Revenue */}
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500">Creator Earned</span>
          <span className="text-sm font-medium text-green-400">
            {game.totalRevenue} COMP
          </span>
        </div>
      </div>
    </Link>
  );
}
