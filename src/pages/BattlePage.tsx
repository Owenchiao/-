import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Team, UserProfile, Room, BattleCharacter, ItemCard, PlayerState } from '../types';
import { gameService } from '../services/gameService';
import { calculateDamage, applyDamage } from '../services/battleEngine';
import { Sword, Shield, Heart, Zap, History, Trophy } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  roomId: string;
  team: Team;
  profile: UserProfile;
  onFinish: () => void;
}

export default function BattlePage({ roomId, team, profile, onFinish }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [selectedMainId, setSelectedMainId] = useState<string | null>(null);
  const [energyToUse, setEnergyToUse] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [useSkill, setUseSkill] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = gameService.subscribeToRoom(roomId, (updatedRoom) => {
      setRoom(updatedRoom);
      if (updatedRoom.status === 'finished') {
        // Handle rewards logic here or in a separate view
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.logs]);

  if (!room) return null;

  const myPlayer = room.players.find(p => p.uid === profile.uid)!;
  const opponent = room.players.find(p => p.uid !== profile.uid)!;
  const isMyTurn = room.turn === profile.uid;

  const handleAttack = async () => {
    if (!selectedMainId) {
      toast.error('請選擇一位主戰角色');
      return;
    }

    if (!isMyTurn || isProcessing) return;

    setIsProcessing(true);
    
    // Re-fetch latest room state to avoid race conditions
    const latestRoom = await gameService.getRoom(roomId);
    if (!latestRoom || latestRoom.turn !== profile.uid) {
      toast.error('目前不是你的回合');
      setIsProcessing(false);
      return;
    }

    const currentMyPlayer = latestRoom.players.find(p => p.uid === profile.uid)!;
    const currentOpponent = latestRoom.players.find(p => p.uid !== profile.uid)!;

    const attackerChar = currentMyPlayer.selectedChars.find(c => c.id === selectedMainId)!;
    const defenderMain = currentOpponent.selectedChars.find(c => c.isMain) || currentOpponent.selectedChars.find(c => !c.isDead)!;
    
    const item = currentMyPlayer.items.find(i => i.id === selectedItemId);
    const { damage, advantage } = calculateDamage(attackerChar, defenderMain, energyToUse, useSkill, item);

    let newLogs = [...latestRoom.logs];
    newLogs.push(`${currentMyPlayer.teamId} 的 ${attackerChar.name} 發動攻擊！`);
    if (advantage) newLogs.push(`屬性克制！額外造成 20 點傷害`);
    if (useSkill) newLogs.push(`使用技能：${attackerChar.skillName}`);
    if (item) newLogs.push(`使用道具：${item.name}`);

    // Apply damage to opponent
    const updatedOpponentChars = applyDamage(currentOpponent.selectedChars, damage, true);
    
    // Update my characters (resting state)
    const updatedMyChars = currentMyPlayer.selectedChars.map(c => ({
      ...c,
      isMain: c.id === selectedMainId,
      isResting: c.id === selectedMainId // Rest next round
    }));

    // Update energy
    let energyCost = energyToUse;
    if (useSkill) energyCost += attackerChar.skillEnergyCost || 0;

    let energyGain = 0;
    if (item) {
      if (item.itemType === 'gain_energy') {
        energyGain = item.value || 0;
      } else if (item.itemType === 'gain_energy_phineas' && attackerChar.faction === '飛哥家') {
        energyGain = item.value || 0;
      } else if (item.itemType === 'gain_energy_doof' && attackerChar.faction === '杜芬舒斯家') {
        energyGain = item.value || 0;
      } else if (item.itemType === 'gain_energy_fireside' && attackerChar.faction === '美眉家') {
        energyGain = item.value || 0;
      }
      
      if (energyGain > 0) {
        newLogs.push(`獲得了 ${energyGain} 點能量！`);
      } else if (item.itemType.startsWith('gain_energy_')) {
        newLogs.push(`道具 ${item.name} 與當前角色陣營不符，未獲得能量。`);
      }
    }

    const updatedPlayers = latestRoom.players.map(p => {
      if (p.uid === profile.uid) {
        return { 
          ...p, 
          selectedChars: updatedMyChars, 
          energy: Math.max(0, p.energy - energyCost + energyGain),
          items: p.items.filter(i => i.id !== selectedItemId),
          hasAttackedThisTurn: true
        };
      }
      if (p.uid === currentOpponent.uid) {
        return { ...p, selectedChars: updatedOpponentChars };
      }
      return p;
    });

    // Check if round ends
    let nextTurn = currentOpponent.uid;
    let nextRound = latestRoom.currentRound;
    let nextStatus = latestRoom.status;
    let winner = null;

    const bothAttacked = updatedPlayers.every(p => p.hasAttackedThisTurn);
    if (bothAttacked) {
      if (latestRoom.currentRound >= 3) {
        nextStatus = 'finished';
        // Determine winner
        const mySurvivors = updatedMyChars.filter(c => !c.isDead).length;
        const oppSurvivors = updatedOpponentChars.filter(c => !c.isDead).length;
        if (mySurvivors > oppSurvivors) winner = profile.uid;
        else if (oppSurvivors > mySurvivors) winner = currentOpponent.uid;
        else winner = 'draw';
        
        newLogs.push(`對戰結束！${winner === 'draw' ? '平手' : (winner === profile.uid ? '你獲勝了！' : '對手獲勝了')}`);
      } else {
        nextRound += 1;
        nextTurn = latestRoom.firstPlayerUid; // Reset to first player
        // Reset attack flags and resting states for next round
        updatedPlayers.forEach(p => {
          p.hasAttackedThisTurn = false;
          p.selectedChars.forEach(c => {
            if (!c.isMain) c.isResting = false;
          });
        });
        newLogs.push(`--- 第 ${nextRound} 回合開始 ---`);
      }
    }

    const updates: any = {
      players: updatedPlayers,
      turn: nextTurn,
      currentRound: nextRound,
      status: nextStatus,
      logs: newLogs,
    };

    if (winner) {
      updates.winner = winner;
    }

    await gameService.updateRoom(roomId, updates);

    // Reset local selection
    setSelectedMainId(null);
    setEnergyToUse(0);
    setSelectedItemId(null);
    setUseSkill(false);
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col lg:flex-row gap-6 overflow-hidden">
      {/* Battle Arena */}
      <div className="flex-1 flex flex-col justify-between gap-8 py-4">
        {/* Opponent Side */}
        <div className="space-y-4">
          <div className="flex justify-center gap-4">
            {opponent.selectedChars.filter(c => !c.isMain).map(c => (
              <BattleCardUI key={c.id} char={c} isOpponent />
            ))}
          </div>
          <div className="flex justify-center">
            {opponent.selectedChars.filter(c => c.isMain).map(c => (
              <BattleCardUI key={c.id} char={c} isOpponent isMain />
            ))}
            {opponent.selectedChars.every(c => !c.isMain) && (
              <div className="w-32 h-44 border-4 border-dashed border-white/20 rounded-2xl flex items-center justify-center text-white/20 font-bold">
                主戰位
              </div>
            )}
          </div>
        </div>

        {/* Middle Info */}
        <div className="flex flex-col items-center gap-2">
          <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-4">
            <span className="text-xl font-black text-orange-400">ROUND {room.currentRound}</span>
            <div className="h-4 w-px bg-white/20" />
            <span className="font-bold">
              {isMyTurn ? '你的回合' : '對手回合...'}
            </span>
          </div>
        </div>

        {/* My Side */}
        <div className="space-y-4">
          <div className="flex justify-center">
            {myPlayer.selectedChars.filter(c => c.isMain).map(c => (
              <BattleCardUI key={c.id} char={c} isMain />
            ))}
            {!myPlayer.selectedChars.some(c => c.isMain) && (
              <div className="w-32 h-44 border-4 border-dashed border-sky-400/50 rounded-2xl flex items-center justify-center text-sky-400/50 font-bold">
                主戰位
              </div>
            )}
          </div>
          <div className="flex justify-center gap-4">
            {myPlayer.selectedChars.filter(c => !c.isMain).map(c => (
              <BattleCardUI 
                key={c.id} 
                char={c} 
                onClick={() => !c.isDead && !c.isResting && setSelectedMainId(c.id)}
                isSelected={selectedMainId === c.id}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Controls & Logs */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        {/* Actions */}
        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 space-y-6">
          <h3 className="text-xl font-black flex items-center gap-2">
            <Sword className="text-orange-500" /> 行動指令
          </h3>

          {room.status === 'finished' ? (
            <div className="text-center space-y-4 py-8">
              <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
              <h4 className="text-2xl font-black">對戰結束</h4>
              <button 
                onClick={onFinish}
                className="w-full bg-sky-500 py-4 rounded-2xl font-black"
              >
                返回主選單
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Energy Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-1">
                  <Zap className="w-4 h-4 text-blue-400" /> 使用能量 (剩餘 {myPlayer.energy})
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map(val => (
                    <button
                      key={val}
                      onClick={() => setEnergyToUse(val)}
                      disabled={!isMyTurn || myPlayer.energy < val}
                      className={`py-2 rounded-xl font-bold border-2 transition-all ${energyToUse === val ? 'bg-blue-500 border-blue-300' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                      {val === 0 ? '不使用' : `+${val === 1 ? '20' : '60'}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Toggle */}
              <button
                onClick={() => setUseSkill(!useSkill)}
                disabled={!isMyTurn || !selectedMainId || (myPlayer.selectedChars.find(c => c.id === selectedMainId)?.skillEnergyCost || 0) > (myPlayer.energy - energyToUse)}
                className={`w-full py-3 rounded-xl font-black border-2 transition-all flex items-center justify-center gap-2 ${useSkill ? 'bg-purple-500 border-purple-300' : 'bg-white/5 border-white/10'}`}
              >
                <Zap className="w-5 h-5" /> 使用技能
              </button>

              {/* Item Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold">使用道具</label>
                <select 
                  value={selectedItemId || ''} 
                  onChange={(e) => setSelectedItemId(e.target.value || null)}
                  disabled={!isMyTurn}
                  className="w-full bg-white/5 border-2 border-white/10 rounded-xl p-3 font-bold focus:outline-none focus:border-sky-400"
                >
                  <option value="" className="bg-slate-800">不使用道具</option>
                  {myPlayer.items.map(item => (
                    <option key={item.id} value={item.id} className="bg-slate-800">{item.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleAttack}
                disabled={!isMyTurn || !selectedMainId || isProcessing}
                className={`w-full py-5 rounded-2xl font-black text-xl shadow-lg transition-all transform active:scale-95 ${!isMyTurn || !selectedMainId ? 'bg-gray-600 grayscale cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
              >
                {isProcessing ? '處理中...' : '確認攻擊'}
              </button>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 bg-black/40 rounded-3xl border border-white/10 flex flex-col overflow-hidden min-h-[200px]">
          <div className="p-4 border-b border-white/10 flex items-center gap-2 font-bold text-gray-400">
            <History className="w-4 h-4" /> 戰鬥紀錄
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 text-sm font-medium">
            {room.logs.map((log, i) => (
              <div key={i} className={`p-2 rounded-lg ${log.includes('---') ? 'text-sky-400 text-center font-black' : 'bg-white/5'}`}>
                {log}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BattleCardUI({ char, isOpponent = false, isMain = false, onClick, isSelected = false }: { char: BattleCharacter, isOpponent?: boolean, isMain?: boolean, onClick?: () => void, isSelected?: boolean, key?: any }) {
  const hpPercent = (char.currentHp / char.maxHp) * 100;
  
  return (
    <motion.div 
      layout
      onClick={onClick}
      className={`relative w-28 sm:w-32 h-40 sm:h-44 rounded-2xl border-4 transition-all overflow-hidden cursor-pointer
        ${char.isDead ? 'grayscale opacity-50 border-red-500' : (isMain ? 'border-yellow-400 ring-4 ring-yellow-400/50' : 'border-white/20')}
        ${isSelected ? 'scale-110 ring-4 ring-sky-400' : ''}
        ${char.isResting && !char.isDead ? 'opacity-70 border-blue-400' : ''}
        ${isOpponent ? 'bg-slate-800' : 'bg-slate-700'}
      `}
    >
      <div className="p-2 h-full flex flex-col justify-between">
        <div className="text-[10px] font-black uppercase tracking-tighter truncate">{char.name}</div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-[8px] font-bold">
            <span>HP</span>
            <span>{char.currentHp}/{char.maxHp}</span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${hpPercent}%` }}
              className={`h-full ${hpPercent > 50 ? 'bg-green-500' : hpPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
            />
          </div>
          <div className="flex justify-between text-[10px] font-black">
            <div className="flex items-center gap-0.5"><Sword className="w-2 h-2" /> {char.atk}</div>
            {char.isResting && <span className="text-blue-400">休息中</span>}
          </div>
        </div>
      </div>

      {char.isDead && (
        <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
          <span className="text-white font-black text-xl rotate-12 border-4 border-white px-2">K.O.</span>
        </div>
      )}
    </motion.div>
  );
}
