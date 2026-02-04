'use client';

/**
 * Claim Winnings Component
 * Allows users to claim their winnings from resolved matches
 */

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { BETTING_ARENA_ABI, getContractAddresses, MatchStatus } from '@/lib/contracts';

interface ClaimWinningsProps {
  matchId: number;
  betIndex: number;
  onClaimed?: () => void;
}

export function ClaimWinnings({ matchId, betIndex, onClaimed }: ClaimWinningsProps) {
  const { address, chain } = useAccount();
  const [claimed, setClaimed] = useState(false);

  const contracts = chain ? getContractAddresses(chain.id) : null;

  // Read bet details
  const { data: bet } = useReadContract({
    address: contracts?.bettingArena,
    abi: BETTING_ARENA_ABI,
    functionName: 'getBet',
    args: [BigInt(matchId), BigInt(betIndex)],
    query: { enabled: !!contracts },
  });

  // Read match details
  const { data: match } = useReadContract({
    address: contracts?.bettingArena,
    abi: BETTING_ARENA_ABI,
    functionName: 'getMatch',
    args: [BigInt(matchId)],
    query: { enabled: !!contracts },
  });

  // Calculate potential payout
  const { data: payout } = useReadContract({
    address: contracts?.bettingArena,
    abi: BETTING_ARENA_ABI,
    functionName: 'calculatePayout',
    args: [BigInt(matchId), BigInt(betIndex)],
    query: { enabled: !!contracts && !!match && Number(match.status) === MatchStatus.Resolved },
  });

  // Claim winnings
  const { writeContract: claimWinnings, data: claimHash, error: claimError } = useWriteContract();
  const { isLoading: isClaimLoading, isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // Claim refund (for cancelled matches)
  const { writeContract: claimRefund, data: refundHash, error: refundError } = useWriteContract();
  const { isLoading: isRefundLoading, isSuccess: isRefundSuccess } = useWaitForTransactionReceipt({
    hash: refundHash,
  });

  useEffect(() => {
    if (isClaimSuccess || isRefundSuccess) {
      setClaimed(true);
      onClaimed?.();
    }
  }, [isClaimSuccess, isRefundSuccess, onClaimed]);

  if (!bet || !match) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="animate-pulse bg-gray-700 h-20 rounded" />
      </div>
    );
  }

  const matchStatus = Number(match.status);
  const isWinner = matchStatus === MatchStatus.Resolved && Number(bet.botIndex) === Number(match.winnerIndex);
  const isCancelled = matchStatus === MatchStatus.Cancelled;
  const alreadyClaimed = bet.claimed;

  const handleClaim = () => {
    if (!contracts) return;

    if (isWinner) {
      claimWinnings({
        address: contracts.bettingArena,
        abi: BETTING_ARENA_ABI,
        functionName: 'claimWinnings',
        args: [BigInt(matchId), BigInt(betIndex)],
      });
    } else if (isCancelled) {
      claimRefund({
        address: contracts.bettingArena,
        abi: BETTING_ARENA_ABI,
        functionName: 'claimRefund',
        args: [BigInt(matchId), BigInt(betIndex)],
      });
    }
  };

  if (alreadyClaimed || claimed) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <div className="text-green-400 mb-2">✓ Claimed</div>
        <div className="text-sm text-gray-400">
          You have already claimed your {isWinner ? 'winnings' : 'refund'}
        </div>
      </div>
    );
  }

  if (matchStatus === MatchStatus.Resolved && !isWinner) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <div className="text-red-400 mb-2">Better luck next time</div>
        <div className="text-sm text-gray-400">
          Your bet of {formatEther(bet.amount)} COMP did not win
        </div>
      </div>
    );
  }

  if (!isWinner && !isCancelled) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <div className="text-yellow-400 mb-2">Match in progress</div>
        <div className="text-sm text-gray-400">
          Claim will be available after the match ends
        </div>
      </div>
    );
  }

  const claimAmount = isWinner && payout ? formatEther(payout) : formatEther(bet.amount);
  const isLoading = isClaimLoading || isRefundLoading;

  return (
    <div className="glass rounded-xl p-6">
      <div className="text-center mb-4">
        {isWinner ? (
          <>
            <div className="text-2xl mb-1">🎉</div>
            <div className="text-green-400 font-semibold">You Won!</div>
          </>
        ) : (
          <>
            <div className="text-2xl mb-1">↩️</div>
            <div className="text-yellow-400 font-semibold">Match Cancelled</div>
          </>
        )}
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-gray-400">Your Bet</span>
          <span className="font-mono">{formatEther(bet.amount)} COMP</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">{isWinner ? 'Winnings' : 'Refund'}</span>
          <span className="font-mono text-green-400">{claimAmount} COMP</span>
        </div>
      </div>

      {(claimError || refundError) && (
        <div className="text-red-400 text-sm mb-4">
          {(claimError || refundError)?.message}
        </div>
      )}

      <button
        onClick={handleClaim}
        disabled={isLoading}
        className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
      >
        {isLoading ? 'Claiming...' : `Claim ${claimAmount} COMP`}
      </button>
    </div>
  );
}
