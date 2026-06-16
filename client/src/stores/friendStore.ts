import { create } from 'zustand';
import { FriendInfo, FriendRequestInfo } from 'shared';

interface FriendStore {
  friends: FriendInfo[];
  requests: FriendRequestInfo[];

  setFriends: (friends: FriendInfo[]) => void;
  addFriend: (friend: FriendInfo) => void;
  removeFriend: (friendId: string) => void;
  setRequests: (requests: FriendRequestInfo[]) => void;
  removeRequest: (requestId: string) => void;
  updateFriendStatus: (userId: string, status: string) => void;
  reset: () => void;
}

export const useFriendStore = create<FriendStore>((set) => ({
  friends: [],
  requests: [],

  setFriends: (friends) => set({ friends }),
  addFriend: (friend) => set((state) => ({ friends: [...state.friends, friend] })),
  removeFriend: (friendId) => set((state) => ({
    friends: state.friends.filter(f => f.userId !== friendId),
  })),
  setRequests: (requests) => set({ requests }),
  removeRequest: (requestId) => set((state) => ({
    requests: state.requests.filter(r => r.id !== requestId),
  })),
  updateFriendStatus: (userId, status) => set((state) => ({
    friends: state.friends.map(f =>
      f.userId === userId ? { ...f, status: status as any } : f
    ),
  })),
  reset: () => set({ friends: [], requests: [] }),
}));
