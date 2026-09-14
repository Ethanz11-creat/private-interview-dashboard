# 私人面试准备

首页是通用的求职面试思维导图，左侧可以切换技术面、主管面和 HR 面；英文、联想业务、对外输出等特殊内容可以单独隐藏。两份原始 HTML 的正文会合并到首页，完整项目资料和主管面资料都在同页弹窗中阅读。

部署：`wrangler deploy`。Worker 对静态资源执行 HTTP Basic 登录验证，密码通过 `wrangler secret put SITE_PASSWORD` 设置，不写入仓库。

仓库只保存静态页面和部署配置，不保存面试现场记录或浏览器数据。通用节点直接在 `public/index.html` 的 `views` 或 `addons` 中追加；修改 `public/二面/` 里的原始资料后运行 `npm run build`，即可重新合并完整正文。
