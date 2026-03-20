import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  deleteDoc,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Team, UserProfile, Room, PlayerState, BattleCharacter, BattleHistory, CardAcquisition } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const gameService = {
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as UserProfile : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
      return null;
    }
  },

  async createUserProfile(profile: UserProfile) {
    try {
      await setDoc(doc(db, 'users', profile.uid), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${profile.uid}`);
    }
  },

  async updateTeam(team: Team) {
    try {
      await setDoc(doc(db, 'teams', team.id), team);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `teams/${team.id}`);
    }
  },

  async getTeam(teamId: string): Promise<Team | null> {
    try {
      const docRef = doc(db, 'teams', teamId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as Team : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `teams/${teamId}`);
      return null;
    }
  },

  async createRoom(player: PlayerState): Promise<string> {
    try {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      // Coin flip: 50/50 chance to determine who goes first
      const isFirst = Math.random() > 0.5;
      const room: Partial<Room> = {
        id: roomId,
        status: 'waiting',
        players: [player],
        turn: player.uid, // Initially set to creator for waiting phase
        currentRound: 1,
        logs: [`小隊 ${player.teamId} 建立了房間 ${roomId}`],
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        firstPlayerUid: player.uid // Will be finalized when second player joins
      };
      await setDoc(doc(db, 'rooms', roomId), room);
      return roomId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rooms');
      return '';
    }
  },

  async joinRoom(roomId: string, player: PlayerState) {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) throw new Error('房間不存在');
      
      const room = roomSnap.data() as Room;
      if (room.players.length >= 2) throw new Error('房間已滿');
      if (room.players.find(p => p.uid === player.uid)) return;

      const updatedPlayers = [...room.players, player];
      const updates: any = { players: updatedPlayers };
      
      if (updatedPlayers.length === 2) {
        updates.status = 'selecting_chars';
        updates.logs = [...room.logs, `小隊 ${player.teamName} 加入了房間。請雙方選擇出戰角色！`];
      }
      updates.lastActivity = serverTimestamp();

      await updateDoc(roomRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
    }
  },

  async setFirstPlayer(roomId: string, firstPlayerUid: string) {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) return;
      const room = roomSnap.data() as Room;

      const firstPlayer = room.players.find(p => p.uid === firstPlayerUid);
      const updates: any = {
        firstPlayerUid,
        turn: firstPlayerUid,
        status: 'preparing',
        logs: [...room.logs, `房主選擇了 ${firstPlayer?.teamName} 獲得先攻！`]
      };
      await updateDoc(roomRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/setFirstPlayer`);
    }
  },

  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const docRef = doc(db, 'rooms', roomId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as Room : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
      return null;
    }
  },

  async updateRoom(roomId: string, updates: Partial<Room>) {
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        ...updates,
        lastActivity: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}`);
    }
  },

  async leaveRoom(roomId: string, uid: string) {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) return;

      const room = roomSnap.data() as Room;
      const updatedPlayers = room.players.filter(p => p.uid !== uid);

      if (updatedPlayers.length === 0) {
        await deleteDoc(roomRef);
      } else {
        await updateDoc(roomRef, {
          players: updatedPlayers,
          lastActivity: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `rooms/${roomId}/leave`);
    }
  },

  subscribeToRoom(roomId: string, callback: (room: Room) => void) {
    const roomRef = doc(db, 'rooms', roomId);
    return onSnapshot(roomRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data() as Room);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomId}`);
    });
  },

  async getWaitingRooms(): Promise<Room[]> {
    try {
      // First, cleanup old rooms
      await this.cleanupRooms();
      
      const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'), limit(10));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Room);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
      return [];
    }
  },

  async cleanupRooms() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const q = query(
        collection(db, 'rooms'), 
        where('status', '==', 'waiting'),
        orderBy('lastActivity', 'asc')
      );
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs
        .filter(doc => {
          const data = doc.data() as Room;
          if (!data.lastActivity) return false;
          const lastActivity = data.lastActivity.toDate ? data.lastActivity.toDate() : new Date(data.lastActivity);
          return lastActivity < fiveMinutesAgo;
        })
        .map(doc => deleteDoc(doc.ref));
      
      if (deletePromises.length > 0) {
        console.log(`Cleaning up ${deletePromises.length} old rooms`);
        await Promise.all(deletePromises);
      }
    } catch (error) {
      console.warn('Cleanup rooms failed (likely missing index or permissions):', error);
    }
  },

  async resetGameData(uid: string) {
    try {
      // 1. Reset User Profile (keep uid and email, but clear selectedTeamId)
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        selectedTeamId: null
      });

      // 2. Delete ALL possible Team Data for this user
      const { TEAMS } = await import('../constants');
      const deleteTeamPromises = TEAMS.map(teamId => {
        const userTeamId = `${uid}_${teamId}`;
        return deleteDoc(doc(db, 'teams', userTeamId));
      });
      
      await Promise.all(deleteTeamPromises);

      // 3. Clear Battle History
      const historyQuery = query(collection(db, 'battle_history'), where('userId', '==', uid));
      const historySnap = await getDocs(historyQuery);
      const deleteHistoryPromises = historySnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteHistoryPromises);

      // 4. Clear Card Acquisitions
      const acquisitionQuery = query(collection(db, 'card_acquisitions'), where('userId', '==', uid));
      const acquisitionSnap = await getDocs(acquisitionQuery);
      const deleteAcquisitionPromises = acquisitionSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteAcquisitionPromises);

      console.log(`Successfully cleared all game data for user ${uid}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reset/${uid}`);
    }
  },

  async recordBattleResult(history: BattleHistory) {
    try {
      const historyRef = doc(collection(db, 'battle_history'));
      await setDoc(historyRef, {
        ...history,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'battle_history');
    }
  },

  async recordCardAcquisition(acquisition: CardAcquisition) {
    try {
      const acquisitionRef = doc(collection(db, 'card_acquisitions'));
      await setDoc(acquisitionRef, {
        ...acquisition,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'card_acquisitions');
    }
  },

  async getBattleHistory(userId: string): Promise<BattleHistory[]> {
    try {
      const q = query(
        collection(db, 'battle_history'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(20)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BattleHistory));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'battle_history');
      return [];
    }
  },

  async getCardAcquisitionHistory(userId: string): Promise<CardAcquisition[]> {
    try {
      const q = query(
        collection(db, 'card_acquisitions'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CardAcquisition));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'card_acquisitions');
      return [];
    }
  }
};
