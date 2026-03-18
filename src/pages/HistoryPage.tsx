import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BattleHistory, CardAcquisition, UserProfile } from '../types';
import { gameService } from '../services/gameService';
import { ArrowLeft, Trophy, History, Package, Calendar, User } from 'lucide-react';

interface Props {
  profile: UserProfile;
  onBack: () => void;
}

export default function HistoryPage({ profile, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<'battle' | 'cards'>('battle');
  const [battleHistory, setBattleHistory] = useState<BattleHistory[]>([]);
  const [cardHistory, setCardHistory] = useState<CardAcquisition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [battles, cards] = await Promise.all([
          gameService.getBattleHistory(profile.uid),
          gameService.getCardAcquisitionHistory(profile.uid)
        ]);
        setBattleHistory(battles);
        setCardHistory(cards);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile.uid]);

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
            <h1 className="text-xl font-black text-slate-800">個人紀錄</h1>
            <p className="text-xs text-slate-500 font-bold">查看您的對戰歷程與卡牌獲取記錄</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        {/* Tabs */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex gap-2">
          <button
            onClick={() => setActiveTab('battle')}
            className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'battle' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Trophy className="w-5 h-5" /> 對戰紀錄
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`flex-1 py-3 rounded-xl font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'cards' ? 'bg-sky-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Package className="w-5 h-5" /> 獲取卡牌紀錄
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-bold">載入中...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'battle' ? (
              battleHistory.length > 0 ? (
                battleHistory.map((battle) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={battle.id} 
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        battle.result === 'win' ? 'bg-emerald-100 text-emerald-600' : 
                        battle.result === 'loss' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {battle.result === 'win' ? <Trophy className="w-6 h-6" /> : <History className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${
                            battle.result === 'win' ? 'bg-emerald-500 text-white' : 
                            battle.result === 'loss' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {battle.result === 'win' ? '勝利' : battle.result === 'loss' ? '失敗' : '平手'}
                          </span>
                          <h3 className="font-black text-slate-800">對戰：{battle.opponentTeamName}</h3>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-bold">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {battle.timestamp?.toDate ? battle.timestamp.toDate().toLocaleString() : '未知時間'}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> ID: {battle.opponentId.slice(0, 6)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold">
                  目前還沒有對戰紀錄
                </div>
              )
            ) : (
              cardHistory.length > 0 ? (
                cardHistory.map((acquisition) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={acquisition.id} 
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-500">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800">獲得「{acquisition.cardName}」</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-bold">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {acquisition.timestamp?.toDate ? acquisition.timestamp.toDate().toLocaleString() : '未知時間'}</span>
                          <span className="px-2 py-0.5 bg-slate-100 rounded-lg">來源：{
                            acquisition.source === 'initial' ? '初始發放' : 
                            acquisition.source === 'redeem' ? '手動登錄' : '對戰獎勵'
                          }</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-slate-400 font-bold">
                  目前還沒有卡牌獲取紀錄
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
