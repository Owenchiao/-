import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Team, UserProfile, Room, PlayerState } from '../types';
import { gameService } from '../services/gameService';
import { Plus, Users, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ITEMS } from '../constants';

interface Props {
  team: Team;
  profile: UserProfile;
  onBack: () => void;
  onEnterRoom: (roomId: string) => void;
}

export default function LobbyPage({ team, profile, onBack, onEnterRoom }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    const waitingRooms = await gameService.getWaitingRooms();
    setRooms(waitingRooms);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreateRoom = async () => {
    setJoining(true);
    const player: PlayerState = {
      uid: profile.uid,
      teamId: team.id,
      teamName: team.name,
      selectedChars: [],
      items: ITEMS.filter(i => team.inventory.items.includes(i.id)),
      energy: 4, // 4 coins as per rules
      hasAttackedThisTurn: false,
      forcedToAttack: false
    };
    const roomId = await gameService.createRoom(player);
    if (roomId) {
      onEnterRoom(roomId);
    } else {
      toast.error('建立房間失敗');
    }
    setJoining(false);
  };

  const handleJoinRoom = async (roomId: string) => {
    setJoining(true);
    const player: PlayerState = {
      uid: profile.uid,
      teamId: team.id,
      teamName: team.name,
      selectedChars: [],
      items: ITEMS.filter(i => team.inventory.items.includes(i.id)),
      energy: 4, // 4 coins as per rules
      hasAttackedThisTurn: false,
      forcedToAttack: false
    };
    try {
      await gameService.joinRoom(roomId, player);
      onEnterRoom(roomId);
    } catch (error: any) {
      toast.error(error.message || '加入房間失敗');
    }
    setJoining(false);
  };

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-3 bg-white rounded-2xl shadow-md hover:bg-sky-100">
              <ArrowLeft className="w-6 h-6 text-sky-600" />
            </button>
            <h1 className="text-4xl font-black text-sky-600">對戰大廳</h1>
          </div>
          <button 
            onClick={handleCreateRoom}
            disabled={joining}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 transition-transform active:scale-95"
          >
            <Plus /> 建立房間
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border-4 border-sky-200 overflow-hidden">
          <div className="p-6 border-b-4 border-sky-100 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-sky-700 flex items-center gap-2">
              <Users /> 等待中的房間
            </h2>
            <button onClick={fetchRooms} className="p-2 hover:bg-sky-50 rounded-full transition-colors">
              <RefreshCw className={`w-5 h-5 text-sky-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="divide-y-4 divide-sky-50">
            {rooms.length === 0 ? (
              <div className="p-12 text-center text-gray-400 font-bold">
                目前沒有等待中的房間，快去建立一個吧！
              </div>
            ) : (
              rooms.map(room => (
                <div key={room.id} className="p-6 flex justify-between items-center hover:bg-sky-50 transition-colors">
                  <div>
                    <div className="text-xl font-black text-sky-600">房號：{room.id}</div>
                    <div className="text-sm text-gray-500 font-bold">
                      房主：{room.players[0].teamName} ({room.players[0].teamId})
                    </div>
                  </div>
                  <button 
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={joining}
                    className="bg-sky-500 hover:bg-sky-600 text-white px-8 py-3 rounded-xl font-black shadow-md transition-transform active:scale-95"
                  >
                    加入
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
