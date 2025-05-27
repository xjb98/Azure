# Azure  

前端程序，登录Azure后，根据type类型跳转不同界面。研究重定向url流程。  
命令行启动本地服务器：npx http-server  
登录网址：http://localhost:8080  
clientId 替换为 "YOUR_CLIENT_ID"，并加注释提醒对方替换为自己的应用ID。  
redirectUri 保持本地开发默认值，根据Azure应用注册中实际情况调整。  

流程：  
----------------------
1.用户点击首页“登录并查看用户信息”或“登录并查看组织信息”按钮→ 记录type（user/org），并触发MSAL.js登录重定向流程，跳转微软登录页。  
2.用户在微软页面完成登录和授权  
3.微软认证通过后，重定向回redirect.html，并带上认证参数（如code、state等）  
4.redirect.html页面加载，MSAL.js处理回调msalInstance.handleRedirectPromise() 自动检测并处理认证参数，换取access token  
5.用access token调用Microsoft Graph API获取用户信息  
fetch("https://graph.microsoft.com/v1.0/me", ...) 获取用户详细资料  
用户信息写入localStorage  
6.根据type跳转：  
type=user → 跳转到user.html，展示详细用户信息  
type=org → 跳转到org.html，调用/me/memberOf获取并展示组信息  
7.用户/组织页面均有“返回”按钮，可回到首页重新选择  
8. 重要说明！！
个人账号（如 @outlook.com、@163.com）无法通过 Graph API 获取组信息，只能获取基本用户信息
组织账号（如 @yourcompany.com 或 @xxx.onmicrosoft.com）可获取组信息，前提是已分配到组且有足够权限（官方文档：https://learn.microsoft.com/zh-cn/graph/api/user-list-memberof?view=graph-rest-1.0&tabs=http)


