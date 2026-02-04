'use client';

interface ItemCardProps {
  item: {
    itemId: string;
    name: string;
    description: string;
    imageUrl: string;
    category: string;
    price: string;
    soldCount: number;
    maxSupply?: number;
    duration?: number;
  };
}

const CATEGORY_ICONS: Record<string, string> = {
  cosmetic: '✨',
  power_up: '⚡',
  access: '🔑',
  consumable: '🎁',
  subscription: '⭐',
};

const CATEGORY_COLORS: Record<string, string> = {
  cosmetic: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  power_up: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  access: 'bg-green-500/20 text-green-400 border-green-500/30',
  consumable: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  subscription: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

export function ItemCard({ item }: ItemCardProps) {
  const icon = CATEGORY_ICONS[item.category] || '📦';
  const colorClasses = CATEGORY_COLORS[item.category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  const isSoldOut = item.maxSupply && item.soldCount >= item.maxSupply;

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-all hover:shadow-lg ${isSoldOut ? 'border-gray-800 opacity-75' : 'border-gray-800 hover:border-purple-500/50'}`}>
      {/* Item Preview */}
      <div className="aspect-square bg-gray-800 flex items-center justify-center text-4xl relative">
        <span>{icon}</span>
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              Sold Out
            </span>
          </div>
        )}
        {item.maxSupply && !isSoldOut && (
          <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs">
            {item.maxSupply - item.soldCount} left
          </div>
        )}
      </div>

      {/* Item Info */}
      <div className="p-4">
        {/* Category Badge */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${colorClasses}`}>
            {item.category.replace('_', ' ')}
          </span>
          {item.duration && (
            <span className="text-xs text-gray-500">{item.duration} days</span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold mb-1">{item.name}</h3>

        {/* Description */}
        <p className="text-sm text-gray-400 line-clamp-2 mb-3">
          {item.description}
        </p>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="text-gray-500">{item.soldCount} sold</span>
          {item.maxSupply && (
            <span className="text-gray-500">
              {item.soldCount}/{item.maxSupply}
            </span>
          )}
        </div>

        {/* Price & Buy Button */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-lg font-bold text-green-400">{item.price}</span>
            <span className="text-sm text-gray-500 ml-1">COMP</span>
          </div>
          <button
            disabled={isSoldOut}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isSoldOut
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            {isSoldOut ? 'Sold Out' : 'Buy'}
          </button>
        </div>
      </div>
    </div>
  );
}
