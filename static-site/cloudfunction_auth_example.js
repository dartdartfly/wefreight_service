/**
 * 云函数鉴权示例代码
 * 
 * 这个文件展示了如何在 getTracks 和 getTrackPoints 云函数中验证微信用户身份
 * 并只允许授权用户访问。
 * 
 * 使用方法：
 * 1. 将下面的代码集成到你的云函数中
 * 2. 在云开发控制台配置授权用户列表（或使用数据库存储）
 * 3. 确保云函数能正确解析 Authorization header
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 授权用户列表（示例：可以从数据库或环境变量中读取）
 * 实际使用时，建议将这些信息存储在数据库中
 */
const AUTHORIZED_USERS = [
  'oXXXXX1', // 微信 openid 示例
  'oXXXXX2',
  // ... 更多授权用户的 openid
];

/**
 * 从请求中获取用户身份信息
 * @param {Object} event - 云函数事件对象
 * @returns {Object|null} 用户信息对象 { openid, uid } 或 null
 */
async function getUserFromRequest(event) {
  try {
    // 方式1：从 CloudBase 自动注入的上下文获取（推荐）
    // 如果前端使用 CloudBase Web SDK 调用云函数，用户信息会自动注入
    const wxContext = cloud.getWXContext();
    if (wxContext && wxContext.OPENID) {
      return {
        openid: wxContext.OPENID,
        uid: wxContext.OPENID, // 或使用其他唯一标识
        appid: wxContext.APPID
      };
    }

    // 方式2：从 Authorization header 手动解析（如果前端直接调用 HTTP 接口）
    // 注意：需要在前端 authenticatedFetch 函数中正确设置 header
    const headers = event.headers || {};
    const authHeader = headers['authorization'] || headers['Authorization'] || '';
    
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // 验证 token 并解析用户信息
      // 这里需要根据你的实际 token 格式来实现
      // 如果是 CloudBase 的 accessToken，可以使用 cloud.auth().verifyAccessToken()
      try {
        // 示例：使用 CloudBase SDK 验证 token
        const authResult = await cloud.auth().verifyAccessToken(token);
        if (authResult && authResult.openid) {
          return {
            openid: authResult.openid,
            uid: authResult.uid || authResult.openid,
            appid: authResult.appid
          };
        }
      } catch (tokenError) {
        console.error('Token 验证失败:', tokenError);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

/**
 * 检查用户是否已授权
 * @param {string} openid - 用户 openid
 * @returns {boolean} 是否已授权
 */
async function isUserAuthorized(openid) {
  if (!openid) {
    return false;
  }

  // 方式1：从静态列表检查（简单场景）
  if (AUTHORIZED_USERS.includes(openid)) {
    return true;
  }

  // 方式2：从数据库检查（推荐用于生产环境）
  try {
    const db = cloud.database();
    const userDoc = await db.collection('authorized_users')
      .where({
        openid: openid,
        status: 'active' // 假设有状态字段
      })
      .get();
    
    return userDoc.data && userDoc.data.length > 0;
  } catch (dbError) {
    console.error('查询授权用户失败:', dbError);
    // 如果数据库查询失败，可以回退到静态列表
    return AUTHORIZED_USERS.includes(openid);
  }
}

/**
 * 统一的鉴权中间件
 * @param {Object} event - 云函数事件对象
 * @returns {Object} { authorized: boolean, user: Object|null, error: string|null }
 */
async function checkAuthorization(event) {
  // 1. 获取用户信息
  const user = await getUserFromRequest(event);
  
  if (!user || !user.openid) {
    return {
      authorized: false,
      user: null,
      error: '未获取到用户身份信息，请先完成微信登录'
    };
  }

  // 2. 检查用户是否已授权
  const authorized = await isUserAuthorized(user.openid);
  
  if (!authorized) {
    return {
      authorized: false,
      user: user,
      error: `用户 ${user.openid} 未授权访问此应用`
    };
  }

  return {
    authorized: true,
    user: user,
    error: null
  };
}

/**
 * getTracks 云函数示例（带鉴权）
 */
exports.main = async (event, context) => {
  // 执行鉴权检查
  const authResult = await checkAuthorization(event);
  
  if (!authResult.authorized) {
    return {
      code: 403,
      message: authResult.error || '未授权访问',
      data: null
    };
  }

  // 鉴权通过，执行业务逻辑
  const user = authResult.user;
  console.log(`授权用户 ${user.openid} 正在访问 getTracks`);

  try {
    // 你的原有业务逻辑
    const db = cloud.database();
    const tracks = await db.collection('tracks')
      .orderBy('startTime', 'desc')
      .limit(200)
      .get();

    return {
      code: 0,
      message: 'success',
      data: tracks.data
    };
  } catch (error) {
    console.error('获取轨迹列表失败:', error);
    return {
      code: 500,
      message: error.message || '服务器内部错误',
      data: null
    };
  }
};

/**
 * getTrackPoints 云函数示例（带鉴权）
 */
// 注意：如果你有单独的 getTrackPoints 云函数，也需要添加相同的鉴权逻辑
// exports.main = async (event, context) => {
//   const authResult = await checkAuthorization(event);
//   
//   if (!authResult.authorized) {
//     return {
//       code: 403,
//       message: authResult.error || '未授权访问',
//       data: null
//     };
//   }
//
//   // 业务逻辑...
// };

/**
 * 配置说明：
 * 
 * 1. 在云开发控制台创建 authorized_users 集合（如果使用数据库方式）
 *    集合结构示例：
 *    {
 *      openid: "oXXXXX1",
 *      nickname: "用户昵称",
 *      status: "active",
 *      createdAt: "2024-01-01T00:00:00.000Z"
//     }
 * 
 * 2. 设置云函数环境变量（可选）
 *    在云开发控制台 -> 云函数 -> 环境变量中设置：
 *    AUTHORIZED_OPENIDS: "oXXXXX1,oXXXXX2,oXXXXX3"
 * 
 * 3. 如果使用 HTTP 触发，确保云函数配置允许跨域（CORS）
 *    在云函数配置中添加：
 *    {
 *      "headers": {
 *        "Access-Control-Allow-Origin": "*",
 *        "Access-Control-Allow-Headers": "Content-Type, Authorization"
 *      }
 *    }
 */

