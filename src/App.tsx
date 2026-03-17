import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut, User, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';
import { gameService } from './services/gameService';
import { UserProfile, Team, View } from './types';
import { Toaster, toast } from 'react-hot-toast';

// Pages
import LoginPage from './pages/LoginPage';
import TeamSelectionPage from './pages/TeamSelectionPage';
import MainMenuPage from './pages/MainMenuPage';
import InventoryPage from './pages/InventoryPage';
import LobbyPage from './pages/LobbyPage';
import CharacterSelectionPage from './pages/CharacterSelectionPage';
import BattlePage from './pages/BattlePage';
import RedeemPage from './pages/RedeemPage';


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [view, setView] = useState<View>('login');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    console.log('App initialized, starting auth check...');
    // Safety timeout: if auth doesn't respond in 8 seconds, unblock the UI
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth initialization timed out, unblocking UI');
        setLoading(false);
        setView('login');
      }
    }, 8000);

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          setUser(firebaseUser);
          if (firebaseUser) {
            const userProfile = await gameService.getUserProfile(firebaseUser.uid);
            if (userProfile) {
              setProfile(userProfile);
              if (userProfile.selectedTeamId) {
                const teamData = await gameService.getTeam(userProfile.selectedTeamId);
                setTeam(teamData);
                setView('main_menu');
              } else {
                setView('team_selection');
              }
            } else {
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || 'anonymous@example.com',
                displayName: firebaseUser.displayName || `玩家_${firebaseUser.uid.slice(0, 4)}`,
              };
              await gameService.createUserProfile(newProfile);
              setProfile(newProfile);
              setView('team_selection');
            }
          } else {
            setProfile(null);
            setTeam(null);
            setView('login');
          }
        } catch (error: any) {
          console.error('Auth state change error:', error);
          toast.error('初始化失敗，請檢查網路或設定');
          setView('login');
        } finally {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      }, (error) => {
        console.error('onAuthStateChanged error:', error);
        clearTimeout(safetyTimeout);
        setLoading(false);
        setView('login');
      });
    } catch (error) {
      console.error('Failed to register auth listener:', error);
      clearTimeout(safetyTimeout);
      setLoading(false);
      setView('login');
    }

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error(`Google 登入失敗: ${error.message}`);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('login');
    } catch (error) {
      toast.error('登出失敗');
    }
  };

  const handleReset = async () => {
    if (!profile || !team) {
      toast.error('找不到個人檔案或小隊資料，無法重置');
      return;
    }
    
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    if (!profile || !team) return;
    
    try {
      setLoading(true);
      setShowResetConfirm(false);
      console.log('Starting reset for user:', profile.uid, 'team:', team.id);
      await gameService.resetGameData(profile.uid, team.id);
      toast.success('遊戲紀錄已重置');
      
      // Clear local state before reload to be safe
      setProfile(null);
      setTeam(null);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Reset error details:', error);
      const errorMsg = error.message || '未知錯誤';
      toast.error(`重置失敗: ${errorMsg}`);
      setLoading(false);
    }
  };

  const handleSelectTeam = async (teamId: string) => {
    if (!profile) return;
    const updatedProfile = { ...profile, selectedTeamId: teamId };
    await gameService.createUserProfile(updatedProfile);
    setProfile(updatedProfile);
    
    // Initialize team data if it doesn't exist
    let teamData = await gameService.getTeam(teamId);
    if (!teamData) {
      teamData = {
        id: teamId,
        name: `小隊 ${teamId}`,
        inventory: {
          characters: ['c_phineas', 'c_ferb', 'c_isabella', 'c_candace', 'c_doof', 'c_vanessa'], // Give some starters
          items: ['item_tracker', 'item_medkit']
        }
      };
      await gameService.updateTeam(teamData);
    }
    setTeam(teamData);
    setView('main_menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-100 flex flex-col items-center justify-center gap-6">
        <div className="text-2xl font-bold text-sky-600 animate-bounce">載入中...</div>
        <button 
          onClick={() => {
            setLoading(false);
            setView('login');
          }}
          className="px-6 py-2 bg-white/50 hover:bg-white text-sky-600 rounded-full text-sm font-bold transition-all border border-sky-200"
        >
          載入太久？點此跳過
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-100 font-sans text-gray-800">
      <Toaster position="top-center" />
      
      {view === 'login' && (
        <LoginPage 
          onGoogleLogin={handleGoogleLogin} 
        />
      )}
      
      {view === 'team_selection' && (
        <TeamSelectionPage onSelect={handleSelectTeam} />
      )}
      
      {view === 'main_menu' && team && (
        <MainMenuPage 
          team={team} 
          onNavigate={setView} 
          onLogout={handleLogout}
          onReset={handleReset}
          setCurrentRoomId={setCurrentRoomId}
        />
      )}
      
      {view === 'inventory' && team && (
        <InventoryPage team={team} onBack={() => setView('main_menu')} />
      )}
      
      {view === 'lobby' && team && profile && (
        <LobbyPage 
          team={team} 
          profile={profile} 
          onBack={() => setView('main_menu')} 
          onEnterRoom={(id) => {
            setCurrentRoomId(id);
            setView('selecting_chars');
          }}
        />
      )}

      {view === 'selecting_chars' && currentRoomId && team && profile && (
        <CharacterSelectionPage 
          roomId={currentRoomId}
          team={team}
          profile={profile}
          onStartBattle={() => setView('battle')}
          onCancel={() => setView('main_menu')}
        />
      )}

      {view === 'battle' && currentRoomId && team && profile && (
        <BattlePage 
          roomId={currentRoomId}
          team={team}
          profile={profile}
          onFinish={() => {
            // Refresh team data after battle
            gameService.getTeam(team.id).then(setTeam);
            setView('main_menu');
          }}
        />
      )}

      {view === 'redeem' && team && (
        <RedeemPage 
          team={team} 
          onBack={() => setView('main_menu')} 
          onUpdateTeam={setTeam}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-4 border-red-500 animate-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-red-600 mb-4">確定要重置嗎？</h3>
            <p className="text-gray-600 font-bold mb-8 leading-relaxed">
              這將會刪除您的小隊資料與背包卡片，且無法復原。您將需要重新選擇小隊並重新登錄卡片。
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-4 rounded-2xl font-black bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmReset}
                className="flex-1 py-4 rounded-2xl font-black bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
              >
                確定重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
