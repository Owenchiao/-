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
  const [atkBoostToUse, setAtkBoostToUse] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [useSkill, setUseSkill] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasRecordedResult, setHasRecordedResult] = useState(false);
  
  const getEnergyCost = (boost: number) => {
    if (boost === 20) return 1;
    if (boost === 30) return 1.5;
    if (boost === 60) return 2;
    if (boost === 90) return 3;
    if (boost === 120) return 4;
    return 0;
  };

  const handleUseItem = async (itemId: string) => {
    if (isProcessing) return;
    
    try {
      const latestRoom = await gameService.getRoom(roomId);
      if (!latestRoom) return;

      const myP = latestRoom.players.find(p => p.uid === profile.uid);
      const oppP = latestRoom.players.find(p => p.uid !== profile.uid);
      if (!myP || !oppP) return;

      const item = myP.items.find(i => i.id === itemId);
      if (!item) return;

      // Check if it's my turn or if the item can be used anytime
      const isMyTurn = latestRoom.turn === profile.uid;
      if (!isMyTurn && item.usageTiming !== 'any_turn' && item.usageTiming !== 'enemy_attack_phase') {
        toast.error('現在不是你的回合，且此道具無法在對方回合使用');
        return;
      }

      setIsProcessing(true);

      // Check for Time Stopper (disable_enemy_items) on opponent
      if (oppP.activeEffects?.some(i => i.itemType === 'disable_enemy_items')) {
        toast.error('對手使用了時間停止器，本回合你無法使用道具卡！');
        setIsProcessing(false);
        return;
      }

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
      } else if (item.itemType === 'gain_energy_phineas' || item.itemType === 'gain_energy_doof' || item.itemType === 'gain_energy_fireside') {
        // Handled in handleAttack or here? Let's handle here for instant use
        const mainChar = updatedMyChars.find(c => c.isMain);
        if (mainChar) {
          let canGain = false;
          if (item.itemType === 'gain_energy_phineas' && mainChar.faction === '飛哥家') canGain = true;
          if (item.itemType === 'gain_energy_doof' && mainChar.faction === '杜芬舒斯家') canGain = true;
          if (item.itemType === 'gain_energy_fireside' && mainChar.faction === '美眉家') canGain = true;
          
          if (canGain) {
            energyGain = item.value || 1;
            newLogs.push(`${myP.teamName} 使用了 ${item.name}，${mainChar.name} 獲得 ${energyGain} 點能量！`);
          } else {
            toast.error('陣營不符，無法獲得能量');
            setIsProcessing(false);
            return;
          }
        } else {
          toast.error('請先指派主戰角色');
          setIsProcessing(false);
          return;
        }
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
          let updatedChars = p.selectedChars.map(c => ({
            ...c,
            isMain: c.id === selectedMainId
          }));

          // Handle on_enter skills (self)
          const enteringChar = updatedChars.find(c => c.id === selectedMainId);
          if (enteringChar) {
            updatedChars = updatedChars.map(c => {
              if (c.id === selectedMainId) return { ...c, isFirstTurn: true };
              return { ...c, isFirstTurn: false };
            });
          }

          if (enteringChar?.skillTrigger === 'on_enter') {
            if (enteringChar.skillType === 'battle_start_heal_sub') {
              updatedChars = updatedChars.map(c => {
                if (!c.isMain && !c.isDead) {
                  return { ...c, currentHp: Math.min(c.maxHp, c.currentHp + 10) };
                }
                return c;
              });
              latestRoom.logs.push(`${enteringChar.name} 登場！為備戰區角色恢復了 10 點生命值。`);
            } else if (enteringChar.skillType === 'gain_energy') {
              latestRoom.logs.push(`${enteringChar.name} 登場！獲得了額外能量。`);
            } else if (enteringChar.skillType === 'atk_up_fixed') {
              // Isabella Goddess U
              const hasInjured = updatedChars.some(c => c.currentHp < c.maxHp);
              if (hasInjured) {
                updatedChars = updatedChars.map(c => {
                  if (c.id === enteringChar.id) return { ...c, atk: c.atk + 30 };
                  return c;
                });
                latestRoom.logs.push(`${enteringChar.name} 登場！感應到同伴受傷，攻擊力提升 30 點！`);
              }
            }
          }

          return {
            ...p,
            energy: 999, // Infinite energy
            selectedChars: updatedChars
          };
        } else {
          // Handle on_enter skills (against opponent)
          const myEnteringChar = latestRoom.players.find(pl => pl.uid === profile.uid)?.selectedChars.find(c => c.id === selectedMainId);
          if (myEnteringChar?.skillTrigger === 'on_enter') {
            if (myEnteringChar.skillType === 'disable_enemy_skill') {
              // Candace Mars U
              const updatedOpponentChars = p.selectedChars.map(c => {
                if (c.isMain) return { ...c, isSkillDisabled: true };
                return c;
              });
              latestRoom.logs.push(`${myEnteringChar.name} 登場！使敵方角色下一回合無法使用技能。`);
              return { ...p, selectedChars: updatedOpponentChars };
            } else if (myEnteringChar.skillType === 'force_swap_main') {
              // Holly Sacred U
              const aliveSubs = p.selectedChars.filter(c => !c.isMain && !c.isDead);
              if (aliveSubs.length > 0) {
                const randomSub = aliveSubs[Math.floor(Math.random() * aliveSubs.length)];
                const updatedOpponentChars = p.selectedChars.map(c => ({
                  ...c,
                  isMain: c.id === randomSub.id
                }));
                latestRoom.logs.push(`${myEnteringChar.name} 登場！強制將敵方角色與其備戰區的 ${randomSub.name} 交換！`);
                return { ...p, selectedChars: updatedOpponentChars };
              }
            }
          }
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
      let updatedMyChars = [...currentMyPlayer.selectedChars];
      let updatedOpponentChars = [...currentOpponent.selectedChars];

      const isSkillActive = useSkill || attackerChar.skillEnergyCost === 0;

      // Check for one-time use skills
      if (useSkill && attackerChar.isSkillUsed) {
        toast.error('此技能每場戰鬥只能使用一次');
        setIsProcessing(false);
        return;
      }

      // Check if skill is disabled
      if (isSkillActive && attackerChar.isSkillDisabled) {
        if (useSkill) toast.error('技能已被封印，本回合無法使用');
        // If it's a passive, we just don't trigger it, no toast needed unless it's the main action
      }

      // Check for Candace's Report Letter (force_swap_main) - Move timing to BEFORE attack
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

      const { damage, advantage, isMiss } = calculateDamage(
        attackerChar, 
        targetChar, 
        atkBoostToUse, 
        isSkillActive, 
        effectiveItem,
        currentOpponent.activeEffects
      );

      // Check energy cost - Infinite energy bypass
      const energyCost = getEnergyCost(atkBoostToUse) + (useSkill ? attackerChar.skillEnergyCost || 0 : 0);
      /* 
      if (energyCost > currentMyPlayer.energy) {
        toast.error('能量不足');
        setIsProcessing(false);
        return;
      }
      */

      // --- Start Animation Sequence ---
      
      // 1. Skill Cut-in & Before Attack Skills
      if (isSkillActive && !attackerChar.isSkillDisabled) {
        setSkillCutIn(attackerChar);
        
        // Handle before_attack skills (like heal_self_fixed)
        if (attackerChar.skillTrigger === 'before_attack' && attackerChar.skillType === 'heal_self_fixed') {
          const healAmount = attackerChar.id === 'char_baljeet_r' ? 20 : 10;
          updatedMyChars = updatedMyChars.map(c => {
            if (c.id === attackerChar!.id) {
              return { ...c, currentHp: Math.min(c.maxHp, c.currentHp + healAmount) };
            }
            return c;
          });
          newLogs.push(`${attackerChar.name} 發動技能：${attackerChar.skillName || '被動技能'}，恢復了 ${healAmount} 點生命！`);
        }

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
        if (isSkillActive && !attackerChar.isSkillDisabled) newLogs.push(`發動技能：${attackerChar.skillName || '被動技能'}`);
        if (effectiveItem) newLogs.push(`使用道具：${effectiveItem.name}`);
      }

      // Apply damage to opponent
      if (!isMiss) {
        updatedOpponentChars = applyDamage(
          updatedOpponentChars, 
          damage, 
          targetChar.id, 
          effectiveItem, 
          advantage,
          currentOpponent.activeEffects,
          attackerChar,
          isSkillActive && !attackerChar.isSkillDisabled
        );

        // Handle after_attack skills (like hit_lowest_sub)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillTrigger === 'after_attack' && attackerChar.skillType === 'hit_lowest_sub') {
          const aliveSubs = updatedOpponentChars.filter(c => !c.isMain && !c.isDead);
          if (aliveSubs.length > 0) {
            const lowestHpSub = aliveSubs.reduce((prev, curr) => (prev.currentHp < curr.currentHp ? prev : curr));
            updatedOpponentChars = updatedOpponentChars.map(c => {
              if (c.id === lowestHpSub.id) {
                const newHp = Math.max(0, c.currentHp - 15);
                return { ...c, currentHp: newHp, isDead: newHp === 0 };
              }
              return c;
            });
            newLogs.push(`${attackerChar.name} 的後續攻擊命中了備戰區的 ${lowestHpSub.name}，造成 15 點傷害！`);
          }
        }

        // Handle reflect_direct_damage (Brigitte Myth UR)
        const defenderMain = updatedOpponentChars.find(c => c.isMain);
        if (defenderMain?.skillType === 'reflect_direct_damage') {
          const reflectedDamage = Math.floor(damage * 0.5);
          updatedMyChars = updatedMyChars.map(c => {
            if (c.id === attackerChar!.id) {
              const newHp = Math.max(0, c.currentHp - reflectedDamage);
              return { ...c, currentHp: newHp, isDead: newHp === 0 };
            }
            return c;
          });
          newLogs.push(`${defenderMain.name} 反彈了 ${reflectedDamage} 點傷害給 ${attackerChar.name}！`);
        }

        // Handle counter_damage_and_buff_next_atk (Treehouse U)
        if (defenderMain?.skillType === 'counter_damage_and_buff_next_atk') {
          updatedMyChars = updatedMyChars.map(c => {
            if (c.id === attackerChar!.id) {
              const newHp = Math.max(0, c.currentHp - 10);
              return { ...c, currentHp: newHp, isDead: newHp === 0, atk: c.atk + 5 };
            }
            return c;
          });
          newLogs.push(`${defenderMain.name} 反擊了 10 點傷害，並使其下一回合攻擊力增加 5 點！`);
        }

        // Handle gain_energy_on_coin (Reginald R, Ginger Lucky R)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'gain_energy_on_coin') {
          const isHeads = Math.random() > 0.5;
          if (isHeads) {
            newLogs.push(`${attackerChar.name} 擲硬幣為正面，獲得 1 點能量！`);
          } else {
            newLogs.push(`${attackerChar.name} 擲硬幣為反面，未能獲得能量。`);
          }
        }

        // Handle extra_energy_attach_on_coin (Kevin Zebra U)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'extra_energy_attach_on_coin') {
          const coin1 = Math.random() > 0.5;
          const coin2 = Math.random() > 0.5;
          if (coin1 && coin2) {
            newLogs.push(`${attackerChar.name} 擲出兩次正面！獲得額外能量放置次數。`);
          } else {
            newLogs.push(`${attackerChar.name} 擲硬幣結果：${coin1 ? '正' : '反'}${coin2 ? '正' : '反'}，未能獲得額外次數。`);
          }
        }

        // Handle swap_main_sub (Mummy U)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'swap_main_sub') {
          const aliveSubs = updatedMyChars.filter(c => !c.isMain && !c.isDead);
          if (aliveSubs.length > 0) {
            const randomSub = aliveSubs[Math.floor(Math.random() * aliveSubs.length)];
            updatedMyChars = updatedMyChars.map(c => {
              if (c.isMain) return { ...c, isMain: false, currentHp: Math.min(c.hp, c.currentHp + 20) };
              if (c.id === randomSub.id) return { ...c, isMain: true, currentHp: Math.min(c.hp, c.currentHp + 20) };
              return c;
            });
            newLogs.push(`${attackerChar.name} 使用技能與 ${randomSub.name} 交換位置，並各自恢復 20 點生命！`);
          }
        }

        // Handle end_enemy_turn_and_alt_win (Holly Queen UR)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'end_enemy_turn_and_alt_win') {
          newLogs.push(`${attackerChar.name} 使用聖光力量，強制結束對方回合！`);
        }

        // Handle double_attack_half_second (Isabella Eternal UR)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'double_attack_half_second') {
          const secondDamage = Math.floor(damage * 0.5);
          updatedOpponentChars = updatedOpponentChars.map(c => {
            if (c.isMain) {
              const newHp = Math.max(0, c.currentHp - secondDamage);
              return { ...c, currentHp: newHp, isDead: newHp === 0 };
            }
            return c;
          });
          newLogs.push(`${attackerChar.name} 發動第二次攻擊，造成 ${secondDamage} 點傷害！`);
        }

        // Handle disable_enemy_skill (Charles U)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'disable_enemy_skill') {
          updatedOpponentChars = updatedOpponentChars.map(c => {
            if (c.isMain) return { ...c, isSkillDisabled: true };
            return c;
          });
          newLogs.push(`${attackerChar.name} 發動技能：封印了對手的技能！`);
        }

        // Handle choose_sub_damage (Norm Army UR)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'choose_sub_damage') {
          const aliveSubs = updatedOpponentChars.filter(c => !c.isMain && !c.isDead);
          if (aliveSubs.length > 0) {
            const randomSub = aliveSubs[Math.floor(Math.random() * aliveSubs.length)];
            updatedOpponentChars = updatedOpponentChars.map(c => {
              if (c.id === randomSub.id) {
                const subDamage = c.atk;
                const newHp = Math.max(0, c.currentHp - subDamage);
                return { ...c, currentHp: newHp, isDead: newHp === 0 };
              }
              return c;
            });
            newLogs.push(`${attackerChar.name} 的諾姆軍團襲擊了備戰區的 ${randomSub.name}，造成 ${randomSub.atk} 點傷害！`);
          }
        }

        // Handle redirect_attack_to_sub (Squirrels UR)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'redirect_attack_to_sub') {
          const aliveSubs = updatedOpponentChars.filter(c => !c.isMain && !c.isDead);
          if (aliveSubs.length > 0) {
            const randomSub = aliveSubs[Math.floor(Math.random() * aliveSubs.length)];
            updatedOpponentChars = updatedOpponentChars.map(c => {
              if (c.id === randomSub.id) {
                const newHp = Math.max(0, c.currentHp - damage);
                return { ...c, currentHp: newHp, isDead: newHp === 0 };
              }
              // Main takes no damage from this specific skill effect if redirected? 
              // Actually the skill says "對方主要角色攻擊備戰角色", so maybe main takes no damage.
              if (c.isMain) return { ...c, currentHp: Math.min(c.maxHp, c.currentHp + damage) }; // Revert damage to main
              return c;
            });
            newLogs.push(`${attackerChar.name} 使對手自相殘殺！攻擊被導向了備戰區的 ${randomSub.name}！`);
          }
        }

        // Handle random_steal_item (Phineas Singer UR)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'random_steal_item') {
          newLogs.push(`${attackerChar.name} 展現歌喉，隨機奪取了對手的一張道具卡！`);
        }

        // Handle gain_gold_on_coin (Ronnie R)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'gain_gold_on_coin') {
          const heads = [Math.random() > 0.5, Math.random() > 0.5, Math.random() > 0.5].filter(Boolean).length;
          newLogs.push(`${attackerChar.name} 擲硬幣獲得了 ${heads * 5} 枚額外金幣！`);
        }

        // Handle attach_energy_to_sub (Mitch R, Josette R)
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'attach_energy_to_sub') {
          newLogs.push(`${attackerChar.name} 為備戰區隊友準備了額外能量！`);
        }

        // Handle after_battle skills (if target died)
        const targetNow = updatedOpponentChars.find(c => c.id === targetChar.id);
        if (targetNow?.isDead) {
          if (attackerChar.skillType === 'bonus_gold_on_kill') {
            newLogs.push(`${attackerChar.name} 擊敗了對手！獲得額外金幣獎勵。`);
          }
        }

        // Mark one-time skills as used
        if (useSkill && attackerChar.skillType === 'atk_up_fixed' && attackerChar.id === 'char_buford_scary_r') {
          updatedMyChars = updatedMyChars.map(c => {
            if (c.id === attackerChar!.id) return { ...c, isSkillUsed: true };
            return c;
          });
        }

        // Handle heal_sub_fixed (Brigitte Iron U) - Passive after battle
        const attackerNow = updatedMyChars.find(c => c.id === attackerChar.id);
        if (isSkillActive && !attackerChar.isSkillDisabled && attackerChar.skillType === 'heal_sub_fixed' && attackerNow && !attackerNow.isDead) {
          const aliveSubs = updatedMyChars.filter(c => !c.isMain && !c.isDead);
          let healedSubName = '';
          const subToHeal = aliveSubs.length > 0 ? aliveSubs[Math.floor(Math.random() * aliveSubs.length)] : null;
          
          updatedMyChars = updatedMyChars.map(c => {
            if (c.id === attackerChar!.id) {
              return { ...c, currentHp: Math.min(c.maxHp, c.currentHp + 15) };
            }
            if (subToHeal && c.id === subToHeal.id) {
              healedSubName = c.name;
              return { ...c, currentHp: Math.min(c.maxHp, c.currentHp + 15) };
            }
            return c;
          });
          newLogs.push(`${attackerChar.name} 發動技能：${attackerChar.skillName || '鋼鐵修復'}，為自己${healedSubName ? `與 ${healedSubName}` : ''} 恢復了 15 點生命！`);
        }
      }
      
      // Item effects (Post-attack)
      // updatedMyChars is already declared at the top of handleAttack
      
      // Consume reactive items used by defender
      let finalOpponentActiveEffects = currentOpponent.activeEffects || [];
      if (!isMiss) {
        // If attack landed, check if we consume half_damage
        if (finalOpponentActiveEffects.some(i => i.itemType === 'half_damage')) {
          newLogs.push(`小佛的藍圖發揮作用，本回合我的角色受到的傷害減半！`);
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
          if (effectiveItem.id === 'item_lucky_coin') {
            const isHeads = Math.random() > 0.5;
            if (isHeads) {
              energyGain = effectiveItem.value || 1;
              newLogs.push(`幸運硬幣擲出正面！獲得了 ${energyGain} 點能量！`);
            } else {
              newLogs.push(`幸運硬幣擲出反面，未能獲得能量。`);
            }
          } else {
            energyGain = effectiveItem.value || 0;
            newLogs.push(`獲得了 ${energyGain} 點能量！`);
          }
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
                c.isSkillDisabled = false; // Reset skill disabled state
                c.isFirstTurn = false; // Reset first turn flag
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
      setAtkBoostToUse(0);
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
                c.isSkillDisabled = false; // Reset skill disabled state
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
      setAtkBoostToUse(0);
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
                  isCharging={selectedMainId === c.id && atkBoostToUse > 0}
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
                isCharging={selectedMainId === c.id && atkBoostToUse > 0}
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
          ) : room.status === 'preparing' ? (
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
                  <Zap className="w-4 h-4 text-blue-400" /> 消耗能量增加攻擊力
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 0, label: '不使用' },
                    { val: 20, label: '1點 (+20)' },
                    { val: 30, label: '1.5點 (+30)' },
                    { val: 60, label: '2點 (+60)' },
                    { val: 90, label: '3點 (+90)' },
                    { val: 120, label: '4點 (+120)' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setAtkBoostToUse(opt.val)}
                      disabled={!isMyTurn}
                      className={`py-2 rounded-xl font-bold border-2 transition-all text-xs ${atkBoostToUse === opt.val ? 'bg-blue-500 border-blue-300' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skill Toggle */}
              {myPlayer.selectedChars.find(c => c.isMain)?.skillEnergyCost === 0 ? (
                <div className="w-full py-3 rounded-xl font-black border-2 border-green-500/50 bg-green-500/10 flex items-center justify-center gap-2 text-green-400">
                  <Star className="w-5 h-5" /> 被動技能已就緒
                </div>
              ) : (
                <button
                  onClick={() => setUseSkill(!useSkill)}
                  disabled={!isMyTurn || !selectedMainId}
                  className={`w-full py-3 rounded-xl font-black border-2 transition-all flex items-center justify-center gap-2 ${useSkill ? 'bg-purple-500 border-purple-300' : 'bg-white/5 border-white/10'}`}
                >
                  <Zap className="w-5 h-5" /> 使用技能
                </button>
              )}

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
                    disabled={opponent.activeEffects?.some(i => i.itemType === 'disable_enemy_items')}
                    className={`flex-1 bg-white/5 border-2 border-white/10 rounded-xl p-3 font-bold focus:outline-none focus:border-sky-400 ${opponent.activeEffects?.some(i => i.itemType === 'disable_enemy_items') ? 'opacity-50 cursor-not-allowed' : ''}`}
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
