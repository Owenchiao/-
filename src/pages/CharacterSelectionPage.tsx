import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Team, UserProfile, Room, CharacterCard, BattleCharacter } from '../types';
import { gameService } from '../services/gameService';
import { CHARACTERS } from '../cardDatabase';
import { CharacterCardUI } from './InventoryPage';
import { Check, Loader2, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  roomId: string;
  team: Team;
  profile: UserProfile;
  onStartBattle: () => void;
  onCancel: () => void;
}

export default function CharacterSelectionPage({ roomId, team, profile, onStartBattle, onCancel }: Props) {
  const [room, setRoom] = useState<Room | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const teamChars = CHARACTERS.filter(c => team.inventory.characters.includes(c.id));

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('房間代碼已複製！');
  };

  useEffect(() => {
    const unsubscribe = gameService.subscribeToRoom(roomId, (updatedRoom) => {
      setRoom(updatedRoom);
      
      // Check if both players are ready
      const allReady = updatedRoom.players.every(p => p.selectedChars.length === 3);
      if (allReady && updatedRoom.status === 'selecting_chars') {
        gameService.updateRoom(roomId, { status: 'preparing' });
      }
      
      if (updatedRoom.status === 'preparing' || updatedRoom.status === 'battle') {
        onStartBattle();
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  const toggleSelect = (id: string) => {
    if (ready) return;
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else if (selectedIds.length < 3) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.length !== 3) {
      toast.error('請選擇 3 張角色卡');
      return;
    }
    setReady(true);
    
    const selectedChars: BattleCharacter[] = selectedIds.map(id => {
      const char = CHARACTERS.find(c => c.id === id)!;
      return {
        ...char,
        currentHp: char.hp ?? 0,
        maxHp: char.hp ?? 0,
        isDead: (char.hp ?? 0) <= 0,
        isResting: false,
        isMain: false
      };
    });

    if (room) {
      const updatedPlayers = room.players.map(p => {
        if (p.uid === profile.uid) {
          return { ...p, selectedChars };
        }
        return p;
      });
      await gameService.updateRoom(roomId, { players: updatedPlayers });
    }
  };

  if (!room) return <div className="p-10 text-center">載入房間中...</div>;

  const otherPlayer = room.players.find(p => p.uid !== profile.uid);
  const isOtherReady = otherPlayer && otherPlayer.selectedChars.length === 3;

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border-2 border-sky-200 shadow-sm">
            <span className="text-sky-600 font-black">房間代碼：{roomId}</span>
            <button 
              onClick={copyRoomId}
              className="p-1 hover:bg-sky-50 rounded-full transition-colors text-sky-400"
              title="複製代碼"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-sky-600">選擇出戰角色</h1>
            <p className="text-gray-500 font-bold">請從你的背包中挑選 3 位英雄進入戰場 ({selectedIds.length}/3)</p>
          </div>
        </div>

        <div className="flex justify-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${ready ? 'bg-green-500' : 'bg-gray-200'}`}>
              {ready ? <Check className="text-white" /> : <span className="font-bold">我</span>}
            </div>
            <span className="text-xs font-bold">你已就緒</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOtherReady ? 'bg-green-500' : 'bg-gray-200'}`}>
              {isOtherReady ? <Check className="text-white" /> : <Loader2 className="animate-spin text-gray-400" />}
            </div>
            <span className="text-xs font-bold">對手就緒</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {teamChars.map(char => (
            <CharacterCardUI 
              key={char.id} 
              char={char} 
              selected={selectedIds.includes(char.id)}
              onClick={() => toggleSelect(char.id)}
            />
          ))}
        </div>

        <div className="fixed bottom-8 left-0 right-0 flex justify-center gap-4 px-6">
          <button 
            onClick={onCancel}
            className="bg-white text-gray-500 px-8 py-4 rounded-2xl font-black shadow-lg border-2 border-gray-200 hover:bg-gray-50"
          >
            取消對戰
          </button>
          <button 
            onClick={handleConfirm}
            disabled={ready || selectedIds.length !== 3}
            className={`${ready || selectedIds.length !== 3 ? 'bg-gray-300' : 'bg-orange-500 hover:bg-orange-600'} text-white px-12 py-4 rounded-2xl font-black shadow-lg transition-transform active:scale-95`}
          >
            {ready ? '等待對手中...' : '確認出戰'}
          </button>
        </div>
      </div>
    </div>
  );
}
