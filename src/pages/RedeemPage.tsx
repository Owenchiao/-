import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Team, CharacterCard, ItemCard } from '../types';
import { CHARACTERS, ITEMS } from '../cardDatabase';
import { gameService } from '../services/gameService';
import { CharacterCardUI } from './InventoryPage';
import { ArrowLeft, Search, Plus, Package, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Props {
  team: Team;
  onBack: () => void;
  onUpdateTeam: (team: Team) => void;
}

export default function RedeemPage({ team, onBack, onUpdateTeam }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'characters' | 'items'>('characters');
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredChars = CHARACTERS.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredItems = ITEMS.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCard = async (card: CharacterCard | ItemCard) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    const isChar = 'faction' in card;
    
    const updatedTeam: Team = {
      ...team,
      inventory: {
        characters: isChar ? [...team.inventory.characters, card.id] : team.inventory.characters,
        items: !isChar ? [...team.inventory.items, card.id] : team.inventory.items,
      }
    };

    try {
      await gameService.updateTeam(updatedTeam);
      
      // Record acquisition
      await gameService.recordCardAcquisition({
        id: '',
        userId: team.id.split('_')[0], // Extract UID from teamId
        cardId: card.id,
        cardName: card.name,
        cardType: isChar ? 'character' : 'item',
        source: 'redeem',
        timestamp: null
      });

      onUpdateTeam(updatedTeam);
      toast.success(`成功將「${card.name}」加入背包！`);
    } catch (error) {
      toast.error('儲存失敗');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-slate-800">登錄現實卡牌</h1>
            <p className="text-xs text-slate-500 font-bold">將您在現實世界中獲得的實體卡片同步至系統</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-sky-100 px-4 py-1.5 rounded-full border border-sky-200">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-black text-sky-700">官方認證系統</span>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        {/* Search & Tabs */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="搜尋卡片名稱或 ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:border-sky-400 transition-all font-bold"
            />
          </div>

          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
            <button
              onClick={() => setActiveTab('characters')}
              className={`flex-1 py-3 rounded-xl font-black transition-all ${activeTab === 'characters' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              角色卡
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className={`flex-1 py-3 rounded-xl font-black transition-all ${activeTab === 'items' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              道具卡
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTab === 'characters' ? (
            filteredChars.map(char => (
              <div key={char.id} className="relative group">
                <CharacterCardUI char={char} />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                  <button
                    onClick={() => handleAddCard(char)}
                    disabled={isProcessing}
                    className="bg-sky-500 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl transform hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-5 h-5" /> 登錄此卡
                  </button>
                </div>
              </div>
            ))
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="bg-white border-2 border-slate-100 rounded-3xl p-6 shadow-sm hover:border-sky-400 transition-all group relative">
                <div className="flex flex-col gap-4 items-center text-center">
                  <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center">
                    <Package className="w-8 h-8 text-sky-500" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-800">{item.name}</h3>
                    <p className="text-xs text-slate-500 font-bold mt-1">{item.description}</p>
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                  <button
                    onClick={() => handleAddCard(item)}
                    disabled={isProcessing}
                    className="bg-sky-500 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl transform hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-5 h-5" /> 登錄此卡
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {activeTab === 'characters' && filteredChars.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-bold">找不到符合的角色卡</div>
        )}
        {activeTab === 'items' && filteredItems.length === 0 && (
          <div className="text-center py-20 text-slate-400 font-bold">找不到符合的道具卡</div>
        )}
      </div>
    </div>
  );
}
