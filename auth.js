// 替换为您的 Azure AD 应用注册信息
const msalConfig = {
    auth: {
        clientId: "YOUR_CLIENT_ID", // 您的应用 (客户端) ID
        authority: "https://login.microsoftonline.com/common", // 使用通用端点
        redirectUri: "http://localhost:8080/redirect.html", // 您的重定向 URI (必须与应用注册中的配置一致)
        navigateToLoginRequestUrl: false // 关键配置
    },
    cache: {
        cacheLocation: "localStorage", // 推荐使用 localStorage
        storeAuthStateInCookie: false, // 可选，通常不需要
    },
    system: { // 添加 system 属性
        loggerOptions: { // 添加 loggerOptions 属性
            loggerCallback: (level, message, containsPii) => { // 定义日志回调函数
                if (containsPii) { // 如果包含个人身份信息，可以选择不打印
                    return;
                }
                switch (level) { // 根据日志级别打印到控制台
                    case msal.LogLevel.Error:
                        console.error("MSAL.js Error:", message);
                        return;
                    case msal.LogLevel.Warning:
                        console.warn("MSAL.js Warning:", message);
                        return;
                    case msal.LogLevel.Info:
                        console.info("MSAL.js Info:", message);
                        return;
                    case msal.LogLevel.Verbose:
                        console.debug("MSAL.js Verbose:", message);
                        return;
                    default:
                        console.log("MSAL.js:", message);
                        return;
                }
            },
            piiLoggingEnabled: false, // 设置为 true 可以看到更多详细信息，但请注意隐私问题
            logLevel: msal.LogLevel.Verbose // 设置为 Verbose 可以看到所有级别的日志输出
        }
    }
};

const msalInstance = new msal.PublicClientApplication(msalConfig);

// 处理页面加载时的重定向回调
msalInstance.handleRedirectPromise()
    .then(response => {
        if (response) {
            // 如果是认证成功后的回调页面 (redirect.html)
            console.log("认证成功，获取到 token：", response);
            // 优先从localStorage读取type参数，兼容url参数
            let type = localStorage.getItem('loginType');
            if (!type) {
                const url = new URL(window.location.href);
                type = url.searchParams.get('type');
            }
            // 先获取并写入用户信息，再跳转
            acquireTokenAndGetUserInfo(response.account).then(() => {
                if (type === 'org') {
                    window.location.href = '/org.html';
                } else {
                    window.location.href = '/user.html';
                }
            });
        } else {
            // 如果是主页或其他非回调页面加载
             // 只有在主页加载时才检查是否有已登录用户并尝试获取信息
            if (window.location.pathname.endsWith('/index.html')) {
                console.log("在 index.html 页面加载，检查是否有已登录用户...");
                const accounts = msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    console.log("找到已登录用户:", accounts[0]);
                     // 如果有已登录用户，静默获取 token 并获取用户信息
                    acquireTokenAndGetUserInfo(accounts[0]);
                } else {
                    console.log("没有找到已登录用户。");
                }
            } else if (window.location.pathname.endsWith('/redirect.html')){
                console.log("在 redirect.html 页面加载，没有认证响应，可能是认证失败或取消。");
                  // 如果当前是 redirect.html 但没有response，说明认证失败或取消
                console.error("认证回调处理失败或被取消或无响应。");
                   // 可以显示错误信息或重定向回主页
                   // 为了避免无限重定向，只在没有错误时重定向
                    // if (!msalInstance.getAccountByHomeId(response?.account?.homeAccountId)) { // 简单的检查
                    // window.location.href = '/index.html';
                    // }
            }
        }
    })
    .catch(error => {
        console.error("处理重定向回调或页面加载时发生错误:", error);
         // 如果当前是 redirect.html 且发生错误
        if (window.location.pathname.endsWith('/redirect.html')) {
             // 可以显示错误信息给用户
            alert("登录失败：" + error.message);
             window.location.href = '/index.html'; // 重定向回主页
        } else {
              // 在其他页面发生错误（例如静默获取 token 失败）
            console.log("在其他页面发生错误:", error);
              // 如果静默获取 token 失败 (例如 token 过期需要用户重新认证)
            if (error instanceof msal.InteractionRequiredAuthError) {
                console.log("需要用户交互认证，提示重新登录。");
                 // 可选：提示用户需要重新登录
                  // alert("您的会话已过期，请重新登录。");
            } else {
                  // 其他错误，可以显示给用户
                  // alert("发生错误：" + error.message);
            }
             // 清除可能不完整的本地存储信息
            localStorage.removeItem('azureAdUserInfo');
               // 在页面上显示未登录状态或错误 (只有在 index.html)
            if (window.location.pathname.endsWith('/index.html')) {
                displayUserInfo(null);
            }
        }
    });

