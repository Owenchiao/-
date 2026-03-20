import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Team, UserProfile, Room, BattleCharacter, ItemCard, PlayerState } from '../types';
import { gameService } from '../services/gameService';
import { calculateDamage, applyDamage } from '../services/battleEngine';
import { Sword, Shield, Heart, Zap, History, Trophy, Star, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  roomId: string;
  team: Team;
  profile: UserProfile;
  onFinish: () => void;
}

interface DamageEffect {
  id: string;
  amount: number;
  isAdvantage: boolean;
  x: number;
  y: number;
}

export default function BattlePage({ roomId, team, profile, onFinish }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [selectedMainId, setSelectedMainId] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [energyToUse, setEnergyToUse] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [useSkill, setUseSkill] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasRecordedResult, setHasRecordedResult] = useState(false);
  
  const handleUseItem = async (itemId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const latestRoom = await gameService.getRoom(roomId);
      if (!latestRoom) return;

      const myP = latestRoom.players.find(p => p.uid === profile.uid);
      const oppP = latestRoom.players.find(p => p.uid !== profile.uid);
      if (!myP || !oppP) return;

      // Check for Time Stopper (disable_enemy_items) on opponent
      if (oppP.activeEffects?.some(i => i.itemType === 'disable_enemy_items')) {
        toast.error('對手使用了時間停止器，本回合你無法使用道具卡！');
        setIsProcessing(false);
        return;
      }

      const item = myP.items.find(i => i.id === itemId);
      if (!item) return;

      let updatedMyChars = [...myP.selectedChars];
      let updatedOppChars = [...oppP.selectedChars];
      let newLogs = [...latestRoom.logs];
      let energyGain = 0;

      if (item.itemType === 'heal') {
        const healAmount = item.value || 60;
        // Heal selected character or main character
        const targetId = selectedMainId || updatedMyChars.find(c => c.isMain)?.id;
        if (targetId) {
          let targetName = '';
          updatedMyChars = updatedMyChars.map(c => {
            if (c.id === targetId) {
              targetName = c.name;
              return {
                ...c,
                currentHp: Math.min(c.maxHp, c.currentHp + healAmount),
                isDead: false
              };
            }
            return c;
          });
          newLogs.push(`${myP.teamName} 使用了 ${item.name}，恢復了 ${targetName} ${healAmount} 點生命！`);
        } else {
          toast.error('請先選擇要治療的角色');
          setIsProcessing(false);
          return;
        }
      } else if (item.itemType === 'force_swap_main') {
        const aliveSubs = updatedOppChars.filter(c => !c.isMain && !c.isDead);
        if (aliveSubs.length > 0) {
          const randomSub = aliveSubs[Math.floor(Math.random() * aliveSubs.length)];
          updatedOppChars = updatedOppChars.map(c => ({
            ...c,
            isMain: c.id === randomSub.id
          }));
          newLogs.push(`${myP.teamName} 使用了 ${item.name}！對手被迫更換主戰角色為 ${randomSub.name}！`);
        }
      } else if (item.itemType === 'swap_main_sub') {
        const main = updatedMyChars.find(c => c.isMain);
        const aliveSubs = updatedMyChars.filter(c => !c.isMain && !c.isDead);
        if (main && aliveSubs.length > 0) {
          const randomSub = aliveSubs[Math.floor(Math.random() * aliveSubs.length)];
          updatedMyChars = updatedMyChars.map(c => {
            if (c.id === main.id) return { ...c, isMain: false };
            if (c.id === randomSub.id) return { ...c, isMain: true };
            return c;
          });
          newLogs.push(`${myP.teamName} 使用了 ${item.name}，更換主戰角色為 ${randomSub.name}！`);
        }
      } else if (item.itemType === 'gain_energy') {
        energyGain = item.value || 0;
        newLogs.push(`${myP.teamName} 使用了 ${item.name}，獲得 ${energyGain} 點能量！`);
      } else if (item.itemType === 'coin_flip_miss' || item.itemType === 'half_damage' || item.itemType === 'disable_enemy_items') {
        newLogs.push(`${myP.teamName} 啟動了 ${item.name}！效力將在對手下次攻擊時生效。`);
        
        const updatedPlayers = latestRoom.players.map(p => {
          if (p.uid === profile.uid) {
            return {
              ...p,
              items: p.items.filter(i => i.id !== itemId),
              activeEffects: [...(p.activeEffects || []), item]
            };
          }
          return p;
        });

        await gameService.updateRoom(roomId, { players: updatedPlayers, logs: newLogs });
        setSelectedItemId(null);
        setIsProcessing(false);
        return;
      }

      const updatedPlayers = latestRoom.players.map(p => {
        if (p.uid === profile.uid) {
          return {
            ...p,
            selectedChars: updatedMyChars,
            energy: 999, // Infinite energy
            items: p.items.filter(i => i.id !== itemId)
          };
        }
        if (p.uid === oppP.uid) {
          return {
            ...p,
            selectedChars: updatedOppChars
          };
        }
        return p;
      });

      await gameService.updateRoom(roomId, { players: updatedPlayers, logs: newLogs });
      setSelectedItemId(null);
    } catch (error) {
      console.error('Use item error:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Animation States
  const [attackingId, setAttackingId] = useState<string | null>(null);
  const [hitId, setHitId] = useState<string | null>(null);
  const [damageEffects, setDamageEffects] = useState<DamageEffect[]>([]);
  const [skillCutIn, setSkillCutIn] = useState<BattleCharacter | null>(null);
  
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = gameService.subscribeToRoom(roomId, (updatedRoom) => {
      setRoom(updatedRoom);
      
      // Auto-select main if it's already set in room
      const myP = updatedRoom.players.find(p => p.uid === profile.uid);
      if (myP) {
        const mainChar = myP.selectedChars.find(c => c.isMain);
        if (mainChar && !selectedMainId) {
          setSelectedMainId(mainChar.id);
        }
      }
    });
    return () => unsubscribe();
  }, [roomId, profile.uid, selectedMainId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.logs]);

  useEffect(() => {
    if (room?.status === 'finished' && !hasRecordedResult) {
      const result = room.winner === profile.uid ? 'win' : (room.winner === 'draw' ? 'draw' : 'loss');
      const opponentPlayer = room.players.find(p => p.uid !== profile.uid);
      
      gameService.recordBattleResult({
        id: '', 
        userId: profile.uid,
        opponentId: opponentPlayer?.uid || 'unknown',
        opponentTeamName: opponentPlayer?.teamName || 'unknown',
        result,
        timestamp: null,
        roomId: roomId
      });
      setHasRecordedResult(true);
    }
  }, [room?.status, profile.uid, roomId, room?.winner, room?.players, hasRecordedResult]);

  if (!room) return null;

  const myPlayer = room.players.find(p => p.uid === profile.uid)!;
  const opponent = room.players.find(p => p.uid !== profile.uid)!;
  const isMyTurn = room.turn === profile.uid;

  const handleConfirmMain = async () => {
    if (!selectedMainId) {
      toast.error('請選擇一位主戰角色');
      return;
    }
    setIsProcessing(true);
    try {
      const latestRoom = await gameService.getRoom(roomId);
      if (!latestRoom) return;

      const player = latestRoom.players.find(p => p.uid === profile.uid);
      const selectedChar = player?.selectedChars.find(c => c.id === selectedMainId);
      
      if (!selectedChar) {
        toast.error('請先選擇一位角色');
        setIsProcessing(false);
        return;
      }

      if (selectedChar.isDead) {
        toast.error('不能選擇已陣亡的角色');
        setIsProcessing(false);
        return;
      }

      const updatedPlayers = latestRoom.players.map(p => {
        if (p.uid === profile.uid) {
          return {
            ...p,
            energy: 999, // Infinite energy
            selectedChars: p.selectedChars.map(c => ({
              ...c,
              isMain: c.id === selectedMainId
            }))
          };
        }
        return p;
      });

      const allHaveMain = updatedPlayers.every(p => p.selectedChars.some(c => c.isMain));
      const updates: any = { players: updatedPlayers };
      if (allHaveMain) {
        updates.status = 'battle';
        updates.logs = [...latestRoom.logs, `--- 第 ${latestRoom.currentRound} 回合戰鬥開始 ---`];
      }

      await gameService.updateRoom(roomId, updates);
    } catch (error) {
      console.error('Confirm main error:', error);
      toast.error('指派角色失敗，請重試');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAttack = async () => {
    if (!selectedMainId) {
      toast.error('請選擇一位主戰角色');
      return;
    }

    if (!isMyTurn || isProcessing) return;

    setIsProcessing(true);
    
    try {
      // Re-fetch latest room state to avoid race conditions
      const latestRoom = await gameService.getRoom(roomId);
      if (!latestRoom || latestRoom.turn !== profile.uid) {
        toast.error('目前不是你的回合');
        setIsProcessing(false);
        return;
      }

      const currentMyPlayer = latestRoom.players.find(p => p.uid === profile.uid);
      const currentOpponent = latestRoom.players.find(p => p.uid !== profile.uid);

      if (!currentMyPlayer || !currentOpponent) {
        toast.error('對戰資料不完整');
        setIsProcessing(false);
        return;
      }

      // Find attacker - if no main is set, try to use the selected one (recovery logic)
      let attackerChar = currentMyPlayer.selectedChars.find(c => c.isMain);
      
      if (!attackerChar) {
        // Recovery: if no main is set but we are in battle phase, set the selected one as main
        attackerChar = currentMyPlayer.selectedChars.find(c => c.id === selectedMainId);
        if (!attackerChar || attackerChar.isDead) {
          toast.error('找不到有效的主戰角色');
          setIsProcessing(false);
          return;
        }
        console.warn('No main character found in battle phase, using selected character as recovery.');
      }

      const defenderMain = currentOpponent.selectedChars.find(c => c.isMain) || currentOpponent.selectedChars.find(c => !c.isDead);
      
      if (!defenderMain) {
        toast.error('對手已無存活角色');
        setIsProcessing(false);
        return;
      }

      // Determine target
      let targetChar = defenderMain;
      const item = currentMyPlayer.items.find(i => i.id === selectedItemId);
      
      let newLogs = [...latestRoom.logs];

      // Check for Candace's Report Letter (force_swap_main) - Move timing to BEFORE attack
      let updatedOpponentChars = [...currentOpponent.selectedChars];
      if (item?.itemType === 'force_swap_main') {
        const aliveSubs = updatedOpponentChars.filter(c => !c.isMain && !c.isDead);
        if (aliveSubs.length > 0) {
          const randomSub = aliveSubs[Math.floor(Math.random() * aliveSubs.length)];
          updatedOpponentChars = updatedOpponentChars.map(c => ({
            ...c,
            isMain: c.id === randomSub.id
          }));
          newLogs.push(`${currentMyPlayer.teamName} 使用了 ${item.name}！對手被迫更換主戰角色為 ${randomSub.name}！`);
          // Update targetChar to the new main
          targetChar = randomSub;
        }
      }

      // Rule: If attacker dies before attacking (due to splash damage from opponent), skip turn
      if (attackerChar.isDead) {
        newLogs.push(`${attackerChar.name} 已在發起攻擊前陣亡，攻擊機會結束！`);
        // We need to update the room logs even if we skip
        await gameService.updateRoom(roomId, { logs: newLogs });
        await handleSkip();
        return;
      }

      if (item?.itemType === 'direct_attack_sub' && selectedTargetId) {
        const subTarget = currentOpponent.selectedChars.find(c => c.id === selectedTargetId);
        if (subTarget) targetChar = subTarget;
      }

      if (!attackerChar || !targetChar) {
        toast.error('攻擊目標或發動者無效');
        setIsProcessing(false);
        return;
      }

      // Check for Time Stopper (disable_enemy_items) on opponent
      const timeStopper = currentOpponent.activeEffects?.find(i => i.itemType === 'disable_enemy_items');
      let effectiveItem = item;
      if (timeStopper && item) {
        newLogs.push(`對手使用了時間停止器！本回合無法使用道具卡 ${item.name}。`);
        effectiveItem = undefined;
      }

      const { damage, advantage, isMiss, coinFlips } = calculateDamage(
        attackerChar, 
        targetChar, 
        energyToUse, 
        useSkill, 
        effectiveItem,
        currentOpponent.activeEffects
      );

      // Check energy cost - Infinite energy bypass
      const energyCost = energyToUse + (useSkill ? attackerChar.skillEnergyCost || 0 : 0);
      /* 
      if (energyCost > currentMyPlayer.energy) {
        toast.error('能量不足');
        setIsProcessing(false);
        return;
      }
      */

      // --- Start Animation Sequence ---
      
      // Coin flip skills (energy/gold gain)
      let skillEnergyGain = 0;
      if (useSkill) {
        if (attackerChar.skillType === 'gain_energy_on_coin') {
          const coin = Math.random() > 0.5;
          if (coin) {
            skillEnergyGain += 1;
            newLogs.push(`擲硬幣結果：正面！獲得 1 點能量。`);
          } else {
            newLogs.push(`擲硬幣結果：反面。未能獲得能量。`);
          }
        } else if (attackerChar.skillType === 'coin_energy') {
          const coins = [Math.random() > 0.5, Math.random() > 0.5];
          const heads = coins.filter(c => c).length;
          if (heads === 2) {
            skillEnergyGain += 1;
            newLogs.push(`擲硬幣結果：2個正面！獲得 1 點能量。`);
          } else {
            newLogs.push(`擲硬幣結果：${heads}個正面。未能獲得能量。`);
          }
        } else if (attackerChar.skillType === 'gain_gold_on_coin') {
          const coins = [Math.random() > 0.5, Math.random() > 0.5, Math.random() > 0.5];
          const heads = coins.filter(c => c).length;
          const goldGain = heads * 5;
          newLogs.push(`擲硬幣結果：${heads}個正面！獲得 ${goldGain} 枚金幣。`);
        }
      }

      // 1. Skill Cut-in
      if (useSkill) {
        setSkillCutIn(attackerChar);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSkillCutIn(null);
      }

      // 2. Attacker Dash
      setAttackingId(attackerChar.id);
      await new Promise(resolve => setTimeout(resolve, 300));

      // 3. Defender Hit & Damage Number
      if (isMiss) {
        newLogs.push(`攻擊落空了！全息影像裝置發揮作用。`);
      } else {
        setHitId(targetChar.id);
        const effectId = Math.random().toString();
        setDamageEffects(prev => [...prev, {
          id: effectId,
          amount: damage,
          isAdvantage: advantage,
          x: 0, // Centered on card
          y: -40
        }]);

        // Cleanup animations after a delay
        setTimeout(() => {
          setHitId(null);
        }, 500);

        setTimeout(() => {
          setDamageEffects(prev => prev.filter(e => e.id !== effectId));
        }, 1500);
      }

      // --- End Animation Sequence ---

      newLogs.push(`${currentMyPlayer.teamId} 的 ${attackerChar.name} 發動攻擊！`);
      if (isMiss) {
        newLogs.push(`攻擊落空！`);
      } else {
        if (advantage) newLogs.push(`屬性克制！額外造成 20 點傷害`);
        if (useSkill) newLogs.push(`使用技能：${attackerChar.skillName || '特殊技能'}`);
        if (effectiveItem) newLogs.push(`使用道具：${effectiveItem.name}`);
        
        // Log coin flips from damage calculation (skills/items)
        if (coinFlips && coinFlips.length > 0) {
          const heads = coinFlips.filter(c => c).length;
          newLogs.push(`擲硬幣結果：${coinFlips.map(c => c ? '正面' : '反面').join(', ')} (${heads} 個正面)`);
          
          if (useSkill && attackerChar.skillType === 'coin_damage') {
            newLogs.push(`技能效果：額外增加 ${heads * 30} 點傷害`);
          } else if (useSkill && attackerChar.skillType === 'ignore_defense_coin') {
            if (heads > 0) {
              newLogs.push(`技能效果：無視防禦並額外增加 5 點威力`);
            } else {
              newLogs.push(`技能效果：擲硬幣失敗，未能發動額外效果`);
            }
          }
        }
      }

      // Apply damage to opponent
      if (!isMiss) {
        updatedOpponentChars = applyDamage(
          updatedOpponentChars, 
          damage, 
          targetChar.id, 
          effectiveItem, 
          advantage,
          currentOpponent.activeEffects
        );
      }
      
      // Item effects (Post-attack)
      let updatedMyChars = [...currentMyPlayer.selectedChars];
      
      // Consume reactive items used by defender
      let finalOpponentActiveEffects = currentOpponent.activeEffects || [];
      if (!isMiss) {
        // If attack landed, check if we consume half_damage
        if (finalOpponentActiveEffects.some(i => i.itemType === 'half_damage')) {
          newLogs.push(`小佛的藍圖發揮作用，傷害減半！`);
          finalOpponentActiveEffects = finalOpponentActiveEffects.filter(i => i.itemType !== 'half_damage');
        }
      } else {
        // If attack missed, consume hologram
        finalOpponentActiveEffects = finalOpponentActiveEffects.filter(i => i.itemType !== 'coin_flip_miss');
      }
      // Always consume time stopper if it was used
      if (timeStopper) {
        finalOpponentActiveEffects = finalOpponentActiveEffects.filter(i => i.itemType !== 'disable_enemy_items');
      }

      if (effectiveItem) {
        if (effectiveItem.itemType === 'heal') {
          const healAmount = effectiveItem.value || 60;
          // Heal selected character or main character
          const targetId = selectedMainId || updatedMyChars.find(c => c.isMain)?.id;
          if (targetId) {
            let targetName = '';
            updatedMyChars = updatedMyChars.map(c => {
              if (c.id === targetId) {
                targetName = c.name;
                return {
                  ...c,
                  currentHp: Math.min(c.maxHp, c.currentHp + healAmount),
                  isDead: false
                };
              }
              return c;
            });
            newLogs.push(`使用了醫療箱，恢復了 ${targetName} ${healAmount} 點生命！`);
          }
        }
      }

      // Update my characters (resting state)
      updatedMyChars = updatedMyChars.map(c => {
        const isAttacker = c.id === attackerChar!.id;
        return {
          ...c,
          isMain: isAttacker,
          isResting: isAttacker // Rest next round
        };
      });

      // Update energy
      let energyGain = 0;
      if (effectiveItem) {
        if (effectiveItem.itemType === 'gain_energy') {
          energyGain = effectiveItem.value || 0;
        } else if (effectiveItem.itemType === 'gain_energy_phineas' && attackerChar.faction === '飛哥家') {
          energyGain = effectiveItem.value || 0;
        } else if (effectiveItem.itemType === 'gain_energy_doof' && attackerChar.faction === '杜芬舒斯家') {
          energyGain = effectiveItem.value || 0;
        } else if (effectiveItem.itemType === 'gain_energy_fireside' && attackerChar.faction === '美眉家') {
          energyGain = effectiveItem.value || 0;
        }
        
        if (energyGain > 0) {
          newLogs.push(`獲得了 ${energyGain} 點能量！`);
        } else if (effectiveItem.itemType.startsWith('gain_energy_')) {
          newLogs.push(`道具 ${effectiveItem.name} 與當前角色陣營不符，未獲得能量。`);
        }
      }

      const updatedPlayers = latestRoom.players.map(p => {
        if (p.uid === profile.uid) {
          const currentEnergy = p.energy || 0;
          const finalEnergy = 999; // Infinite energy
          
          return { 
            ...p, 
            selectedChars: updatedMyChars, 
            energy: finalEnergy,
            items: p.items.filter(i => i.id !== selectedItemId),
            hasAttackedThisTurn: true,
            forcedToAttack: false // Reset if I was forced
          };
        }
        if (p.uid === currentOpponent.uid) {
          return { 
            ...p, 
            selectedChars: updatedOpponentChars,
            activeEffects: finalOpponentActiveEffects,
            forcedToAttack: p.forcedToAttack // Keep existing forced state
          };
        }
        return p;
      });

      // Check if game ends immediately (one side all dead)
      const mySurvivors = updatedMyChars.filter(c => !c.isDead).length;
      const oppSurvivors = updatedOpponentChars.filter(c => !c.isDead).length;
      
      let nextTurn = currentOpponent.uid;
      let nextRound = latestRoom.currentRound;
      let nextStatus = latestRoom.status;
      let winner = null;

      if (mySurvivors === 0 || oppSurvivors === 0) {
        nextStatus = 'finished';
        if (mySurvivors > oppSurvivors) winner = profile.uid;
        else if (oppSurvivors > mySurvivors) winner = currentOpponent.uid;
        else winner = 'draw';
        newLogs.push(`對戰結束！${winner === 'draw' ? '平手' : (winner === profile.uid ? '你獲勝了！' : '對手獲勝了')}`);
      } else {
        // Check if round ends (both have taken their turn)
        const bothAttacked = updatedPlayers.every(p => p.hasAttackedThisTurn);
        if (bothAttacked) {
          if (latestRoom.currentRound >= 3) {
            nextStatus = 'finished';
            if (mySurvivors > oppSurvivors) winner = profile.uid;
            else if (oppSurvivors > mySurvivors) winner = currentOpponent.uid;
            else winner = 'draw';
            newLogs.push(`對戰結束！${winner === 'draw' ? '平手' : (winner === profile.uid ? '你獲勝了！' : '對手獲勝了')}`);
          } else {
            nextRound += 1;
            nextTurn = latestRoom.firstPlayerUid || latestRoom.players[0].uid; // Reset to first player
            nextStatus = 'preparing'; // Go back to preparing for next round
            // Reset attack flags and ALL resting states for next round
            updatedPlayers.forEach(p => {
              p.hasAttackedThisTurn = false;
              p.forcedToAttack = false;
              p.selectedChars.forEach(c => {
                c.isResting = false; // Clear resting state for next round
                c.isMain = false; // Reset main for next round selection
              });
            });
            newLogs.push(`--- 第 ${nextRound} 回合準備階段 ---`);
          }
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

      // Clean updates to remove any undefined values
      const cleanUpdates: any = {};
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          cleanUpdates[key] = updates[key];
        }
      });

      console.log('Updating room with:', JSON.stringify(cleanUpdates, null, 2));
      await gameService.updateRoom(roomId, cleanUpdates);

      // Reset local selection
      setSelectedMainId(null);
      setSelectedTargetId(null);
      setEnergyToUse(0);
      setSelectedItemId(null);
      setUseSkill(false);
    } catch (error: any) {
      console.error('Attack error:', error);
      let errorMsg = '攻擊執行失敗，請重試';
      if (error?.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errorMsg = `攻擊失敗: ${parsed.error}`;
        } catch (e) {
          errorMsg = `攻擊失敗: ${error.message}`;
        }
      }
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    if (!isMyTurn || isProcessing || myPlayer.forcedToAttack) {
      if (myPlayer.forcedToAttack) toast.error('你被全息影像裝置影響，必須發動攻擊！');
      return;
    }

    setIsProcessing(true);
    try {
      const latestRoom = await gameService.getRoom(roomId);
      if (!latestRoom || latestRoom.turn !== profile.uid) {
        setIsProcessing(false);
        return;
      }

      const currentMyPlayer = latestRoom.players.find(p => p.uid === profile.uid);
      const currentOpponent = latestRoom.players.find(p => p.uid !== profile.uid);

      if (!currentMyPlayer || !currentOpponent) {
        toast.error('對戰資料不完整');
        setIsProcessing(false);
        return;
      }

      let newLogs = [...latestRoom.logs];
      newLogs.push(`${currentMyPlayer.teamId} 選擇了防禦/跳過本回合`);

      const updatedPlayers = latestRoom.players.map(p => {
        if (p.uid === profile.uid) {
          return { ...p, hasAttackedThisTurn: true, energy: 999 };
        }
        return p;
      });

      // Check if game ends immediately
      const mySurvivors = currentMyPlayer.selectedChars.filter(c => !c.isDead).length;
      const oppSurvivors = currentOpponent.selectedChars.filter(c => !c.isDead).length;

      let nextTurn = currentOpponent.uid;
      let nextRound = latestRoom.currentRound;
      let nextStatus = latestRoom.status;
      let winner = null;

      if (mySurvivors === 0 || oppSurvivors === 0) {
        nextStatus = 'finished';
        if (mySurvivors > oppSurvivors) winner = profile.uid;
        else if (oppSurvivors > mySurvivors) winner = currentOpponent.uid;
        else winner = 'draw';
        newLogs.push(`對戰結束！${winner === 'draw' ? '平手' : (winner === profile.uid ? '你獲勝了！' : '對手獲勝了')}`);
      } else {
        // Same logic for round end
        const bothAttacked = updatedPlayers.every(p => p.hasAttackedThisTurn);
        if (bothAttacked) {
          if (latestRoom.currentRound >= 3) {
            nextStatus = 'finished';
            if (mySurvivors > oppSurvivors) winner = profile.uid;
            else if (oppSurvivors > mySurvivors) winner = currentOpponent.uid;
            else winner = 'draw';
            newLogs.push(`對戰結束！${winner === 'draw' ? '平手' : (winner === profile.uid ? '你獲勝了！' : '對手獲勝了')}`);
          } else {
            nextRound += 1;
            nextTurn = latestRoom.firstPlayerUid || latestRoom.players[0].uid;
            nextStatus = 'preparing';
            updatedPlayers.forEach(p => {
              p.hasAttackedThisTurn = false;
              p.forcedToAttack = false;
              p.selectedChars.forEach(c => {
                c.isResting = false;
                c.isMain = false;
              });
            });
            newLogs.push(`--- 第 ${nextRound} 回合準備階段 ---`);
          }
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

      // Clean updates to remove any undefined values
      const cleanUpdates: any = {};
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          cleanUpdates[key] = updates[key];
        }
      });

      console.log('Skipping turn, updating room with:', JSON.stringify(cleanUpdates, null, 2));

      await gameService.updateRoom(roomId, cleanUpdates);

      // Reset local selection states
      setEnergyToUse(0);
      setUseSkill(false);
      setSelectedItemId(null);
      setSelectedTargetId(null);
    } catch (error: any) {
      console.error('Skip error:', error);
      let errorMsg = '跳過回合失敗，請重試';
      if (error?.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errorMsg = `跳過失敗: ${parsed.error}`;
        } catch (e) {
          errorMsg = `跳過失敗: ${error.message}`;
        }
      }
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 flex flex-col lg:flex-row gap-6 overflow-hidden relative">
      {/* Skill Cut-in Overlay */}
      <AnimatePresence>
        {skillCutIn && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, x: '-100%' }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            <div className={`absolute inset-0 opacity-40 ${
              skillCutIn.faction === '飛哥家' ? 'bg-sky-500' : 
              skillCutIn.faction === '杜芬舒斯家' ? 'bg-orange-500' : 'bg-pink-500'
            }`} />
            <div className="relative flex flex-col items-center gap-4">
              <motion.div 
                initial={{ rotate: -10 }}
                animate={{ rotate: 0 }}
                className="w-64 h-96 bg-slate-800 rounded-3xl border-8 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.5)] overflow-hidden flex flex-col p-4"
              >
                <div className="text-2xl font-black text-center mb-4">{skillCutIn.name}</div>
                <div className="flex-1 bg-slate-700 rounded-xl flex items-center justify-center text-4xl font-black text-white/20">
                  {skillCutIn.rarity}
                </div>
                <div className="mt-4 p-3 bg-purple-900/50 rounded-xl border border-purple-400/30">
                  <div className="text-xs font-black text-purple-300 uppercase mb-1">Ultimate Skill</div>
                  <div className="text-sm font-bold leading-tight">{skillCutIn.skillDescription}</div>
                </div>
              </motion.div>
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-black italic text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] uppercase tracking-widest"
              >
                Skill Activation!
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Battle Arena */}
      <div className="flex-1 flex flex-col justify-between gap-8 py-4">
        {/* Opponent Side */}
        <div className="space-y-4">
          <div className="flex justify-center items-center gap-4">
            <div className="text-right">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Opponent</div>
              <div className="text-lg font-black text-white">{opponent.teamName}</div>
              {opponent.activeEffects && opponent.activeEffects.length > 0 && (
                <div className="flex gap-1 mt-1 justify-end">
                  {opponent.activeEffects.map(e => (
                    <div key={e.id} className="bg-red-500/20 border border-red-500/50 text-[8px] font-black px-1.5 py-0.5 rounded text-red-400 animate-pulse">
                      {e.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex gap-4">
              {opponent.selectedChars.filter(c => !c.isMain).map(c => (
                <BattleCardUI 
                  key={c.id} 
                  char={c} 
                  isOpponent 
                  onClick={() => {
                    if (!c.isDead) {
                      setSelectedTargetId(c.id);
                    }
                  }}
                  isSelected={selectedTargetId === c.id}
                  isHit={hitId === c.id}
                  damageEffect={damageEffects.find(e => hitId === c.id)} 
                />
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            {opponent.selectedChars.filter(c => c.isMain).map(c => (
              <BattleCardUI 
                key={c.id} 
                char={c} 
                isOpponent 
                isMain 
                onClick={() => setSelectedTargetId(null)}
                isSelected={!selectedTargetId && hitId === c.id}
                isHit={hitId === c.id}
                damageEffect={damageEffects.find(e => hitId === c.id)}
              />
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
          <div className="flex justify-center items-center gap-4">
            <div className="flex gap-4">
              {myPlayer.selectedChars.filter(c => !c.isMain).map(c => (
                <BattleCardUI 
                  key={c.id} 
                  char={c} 
                  onClick={() => !c.isDead && !c.isResting && setSelectedMainId(c.id)}
                  isSelected={selectedMainId === c.id}
                  isAttacking={attackingId === c.id}
                  isHit={hitId === c.id}
                  isCharging={selectedMainId === c.id && energyToUse > 0}
                />
              ))}
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-left">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">You</div>
              <div className="text-lg font-black text-white">{myPlayer.teamName}</div>
              {myPlayer.activeEffects && myPlayer.activeEffects.length > 0 && (
                <div className="flex gap-1 mt-1">
                  {myPlayer.activeEffects.map(e => (
                    <div key={e.id} className="bg-sky-500/20 border border-sky-500/50 text-[8px] font-black px-1.5 py-0.5 rounded text-sky-400 animate-pulse">
                      {e.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-center">
            {myPlayer.selectedChars.filter(c => c.isMain).map(c => (
              <BattleCardUI 
                key={c.id} 
                char={c} 
                isMain 
                isAttacking={attackingId === c.id}
                isHit={hitId === c.id}
                damageEffect={damageEffects.find(e => hitId === c.id)}
                isCharging={selectedMainId === c.id && energyToUse > 0}
              />
            ))}
            {!myPlayer.selectedChars.some(c => c.isMain) && (
              <div className="w-32 h-44 border-4 border-dashed border-sky-400/50 rounded-2xl flex items-center justify-center text-sky-400/50 font-bold">
                主戰位
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Battle Finished Overlay */}
      <AnimatePresence>
        {room.status === 'finished' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="max-w-md w-full bg-slate-900 border-2 border-white/10 rounded-[2.5rem] p-10 text-center shadow-2xl relative overflow-hidden"
            >
              {/* Background Glow */}
              <div className={`absolute -top-24 -left-24 w-48 h-48 rounded-full blur-[100px] opacity-30 ${
                room.winner === profile.uid ? 'bg-yellow-500' : 
                room.winner === 'draw' ? 'bg-sky-500' : 'bg-red-500'
              }`} />
              <div className={`absolute -bottom-24 -right-24 w-48 h-48 rounded-full blur-[100px] opacity-30 ${
                room.winner === profile.uid ? 'bg-yellow-500' : 
                room.winner === 'draw' ? 'bg-sky-500' : 'bg-red-500'
              }`} />

              <div className="relative space-y-8">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 5 }}
                >
                  <Trophy className={`w-24 h-24 mx-auto ${
                    room.winner === profile.uid ? 'text-yellow-500' : 
                    room.winner === 'draw' ? 'text-sky-400' : 'text-slate-500'
                  }`} />
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-5xl font-black italic tracking-tighter uppercase">
                    {room.winner === profile.uid ? 'Victory!' : 
                     room.winner === 'draw' ? 'Draw' : 'Defeat'}
                  </h2>
                  <div className="py-2 px-4 bg-white/5 rounded-xl inline-block">
                    <span className="text-sm font-bold text-slate-400">獲勝者：</span>
                    <span className="text-lg font-black text-white">
                      {room.winner === 'draw' ? '雙方平手' : 
                       (room.winner === profile.uid ? myPlayer.teamName : opponent.teamName)}
                    </span>
                  </div>
                  <p className="text-slate-400 font-bold">
                    {room.winner === profile.uid ? '恭喜你贏得了這場對戰！' : 
                     room.winner === 'draw' ? '這是一場勢均力敵的較量！' : '下次再接再厲，飛哥家永不言敗！'}
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    onClick={onFinish}
                    className="w-full bg-sky-500 hover:bg-sky-600 text-white py-5 rounded-2xl font-black text-xl shadow-[0_0_30_rgba(14,165,233,0.4)] transition-all transform active:scale-95 flex items-center justify-center gap-3"
                  >
                    返回主選單 <Trophy className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              <p className="text-slate-400 font-bold">請查看結算畫面</p>
            </div>
          ) : room.status === 'selecting_first_player' ? (
            <div className="text-center space-y-6 py-8 bg-sky-500/10 rounded-3xl border-2 border-sky-500/30 p-6">
              <div className="relative">
                <Sword className="w-16 h-16 text-sky-500 mx-auto animate-pulse" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-sky-400">選擇先攻方</h4>
                <p className="text-slate-300 font-bold">
                  {room.players[0].uid === profile.uid ? '你是房主，請選擇誰先開始戰鬥' : '等待房主選擇先攻方...'}
                </p>
              </div>

              {room.players[0].uid === profile.uid && (
                <div className="grid grid-cols-2 gap-4">
                  {room.players.map(p => (
                    <button
                      key={p.uid}
                      onClick={() => gameService.setFirstPlayer(roomId, p.uid)}
                      className="py-4 bg-sky-500 hover:bg-sky-600 rounded-2xl font-black text-lg shadow-lg transition-all transform active:scale-95"
                    >
                      {p.uid === profile.uid ? '我方先攻' : '對手先攻'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (room.status === 'preparing' || room.status === 'selecting_chars') ? (
            <div className="text-center space-y-6 py-8 bg-sky-500/10 rounded-3xl border-2 border-sky-500/30 p-6">
              <div className="relative">
                <Shield className="w-16 h-16 text-sky-500 mx-auto animate-pulse" />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute top-0 right-1/2 translate-x-8 bg-orange-500 text-[10px] font-black px-2 py-0.5 rounded-full"
                >
                  PHASE 1
                </motion.div>
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-sky-400">準備階段</h4>
                <p className="text-slate-300 font-bold">請從下方存活角色中挑選一位指派為主戰位</p>
              </div>
              
              <div className="flex justify-center gap-4 py-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${myPlayer.selectedChars.some(c => c.isMain) ? 'bg-green-500 border-green-400' : 'bg-slate-800 border-slate-700'}`}>
                    {myPlayer.selectedChars.some(c => c.isMain) && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">你</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${opponent.selectedChars.some(c => c.isMain) ? 'bg-green-500 border-green-400' : 'bg-slate-800 border-slate-700'}`}>
                    {opponent.selectedChars.some(c => c.isMain) && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">對手</span>
                </div>
              </div>

              {myPlayer.selectedChars.some(c => c.isMain) ? (
                <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-2xl text-green-400 font-bold flex items-center justify-center gap-2 animate-pulse">
                  <Check className="w-5 h-5" /> 已就緒，等待對手...
                </div>
              ) : (
                <button 
                  onClick={handleConfirmMain}
                  disabled={!selectedMainId || isProcessing}
                  className={`w-full py-5 rounded-2xl font-black text-xl shadow-lg transition-all transform active:scale-95 ${!selectedMainId || isProcessing ? 'bg-gray-600 grayscale cursor-not-allowed' : 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/20'}`}
                >
                  {isProcessing ? '處理中...' : '確認指派'}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Energy Selection */}
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-1">
                  <Zap className="w-4 h-4 text-blue-400" /> 使用能量 (無限能量)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3, 4, 5, 10, 99].map(val => (
                    <button
                      key={val}
                      onClick={() => setEnergyToUse(val)}
                      disabled={!isMyTurn}
                      className={`py-2 rounded-xl font-bold border-2 transition-all ${energyToUse === val ? 'bg-blue-500 border-blue-300' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                      {val === 0 ? '不使用' : val === 1 ? '+20' : val === 2 ? '+60' : `+${val * 30}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Toggle */}
              <button
                onClick={() => setUseSkill(!useSkill)}
                disabled={!isMyTurn || !selectedMainId}
                className={`w-full py-3 rounded-xl font-black border-2 transition-all flex items-center justify-center gap-2 ${useSkill ? 'bg-purple-500 border-purple-300' : 'bg-white/5 border-white/10'}`}
              >
                <Zap className="w-5 h-5" /> 使用技能
              </button>

              {/* Item Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold">使用道具</label>
                  {opponent.activeEffects?.some(i => i.itemType === 'disable_enemy_items') && (
                    <span className="text-[10px] font-black text-red-500 animate-pulse flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                      <Shield className="w-3 h-3" /> 時間停止中！
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <select 
                    value={selectedItemId || ''} 
                    onChange={(e) => setSelectedItemId(e.target.value || null)}
                    disabled={!isMyTurn || opponent.activeEffects?.some(i => i.itemType === 'disable_enemy_items')}
                    className={`flex-1 bg-white/5 border-2 border-white/10 rounded-xl p-3 font-bold focus:outline-none focus:border-sky-400 ${(!isMyTurn || opponent.activeEffects?.some(i => i.itemType === 'disable_enemy_items')) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <option value="" className="bg-slate-800">不使用道具</option>
                    {myPlayer.items.map(item => (
                      <option key={item.id} value={item.id} className="bg-slate-800">{item.name}</option>
                    ))}
                  </select>
                  {selectedItemId && (
                    <button
                      onClick={() => handleUseItem(selectedItemId)}
                      disabled={isProcessing || opponent.activeEffects?.some(i => i.itemType === 'disable_enemy_items')}
                      className={`px-4 bg-sky-500 hover:bg-sky-600 rounded-xl font-black text-xs transition-all active:scale-95 ${opponent.activeEffects?.some(i => i.itemType === 'disable_enemy_items') ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      立即使用
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-bold px-1">
                  * 攻擊類道具請點擊「確認攻擊」；即時/防禦類道具可點擊「立即使用」。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleAttack}
                  disabled={!isMyTurn || !selectedMainId || isProcessing}
                  className={`py-5 rounded-2xl font-black text-xl shadow-lg transition-all transform active:scale-95 ${!isMyTurn || !selectedMainId ? 'bg-gray-600 grayscale cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'}`}
                >
                  {isProcessing ? '處理中...' : '確認攻擊'}
                </button>
                <button
                  onClick={handleSkip}
                  disabled={!isMyTurn || isProcessing || myPlayer.forcedToAttack}
                  className={`py-5 rounded-2xl font-black text-xl shadow-lg transition-all transform active:scale-95 ${!isMyTurn || myPlayer.forcedToAttack ? 'bg-gray-600 grayscale cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 border border-white/10'}`}
                >
                  {myPlayer.forcedToAttack ? '被迫攻擊' : '防禦/跳過'}
                </button>
              </div>
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

function BattleCardUI({ 
  char, 
  isOpponent = false, 
  isMain = false, 
  onClick, 
  isSelected = false,
  isAttacking = false,
  isHit = false,
  isCharging = false,
  damageEffect
}: { 
  char: BattleCharacter, 
  isOpponent?: boolean, 
  isMain?: boolean, 
  onClick?: () => void, 
  isSelected?: boolean,
  isAttacking?: boolean,
  isHit?: boolean,
  isCharging?: boolean,
  damageEffect?: DamageEffect,
  key?: React.Key
}) {
  const hpPercent = (char.currentHp / char.maxHp) * 100;
  
  return (
    <motion.div 
      layout
      onClick={onClick}
      animate={{
        y: isAttacking ? (isOpponent ? 50 : -50) : 0,
        x: isHit ? [0, -10, 10, -10, 10, 0] : 0,
        scale: isAttacking ? 1.1 : (isHit ? 0.95 : 1),
      }}
      transition={{
        x: { duration: 0.4, ease: "easeInOut" },
        y: { type: "spring", stiffness: 300, damping: 20 }
      }}
      className={`relative w-28 sm:w-32 h-40 sm:h-44 rounded-2xl border-4 transition-all overflow-hidden cursor-pointer
        ${char.isDead ? 'grayscale opacity-50 border-red-500' : (isMain ? 'border-yellow-400 ring-4 ring-yellow-400/50' : 'border-white/20')}
        ${isSelected ? 'scale-110 ring-4 ring-sky-400' : ''}
        ${char.isResting && !char.isDead ? 'opacity-70 border-blue-400' : ''}
        ${isOpponent ? 'bg-slate-800' : 'bg-slate-700'}
        ${isHit ? 'bg-red-900/40' : ''}
        ${isCharging ? 'shadow-[0_0_20px_rgba(59,130,246,0.8)]' : ''}
      `}
    >
      {/* Energy Pulse Effect */}
      {isCharging && (
        <motion.div
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="absolute inset-0 bg-blue-500/20 pointer-events-none"
        />
      )}
      {/* Damage Number Overlay */}
      <AnimatePresence>
        {damageEffect && (
          <motion.div
            key={damageEffect.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -60, scale: damageEffect.isAdvantage ? 1.5 : 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
          >
            <div className="flex flex-col items-center">
              <span className={`text-3xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${
                damageEffect.isAdvantage ? 'text-yellow-400' : 'text-red-500'
              }`}>
                -{damageEffect.amount}
              </span>
              {damageEffect.isAdvantage && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-yellow-400 text-black text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1"
                >
                  <Star className="w-2 h-2 fill-black" /> ADVANTAGE
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-2 h-full flex flex-col justify-between">
        <div className="text-[10px] font-black uppercase tracking-tighter truncate">{char.name}</div>
        
        <div className="space-y-1">
          <div className="flex justify-between text-[8px] font-bold">
            <span>HP</span>
            <span>{char.currentHp}/{char.maxHp}</span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: `${hpPercent}%` }}
              animate={{ width: `${hpPercent}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
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
