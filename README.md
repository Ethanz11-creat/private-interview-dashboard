# 私人面试准备

GitHub 私有仓库保存网页。Cloudflare Worker 对所有静态资源执行 HTTP Basic 登录验证。

部署：`wrangler deploy`。密码通过 `wrangler secret put SITE_PASSWORD` 设置，不写入仓库。

面试记录保存在当前浏览器 localStorage；使用页面导出功能备份。尚未提供跨设备同步。
