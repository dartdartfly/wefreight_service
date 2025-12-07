# 微信云鉴权配置指南

本文档说明如何配置和使用微信云鉴权，确保只有授权的微信用户才能访问此 Web 应用。

## 📋 前置条件

1. **腾讯云 CloudBase 环境已创建**
   - 环境 ID：`hk-test-6g3eu25ua1c0dbb7`（或你的实际环境 ID）
   - 已开通 Web 登录功能

2. **微信开放平台账号**（可选，如果使用微信扫码登录）
   - 已注册微信开放平台
   - 已创建网站应用并获取 AppID

## 🔧 配置步骤

### 1. 配置 CloudBase Web 登录

#### 1.1 在 CloudBase 控制台启用 Web 登录

1. 登录 [腾讯云 CloudBase 控制台](https://console.cloud.tencent.com/tcb)
2. 进入你的环境
3. 导航到 **用户管理** -> **登录方式**
4. 启用 **Web 登录** 或 **微信登录**

#### 1.2 配置授权域名

在 CloudBase 控制台的 **安全配置** 中，添加你的 Web 应用域名到授权域名列表。

### 2. 配置前端代码

#### 2.1 设置环境变量

在 `index.html` 中，找到以下配置并替换为你的实际值：

```javascript
// 在 <script> 标签中，找到这行：
const CLOUDBASE_ENV_ID = typeof __cloudbase_env_id !== 'undefined' ? __cloudbase_env_id : 'hk-test-6g3eu25ua1c0dbb7';

// 如果需要在页面加载时注入，可以在 HTML 中添加：
<script>
    window.__cloudbase_env_id = '你的环境ID';
    // 可选：如果使用微信开放平台 AppID
    window.__wechat_appid = '你的微信AppID';
</script>
```

#### 2.2 验证 CloudBase SDK 加载

确保 CloudBase Web SDK 正确加载。当前使用的是 CDN 方式：

```html
<script src="https://web-1256556029.cos.ap-shanghai.myqcloud.com/web-sdk-v2.3.3.js"></script>
```

如果 CDN 不可用，可以：
- 下载 SDK 到本地
- 或使用 npm 安装：`npm install @cloudbase/js-sdk`

### 3. 配置云函数鉴权

#### 3.1 参考示例代码

查看 `cloudfunction_auth_example.js` 文件，了解如何在云函数中验证用户身份。

#### 3.2 修改你的云函数

在你的 `getTracks` 和 `getTrackPoints` 云函数中添加鉴权逻辑：

```javascript
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 授权用户列表（或从数据库读取）
const AUTHORIZED_USERS = ['oXXXXX1', 'oXXXXX2'];

exports.main = async (event, context) => {
  // 获取用户 openid
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  // 检查授权
  if (!openid || !AUTHORIZED_USERS.includes(openid)) {
    return {
      code: 403,
      message: '未授权访问',
      data: null
    };
  }
  
  // 业务逻辑...
};
```

#### 3.3 配置授权用户列表

**方式1：静态列表（简单场景）**

在云函数代码中直接维护授权用户列表：

```javascript
const AUTHORIZED_USERS = [
  'oXXXXX1', // 用户1的 openid
  'oXXXXX2', // 用户2的 openid
];
```

**方式2：数据库存储（推荐）**

1. 在 CloudBase 控制台创建集合 `authorized_users`
2. 添加文档结构：
   ```json
   {
     "openid": "oXXXXX1",
     "nickname": "用户昵称",
     "status": "active",
     "createdAt": "2024-01-01T00:00:00.000Z"
   }
   ```
3. 在云函数中查询数据库验证用户

## 🚀 使用流程

### 用户首次访问

1. 用户打开 Web 应用
2. 自动弹出微信登录二维码（或跳转到微信登录页）
3. 用户使用微信扫码登录
4. 登录成功后，显示用户信息（昵称或 openid）
5. 如果用户未授权，显示错误提示

### 已登录用户

- 用户信息自动显示在左侧控制面板
- 所有 API 请求自动携带登录态
- 如果 token 过期，自动重新登录

## 🔍 调试和排查

### 1. 检查登录状态

打开浏览器控制台（F12），查看：

```javascript
// 检查 CloudBase 实例
console.log(tcb);

// 检查登录状态
tcb.auth().hasLoginState().then(console.log);

// 获取用户信息
tcb.auth().getLoginState().then(console.log);
```

### 2. 检查 API 请求

在浏览器 Network 面板中，查看请求头是否包含：

```
Authorization: Bearer <token>
```

### 3. 云函数日志

在 CloudBase 控制台的云函数日志中，查看：
- 是否收到 Authorization header
- 用户 openid 是否正确解析
- 授权检查是否通过

## ⚠️ 常见问题

### Q1: 登录失败，提示 "未授权访问"

**原因**：用户的 openid 不在授权列表中

**解决**：
1. 在云函数日志中查看用户的 openid
2. 将该 openid 添加到授权列表

### Q2: API 返回 401 错误

**原因**：token 过期或无效

**解决**：
- 前端会自动尝试重新登录
- 如果持续失败，检查 CloudBase 环境配置

### Q3: 无法弹出登录二维码

**原因**：CloudBase Web 登录未启用或域名未授权

**解决**：
1. 检查 CloudBase 控制台的登录方式配置
2. 确认当前域名在授权域名列表中

### Q4: 云函数无法获取用户信息

**原因**：前端未正确传递 token，或云函数未正确解析

**解决**：
1. 检查前端 `authenticatedFetch` 函数是否正确添加 Authorization header
2. 检查云函数是否正确解析 header
3. 如果使用 HTTP 触发，确保 CORS 配置允许 Authorization header

## 📝 注意事项

1. **安全性**：
   - 不要在客户端代码中硬编码授权用户列表
   - 使用 HTTPS 传输 token
   - 定期更新 token 过期时间

2. **性能**：
   - 授权用户列表较大时，建议使用数据库查询
   - 可以考虑缓存授权结果

3. **用户体验**：
   - 首次登录需要用户扫码，确保网络畅通
   - 登录失败时给出明确的错误提示

## 🔗 相关文档

- [CloudBase Web SDK 文档](https://docs.cloudbase.net/api-reference/webv2/auth.html)
- [微信开放平台文档](https://developers.weixin.qq.com/doc/)
- [云函数鉴权最佳实践](https://docs.cloudbase.net/cloudbase-concepts/security.html)

