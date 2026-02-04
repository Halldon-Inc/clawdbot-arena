'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { GlassCard } from '@/components/ui/GlassCard';
import { NeonButton } from '@/components/ui/NeonButton';
import { cn } from '@/lib/utils';
import {
  COMP_TOKEN_ABI,
  BETTING_ARENA_ABI,
  getContractAddresses,
  MatchStatus,
} from '@/lib/contracts';

interface BettingPanelProps {
  matchId: number;
  bots: Array<{ index: number; name: string; odds: number }>;
  disabled?: boolean;
  onBetPlaced?: () => void;
}

type TxStatus = 'idle' | 'approving' | 'placing' | 'success' | 'error';

export function BettingPanel({ matchId, bots, disabled = false, onBetPlaced }: BettingPanelProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);

  const [selectedBot, setSelectedBot] = useState<number>(0);
  const [betAmount, setBetAmount] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Read COMP balance
  const { data: compBalance } = useReadContract({
    address: addresses.compToken,
    abi: COMP_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read allowance
  const { data: allowance } = useReadContract({
    address: addresses.compToken,
    abi: COMP_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, addresses.bettingArena] : undefined,
    query: { enabled: !!address },
  });

  // Read pool sizes
  const { data: bot0Pool } = useReadContract({
    address: addresses.bettingArena,
    abi: BETTING_ARENA_ABI,
    functionName: 'getBotPool',
    args: [BigInt(matchId), BigInt(0)],
  });

  const { data: bot1Pool } = useReadContract({
    address: addresses.bettingArena,
    abi: BETTING_ARENA_ABI,
    functionName: 'getBotPool',
    args: [BigInt(matchId), BigInt(1)],
  });

  // Read match data for status
  const { data: matchData } = useReadContract({
    address: addresses.bettingArena,
    abi: BETTING_ARENA_ABI,
    functionName: 'getMatch',
    args: [BigInt(matchId)],
  });

  // Write: approve
  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // Write: place bet
  const { writeContract: placeBet, data: betTxHash } = useWriteContract();
  const { isSuccess: betSuccess } = useWaitForTransactionReceipt({ hash: betTxHash });

  // Write: claim winnings
  const { writeContract: claimWinnings, data: claimTxHash } = useWriteContract();
  const { isPending: claimLoading, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimTxHash });

  useEffect(() => {
    if (approveSuccess && txStatus === 'approving') {
      doPlaceBet();
    }
  }, [approveSuccess]);

  useEffect(() => {
    if (betSuccess) {
      setTxStatus('success');
      setBetAmount('');
      onBetPlaced?.();
    }
  }, [betSuccess]);

  const balance = compBalance ? formatEther(compBalance as bigint) : '0';
  const currentAllowance = allowance ? (allowance as bigint) : BigInt(0);
  const betWei = betAmount ? parseEther(betAmount) : BigInt(0);
  const needsApproval = betWei > currentAllowance;
  const hasInsufficientBalance = compBalance !== undefined && betWei > (compBalance as bigint);
  const matchStatus = matchData ? Number((matchData as any).status) : null;
  const canBet = matchStatus === null || matchStatus === MatchStatus.Open;

  const pool0 = bot0Pool ? formatEther(bot0Pool as bigint) : '0';
  const pool1 = bot1Pool ? formatEther(bot1Pool as bigint) : '0';

  const handleSubmit = () => {
    setErrorMsg(null);
    if (!isConnected || !address) {
      setErrorMsg('Connect your wallet first');
      return;
    }
    if (!betAmount || parseFloat(betAmount) <= 0) {
      setErrorMsg('Enter a valid bet amount');
      return;
    }
    if (hasInsufficientBalance) {
      setErrorMsg('Insufficient COMP balance');
      return;
    }

    if (needsApproval) {
      setTxStatus('approving');
      approve({
        address: addresses.compToken,
        abi: COMP_TOKEN_ABI,
        functionName: 'approve',
        args: [addresses.bettingArena, betWei],
      }, {
        onError: (err) => {
          setTxStatus('error');
          setErrorMsg(err.message.split('\n')[0]);
        },
      });
    } else {
      doPlaceBet();
    }
  };

  const doPlaceBet = () => {
    setTxStatus('placing');
    placeBet({
      address: addresses.bettingArena,
      abi: BETTING_ARENA_ABI,
      functionName: 'placeBet',
      args: [BigInt(matchId), BigInt(selectedBot), betWei],
    }, {
      onError: (err) => {
        setTxStatus('error');
        setErrorMsg(err.message.split('\n')[0]);
      },
    });
  };

  const handleClaim = (betIndex: number) => {
    claimWinnings({
      address: addresses.bettingArena,
      abi: BETTING_ARENA_ABI,
      functionName: 'claimWinnings',
      args: [BigInt(matchId), BigInt(betIndex)],
    }, {
      onError: (err) => {
        setErrorMsg(err.message.split('\n')[0]);
      },
    });
  };

  const isProcessing = txStatus === 'approving' || txStatus === 'placing';

  return (
    <GlassCard hover={false}>
      {/* Pool Display */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-display mb-1">Pool 1</div>
          <div className="font-mono font-bold">{parseFloat(pool0).toFixed(1)}</div>
        </div>
        <div className="glass rounded-xl p-3 text-center">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-display mb-1">Pool 2</div>
          <div className="font-mono font-bold">{parseFloat(pool1).toFixed(1)}</div>
        </div>
      </div>

      {/* Bot Selection */}
      <div className="mb-5">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-display mb-2">Pick Fighter</div>
        <div className="space-y-2">
          {bots.map((bot) => (
            <button
              key={bot.index}
              onClick={() => setSelectedBot(bot.index)}
              disabled={disabled || !canBet}
              className={cn(
                'w-full p-3 rounded-xl text-left transition-all flex items-center justify-between',
                selectedBot === bot.index
                  ? 'bg-neon-purple/10 border border-neon-purple/30 shadow-glow-sm'
                  : 'bg-white/[0.02] border border-white/5 hover:border-white/10',
                (disabled || !canBet) && 'opacity-50 cursor-not-allowed',
              )}
            >
              <span className="font-medium text-sm">{bot.name}</span>
              <span className="font-mono text-sm text-gray-400">{bot.odds.toFixed(2)}x</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bet Amount */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-display">Amount</span>
          <span className="text-xs text-gray-500 font-mono">
            Bal: {parseFloat(balance).toFixed(2)} COMP
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            value={betAmount}
            onChange={(e) => { setBetAmount(e.target.value); setTxStatus('idle'); setErrorMsg(null); }}
            placeholder="0.0"
            disabled={disabled || !canBet}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 text-lg font-mono focus:outline-none focus:border-neon-purple/50 transition-colors disabled:opacity-50"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">COMP</span>
        </div>
        <div className="flex gap-2 mt-2">
          {['10', '50', '100', '500'].map((amt) => (
            <button
              key={amt}
              onClick={() => setBetAmount(amt)}
              disabled={disabled || !canBet}
              className="flex-1 py-1.5 text-xs glass rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors font-mono disabled:opacity-50"
            >
              {amt}
            </button>
          ))}
        </div>
      </div>

      {/* Potential Payout */}
      {betAmount && parseFloat(betAmount) > 0 && (
        <div className="mb-5 glass rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-display">Potential Payout</span>
            <span className="font-mono font-bold text-neon-green">
              {(parseFloat(betAmount) * (bots[selectedBot]?.odds || 2)).toFixed(2)} COMP
            </span>
          </div>
        </div>
      )}

      {/* Status / Error */}
      {errorMsg && (
        <div className="mb-4 p-3 glass border border-neon-red/30 rounded-xl text-neon-red text-xs">
          {errorMsg}
        </div>
      )}

      {txStatus === 'success' && (
        <div className="mb-4 p-3 glass border border-neon-green/30 rounded-xl text-neon-green text-xs flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Bet placed successfully!
        </div>
      )}

      {/* Match status warnings */}
      {matchStatus !== null && !canBet && (
        <div className="mb-4 p-3 glass border border-neon-amber/30 rounded-xl text-neon-amber text-xs">
          {matchStatus === MatchStatus.Locked && 'Betting locked — match in progress'}
          {matchStatus === MatchStatus.Resolved && 'Match has ended'}
          {matchStatus === MatchStatus.Cancelled && 'Match was cancelled'}
        </div>
      )}

      {/* Claim winnings button (for resolved matches) */}
      {matchStatus === MatchStatus.Resolved && (
        <NeonButton
          onClick={() => handleClaim(0)}
          disabled={claimLoading}
          variant="secondary"
          className="w-full mb-3"
        >
          {claimLoading ? 'Claiming...' : claimSuccess ? 'Claimed!' : 'Claim Winnings'}
        </NeonButton>
      )}

      {/* Submit */}
      <NeonButton
        onClick={handleSubmit}
        disabled={!isConnected || isProcessing || !betAmount || disabled || !canBet}
        className="w-full"
        size="lg"
      >
        {!isConnected
          ? 'Connect Wallet'
          : isProcessing
            ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {txStatus === 'approving' ? 'Approving...' : 'Placing Bet...'}
              </span>
            )
            : needsApproval
              ? 'Approve & Bet'
              : 'Place Bet'
        }
      </NeonButton>
    </GlassCard>
  );
}