// 获取 token 并调用 Microsoft Graph API 获取用户信息
async function acquireTokenAndGetUserInfo(account) {
    const request = {
        scopes: ["User.Read"], // 请求获取用户信息所需的权限
        account: account // 指定要为其获取 token 的用户账号
    };

    try {
        console.log("正在静默获取 Access Token...");
        const tokenResponse = await msalInstance.acquireTokenSilent(request);
        console.log("成功获取 Access Token:", tokenResponse.accessToken);

        // 使用 Access Token 调用 Microsoft Graph API
        console.log("正在调用 Microsoft Graph API 获取用户信息...");
        const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: {
                'Authorization': `Bearer ${tokenResponse.accessToken}`
            }
        });

        if (!graphResponse.ok) {
            throw new Error(`Error calling Graph API: ${graphResponse.status} ${graphResponse.statusText}`);
        }

        const userInfo = await graphResponse.json();
        console.log("获取到用户信息:", userInfo);

        // 将用户信息存储到 localStorage
        localStorage.setItem('azureAdUserInfo', JSON.stringify(userInfo));
        console.log("用户信息已存储到 localStorage (f12 -> Application -> Local Storage)");

        // 只有主页等有 userInfo 容器的页面才显示用户信息
        if (document.getElementById('userInfo')) {
            displayUserInfo(userInfo);
        }

    } catch (error) {
        console.error("获取 token 或调用 Graph API 失败:", error);
         // 如果静默获取 token 失败 (例如 token 过期需要用户重新认证)
        if (error instanceof msal.InteractionRequiredAuthError) {
            console.log("需要用户交互认证，重定向到登录页面...");
            // 触发交互式登录，重定向到 Azure AD 登录页
            msalInstance.acquireTokenRedirect(request);
        } else {
             // 其他错误，显示给用户
            alert("获取用户信息失败：" + error.message);
        }
         // 清除可能不完整的本地存储信息
        localStorage.removeItem('azureAdUserInfo');
          // 在页面上显示未登录状态或错误
        if (document.getElementById('userInfo')) {
            displayUserInfo(null);
        }
    }
}


// 在页面上显示用户信息的函数
function displayUserInfo(userInfo) {
    const userInfoDiv = document.getElementById('userInfo');
    if (!userInfoDiv) return; // 容错：没有该元素直接返回
    if (userInfo) {
        userInfoDiv.innerHTML = `
            <h2>已登录用户</h2>
            <p><strong>显示名称:</strong> ${userInfo.surname || ''}${userInfo.givenName || ''}</p>
            <p><strong>邮箱:</strong> ${userInfo.mail || userInfo.userPrincipalName}</p>
            <p><strong>ID:</strong> ${userInfo.id}</p>
            <p>请查看 F12 开发者工具 > Application > Local Storage 检查存储信息。</p>
            <button id="logoutButton" style="margin-top: 10px;">退出登录</button>
        `;
        document.getElementById('logoutButton').addEventListener('click', logout);
    } else {
        userInfoDiv.innerHTML = '<p>用户未登录。</p>';
        const logoutButton = document.getElementById('logoutButton');
        if(logoutButton) logoutButton.remove();
    }
}

// 退出登录函数
function logout() {
    console.log("正在退出登录...");
     msalInstance.logoutRedirect(); // 重定向到 Azure AD 进行退出登录
     localStorage.removeItem('azureAdUserInfo'); // 清除本地存储的信息
}


// 获取登录按钮元素并添加事件监听器
const loginButton = document.getElementById('loginButton');
if (loginButton) {
    loginButton.addEventListener('click', () => {
        // 在登录前进行判断/确认
        if (confirm("确定要跳转到 Azure AD 登录页面吗？")) {
            console.log("用户确认登录，正在重定向...");
            const loginRequest = {
                scopes: ["User.Read"] // 首次登录时请求的权限
            };
            msalInstance.loginRedirect(loginRequest); // 重定向到 Azure AD 登录页
        } else {
            console.log("用户取消登录。");
        }
    });
}

// 在 DOM 加载完成后执行初始化逻辑
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // 如果页面加载时已经有用户信息在 localStorage，则显示
    const storedUserInfo = localStorage.getItem('azureAdUserInfo');
    if (storedUserInfo) {
        try {
            const userInfo = JSON.parse(storedUserInfo);
            displayUserInfo(userInfo);
            console.log("从 localStorage 加载并显示用户信息。");
        } catch (e) {
            console.error("从 localStorage 解析用户信息失败:", e);
            localStorage.removeItem('azureAdUserInfo'); // 清除损坏的存储
        }
    }

    // 注意：处理重定向回调 (msalInstance.handleRedirectPromise) 不需要等待 DOMContentLoaded，
    // 因为它需要在页面加载 early 阶段就执行。
    // 但后续的获取用户信息和显示逻辑已经在 handleRedirectPromise 内部或其调用的函数中处理。
    // 我们之前已经修改了 handleRedirectPromise 确保只在 index.html 中检查和显示用户，
    // 结合这里的 DOMContentLoaded 应该能解决问题。
});

