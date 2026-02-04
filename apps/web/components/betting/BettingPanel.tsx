'use client';

/**
 * Betting Panel Component
 * Allows users to place bets on matches using smart contracts
 */

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { BETTING_ARENA_ABI, COMP_TOKEN_ABI, getContractAddresses, MatchStatus } from '@/lib/contracts';

interface BettingPanelProps {
  matchId: number;
  bots: Array<{
    index: number;
    name: string;
    odds: number;
  }>;
  disabled?: boolean;
  onBetPlaced?: () => void;
}

export function BettingPanel({ matchId, bots, disabled = false, onBetPlaced }: BettingPanelProps) {
  const { address, isConnected, chain } = useAccount();
  const [selectedBot, setSelectedBot] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const contracts = chain ? getContractAddresses(chain.id) : null;

  // Read user's COMP balance
  const { data: compBalance } = useReadContract({
    address: contracts?.compToken,
    abi: COMP_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!contracts },
  });

  // Read user's allowance
  const { data: allowance } = useReadContract({
    address: contracts?.compToken,
    abi: COMP_TOKEN_ABI,
    functionName: 'allowance',
    args: address && contracts ? [address, contracts.bettingArena] : undefined,
    query: { enabled: !!address && !!contracts },
  });

  // Read match status
  const { data: matchData } = useReadContract({
    address: contracts?.bettingArena,
    abi: BETTING_ARENA_ABI,
    functionName: 'getMatch',
    args: [BigInt(matchId)],
    query: { enabled: !!contracts },
  });

  // Approve COMP spending
  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { isLoading: isApproveLoading, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Place bet
  const { writeContract: placeBet, data: betHash, error: betError } = useWriteContract();
  const { isLoading: isBetLoading, isSuccess: isBetSuccess } = useWaitForTransactionReceipt({
    hash: betHash,
  });

  // Handle approval success
  useEffect(() => {
    if (isApproveSuccess) {
      setIsApproving(false);
    }
  }, [isApproveSuccess]);

  // Handle bet success
  useEffect(() => {
    if (isBetSuccess) {
      setBetAmount('');
      setSelectedBot(null);
      onBetPlaced?.();
    }
  }, [isBetSuccess, onBetPlaced]);

  const betAmountWei = betAmount ? parseEther(betAmount) : BigInt(0);
  const needsApproval = allowance !== undefined && betAmountWei > allowance;
  const hasInsufficientBalance = compBalance !== undefined && betAmountWei > compBalance;
  const matchStatus = matchData ? Number(matchData.status) : null;
  const canBet = matchStatus === MatchStatus.Open && !disabled;

  const handleApprove = () => {
    if (!contracts) return;
    setIsApproving(true);
    approve({
      address: contracts.compToken,
      abi: COMP_TOKEN_ABI,
      functionName: 'approve',
      args: [contracts.bettingArena, parseEther('1000000')], // Approve 1M COMP
    });
  };

  const handlePlaceBet = () => {
    if (!contracts || selectedBot === null || !betAmount) return;
    placeBet({
      address: contracts.bettingArena,
      abi: BETTING_ARENA_ABI,
      functionName: 'placeBet',
      args: [BigInt(matchId), BigInt(selectedBot), betAmountWei],
    });
  };

  if (!isConnected) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-gray-400 mb-4">Connect your wallet to place bets</p>
        <w3m-button />
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="font-semibold mb-4">Place Your Bet</h3>

      {/* Bot Selection */}
      <div className="space-y-2 mb-4">
        {bots.map((bot) => (
          <button
            key={bot.index}
            onClick={() => setSelectedBot(bot.index)}
            disabled={!canBet}
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
              selectedBot === bot.index
                ? 'bg-purple-600/30 border-purple-500'
                : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
            } ${!canBet ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="font-medium">{bot.name}</span>
            <span className="font-mono text-lg">{bot.odds.toFixed(2)}x</span>
          </button>
        ))}
      </div>

      {/* Bet Amount Input */}
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Bet Amount (COMP)</label>
        <div className="relative">
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            placeholder="0.00"
            disabled={!canBet}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <button
            onClick={() => compBalance && setBetAmount(formatEther(compBalance))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-purple-400 hover:text-purple-300"
          >
            MAX
          </button>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Min: 1 COMP</span>
          <span>Balance: {compBalance ? formatEther(compBalance) : '0'} COMP</span>
        </div>
      </div>

      {/* Potential Payout */}
      {selectedBot !== null && betAmount && (
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Potential Payout</span>
            <span className="font-mono text-green-400">
              {(parseFloat(betAmount) * bots[selectedBot].odds).toFixed(2)} COMP
            </span>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {hasInsufficientBalance && (
        <div className="text-red-400 text-sm mb-4">Insufficient COMP balance</div>
      )}
      {betError && (
        <div className="text-red-400 text-sm mb-4">{betError.message}</div>
      )}

      {/* Action Button */}
      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isApproveLoading || isApproving}
          className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
        >
          {isApproveLoading || isApproving ? 'Approving...' : 'Approve COMP'}
        </button>
      ) : (
        <button
          onClick={handlePlaceBet}
          disabled={
            !canBet ||
            !selectedBot === null ||
            !betAmount ||
            hasInsufficientBalance ||
            isBetLoading
          }
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
        >
          {isBetLoading ? 'Placing Bet...' : 'Place Bet'}
        </button>
      )}

      {/* Match Status Warning */}
      {matchStatus !== null && matchStatus !== MatchStatus.Open && (
        <div className="mt-4 text-center text-sm text-yellow-400">
          {matchStatus === MatchStatus.Locked && 'Betting is locked - match in progress'}
          {matchStatus === MatchStatus.Resolved && 'Match has ended'}
          {matchStatus === MatchStatus.Cancelled && 'Match was cancelled'}
        </div>
      )}
    </div>
  );
}
