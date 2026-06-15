import { PrismaClient, RequestStatus, UserStatus } from '@prisma/client';
import { ERROR_CODES } from 'shared';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export class FriendService {
  /**
   * 搜索用户
   */
  async searchUsers(query: string, excludeUserId: string) {
    const users = await prisma.user.findMany({
      where: {
        nickname: { contains: query },
        id: { not: excludeUserId },
      },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        status: true,
      },
      take: 20,
    });
    return users;
  }

  /**
   * 发送好友请求
   */
  async sendRequest(senderId: string, receiverId: string, message?: string) {
    if (senderId === receiverId) {
      throw new AppError(400, ERROR_CODES.SELF_OPERATION, '不能添加自己为好友');
    }

    // 检查是否已经是好友
    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId1: senderId, userId2: receiverId },
          { userId1: receiverId, userId2: senderId },
        ],
      },
    });

    if (existingFriendship) {
      throw new AppError(400, ERROR_CODES.ALREADY_FRIENDS, '已经是好友');
    }

    // 检查是否有待处理的好友请求
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId,
        receiverId,
        status: RequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new AppError(400, ERROR_CODES.FRIEND_REQUEST_EXISTS, '已发送过好友请求');
    }

    // 检查对方是否已向我发送请求(直接接受)
    const reverseRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId: receiverId,
        receiverId: senderId,
        status: RequestStatus.PENDING,
      },
    });

    if (reverseRequest) {
      // 直接成为好友
      await prisma.friendRequest.update({
        where: { id: reverseRequest.id },
        data: { status: RequestStatus.ACCEPTED },
      });

      await prisma.friendship.create({
        data: {
          userId1: senderId,
          userId2: receiverId,
        },
      });

      return { status: 'accepted' as const, message: '你们已成为好友' };
    }

    // 发送好友请求
    const request = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId,
        message: message || null,
      },
      include: {
        sender: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    return { status: 'pending' as const, request };
  }

  /**
   * 获取收到的好友请求
   */
  async getPendingRequests(userId: string) {
    return prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: RequestStatus.PENDING,
      },
      include: {
        sender: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 接受好友请求
   */
  async acceptRequest(requestId: string, userId: string) {
    const request = await prisma.friendRequest.findFirst({
      where: { id: requestId, receiverId: userId, status: RequestStatus.PENDING },
    });

    if (!request) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, '好友请求不存在或已处理');
    }

    // 更新请求状态
    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.ACCEPTED },
    });

    // 创建好友关系
    const [smallerId, largerId] = [request.senderId, request.receiverId].sort();
    await prisma.friendship.create({
      data: {
        userId1: smallerId,
        userId2: largerId,
      },
    });

    return { success: true };
  }

  /**
   * 拒绝好友请求
   */
  async rejectRequest(requestId: string, userId: string) {
    const request = await prisma.friendRequest.findFirst({
      where: { id: requestId, receiverId: userId, status: RequestStatus.PENDING },
    });

    if (!request) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, '好友请求不存在或已处理');
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.REJECTED },
    });

    return { success: true };
  }

  /**
   * 获取好友列表
   */
  async getFriendList(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId1: userId },
          { userId2: userId },
        ],
      },
      include: {
        user1: {
          select: { id: true, nickname: true, avatar: true, status: true },
        },
        user2: {
          select: { id: true, nickname: true, avatar: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return friendships.map((f) => {
      const friend = f.userId1 === userId ? f.user2 : f.user1;
      return {
        userId: friend.id,
        nickname: friend.nickname,
        avatar: friend.avatar,
        status: friend.status,
        since: f.createdAt.toISOString(),
      };
    });
  }

  /**
   * 删除好友
   */
  async removeFriend(userId: string, friendId: string) {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId1: userId, userId2: friendId },
          { userId1: friendId, userId2: userId },
        ],
      },
    });

    if (!friendship) {
      throw new AppError(400, ERROR_CODES.NOT_FRIENDS, '不是好友关系');
    }

    await prisma.friendship.delete({ where: { id: friendship.id } });
    return { success: true };
  }
}

export const friendService = new FriendService();
