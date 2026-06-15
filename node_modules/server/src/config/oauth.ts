import { config } from './index';

// 微信 OAuth 配置
export function getWechatAuthUrl(redirectUri: string, state: string): string {
  const appId = config.oauth.wechat.appId;
  const encodedRedirect = encodeURIComponent(redirectUri);
  return `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${encodedRedirect}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
}

// QQ OAuth 配置
export function getQQAuthUrl(redirectUri: string, state: string): string {
  const appId = config.oauth.qq.appId;
  const encodedRedirect = encodeURIComponent(redirectUri);
  return `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=${appId}&redirect_uri=${encodedRedirect}&state=${state}&scope=get_user_info`;
}

// 微信获取 access_token
export async function getWechatAccessToken(code: string): Promise<{ access_token: string; openid: string; unionid?: string }> {
  const { appId, appSecret } = config.oauth.wechat;
  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;

  const response = await fetch(url);
  const data = await response.json() as any;

  if (data.errcode) {
    throw new Error(`微信登录失败: ${data.errmsg}`);
  }

  return {
    access_token: data.access_token,
    openid: data.openid,
    unionid: data.unionid,
  };
}

// 微信获取用户信息
export async function getWechatUserInfo(accessToken: string, openid: string): Promise<{ nickname: string; avatar: string }> {
  const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${accessToken}&openid=${openid}`;
  const response = await fetch(url);
  const data = await response.json() as any;

  if (data.errcode) {
    throw new Error(`获取微信用户信息失败: ${data.errmsg}`);
  }

  return {
    nickname: data.nickname,
    avatar: data.headimgurl,
  };
}

// QQ 获取 access_token
export async function getQQAccessToken(code: string, redirectUri: string): Promise<{ access_token: string; openid: string }> {
  const { appId, appSecret } = config.oauth.qq;
  const url = `https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id=${appId}&client_secret=${appSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}&fmt=json`;

  const response = await fetch(url);
  const data = await response.json() as any;

  if (data.error) {
    throw new Error(`QQ登录失败: ${data.error_description}`);
  }

  // 获取 openid
  const openidUrl = `https://graph.qq.com/oauth2.0/me?access_token=${data.access_token}&fmt=json`;
  const openidResponse = await fetch(openidUrl);
  const openidData = await openidResponse.json() as any;

  return {
    access_token: data.access_token,
    openid: openidData.openid,
  };
}

// QQ 获取用户信息
export async function getQQUserInfo(accessToken: string, openid: string, appId: string): Promise<{ nickname: string; avatar: string }> {
  const url = `https://graph.qq.com/user/get_user_info?access_token=${accessToken}&oauth_consumer_key=${appId}&openid=${openid}`;
  const response = await fetch(url);
  const data = await response.json() as any;

  if (data.ret !== 0) {
    throw new Error(`获取QQ用户信息失败: ${data.msg}`);
  }

  return {
    nickname: data.nickname,
    avatar: data.figureurl_qq_2 || data.figureurl_qq_1,
  };
}
