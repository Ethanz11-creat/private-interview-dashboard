# 私人面试准备

首页是通用的求职面试思维导图，左侧可以切换技术面、主管面和 HR 面；英文、联想业务、对外输出等特殊内容可以单独隐藏。两个完整项目资料页保留在 `public/二面/`，从首页主项目节点打开。

部署：`wrangler deploy`。Worker 对静态资源执行 HTTP Basic 登录验证，密码通过 `wrangler secret put SITE_PASSWORD` 设置，不写入仓库。

仓库只保存静态页面和部署配置，不保存面试现场记录或浏览器数据。普通内容更新直接修改 `public/index.html`，新增模块按 `views` 或 `addons` 中的结构追加即可。
