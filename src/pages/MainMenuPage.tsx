import React from 'react';
import { motion } from 'motion/react';
import { Team, View } from '../types';
import { Package, Play, LogOut, Trophy, Zap, Coins, Sparkles } from 'lucide-react';

interface Props {
  team: Team;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  onReset: () => void;
  setCurrentRoomId: (id: string | null) => void;
}

export default function MainMenuPage({ team, onNavigate, onLogout, onReset, setCurrentRoomId }: Props) {
  return (
    <div className="min-h-screen bg-sky-100 flex flex-col items-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl space-y-8"
      >
        {/* Header / Stats */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border-4 border-sky-400 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-sky-600">{team.name}</h2>
            <p className="text-gray-500 font-bold">歡迎回來，發明家！</p>
          </div>
        </div>

        {/* Menu Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <MenuButton 
            icon={<Play className="w-10 h-10" />}
            label="進入對戰"
            color="bg-orange-500"
            onClick={() => onNavigate('lobby')}
          />
          <MenuButton 
            icon={<Sparkles className="w-10 h-10" />}
            label="登錄實體卡"
            color="bg-indigo-500"
            onClick={() => onNavigate('redeem')}
          />
          <MenuButton 
            icon={<Package className="w-10 h-10" />}
            label="查看背包"
            color="bg-green-500"
            onClick={() => onNavigate('inventory')}
          />
          <MenuButton 
            icon={<LogOut className="w-10 h-10" />}
            label="登出系統"
            color="bg-red-500"
            onClick={onLogout}
          />
        </div>

        {/* Danger Zone */}
        <div className="pt-8 border-t border-sky-200 flex flex-col items-center gap-4">
          <div className="text-center opacity-50 italic">
            「嘿，泰瑞在哪裡？」
          </div>
          <button 
            onClick={onReset}
            className="text-red-400 hover:text-red-600 text-sm font-bold underline decoration-dotted"
          >
            重置遊戲紀錄
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MenuButton({ icon, label, color, onClick, disabled = false }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${color} ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-105 active:scale-95'} text-white p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center gap-4 transition-all border-b-8 border-black/20`}
    >
      {icon}
      <span className="text-2xl font-black tracking-wide">{label}</span>
    </button>
  );
}
