# 小狗记事本

单人手机手帐与小狗陪伴交互原型。网页包含随手记、待办、纪念日、小白 / 小鸡毛的小窝、商店、背包、喂食、玩耍及狗狗币循环，无需登录。可作为 PWA 添加到手机主屏幕，离线使用，数据只保存在本机。

## 本地打开

用 VS Code 的「打开文件夹」打开这个目录，再通过你已有的本地静态服务器或 VS Code Live Server 预览 `index.html`。也可用浏览器直接打开 `index.html`；本地文件模式的进度保存行为由浏览器决定。

这个版本不需要 npm 安装，不需要构建，也没有后台服务。图标与角色资源已经放在本地文件中。PWA 的离线缓存依赖 HTTP(S)，直接用浏览器打开 `file://` 时不生效；请通过本地静态服务器或部署后的链接访问。

## 安装与使用（分享给朋友）

部署到 GitHub Pages 后（例如 `https://fsylviaa.github.io/puppy-note/`），朋友用手机浏览器打开链接即可：

- **iPhone（Safari）**：点底部「分享」按钮 → 选择「添加到主屏幕」。之后从主屏图标进入，可离线使用。
- **安卓（Chrome）**：浏览器会提示「添加到主屏幕」，或点右上角菜单 →「安装应用」/「添加到主屏幕」。

数据只保存在各自的手机里（IndexedDB），互不同步、不上传；断网也能打开。

## 数据备份

数据存在本机，换设备、清浏览器数据或系统清理可能丢失。请在「设置 → 导出全部数据」定期导出 JSON 备份；换设备时用「设置 → 导入数据」恢复。

## 文件结构

```text
puppy-notebook-github/
├── index.html             # 页面入口与手机基础结构
├── manifest.json          # PWA 清单（名称、图标、离线配置）
├── service-worker.js      # 离线缓存与版本管理
├── icons/                 # 应用图标（标准 / iOS / 自适应）
├── src/
│   ├── styles.css         # 美术风格、布局与手机适配
│   ├── app.js             # 随手记、待办、小窝、商店、聊天演示
│   ├── storage.js         # 浏览器 IndexedDB 读写与旧数据迁移
│   └── export-svg.js      # 导出当前页为带图层的 SVG
├── assets/
│   └── characters.js      # 13 张内嵌 PNG、角色状态、裁剪参数与来源
├── vendor/
│   ├── lucide.js          # 本地 Lucide 1.17.0 图标库
│   └── lucide-LICENSE     # 图标库许可证
├── design/                # 可选：三页 SVG 设计参考
├── ASSET_SOURCES.md       # 角色素材来源
├── README.md
└── .gitignore
```

上传 GitHub 时，把这个文件夹内的文件与目录放到仓库根目录，保持相对路径。源码文件、图片资源、图标库、`manifest.json`、`service-worker.js` 与 `icons/` 必须一起上传；`design/` 可选。解压出的外层文件夹和 ZIP 压缩包不需要作为仓库内容。

## 修改从哪里开始

- 改颜色、字体、边框和布局：`src/styles.css`。
- 改页面内容和玩法：`src/app.js` 中的 `notesPage`、`tasksPage`、`homePage` 与 `interact`。
- 改奖励和商品价格：`src/app.js` 中的 `products`、`award` 与待办完成处理。
- 改示例记录、待办和初始金币：`src/app.js` 中的 `seed`。
- 改进度保存：`src/storage.js`。当前保存于本机浏览器（IndexedDB），不会同步到 GitHub 或其他设备。
- 改小狗图片：`assets/characters.js` 中的 `dataUrl` 与 `bbox`。PNG 当前以 data URL 内嵌，SVG 导出也会保留图片；替换为新的 data URL 时，需要同步检查尺寸和裁剪参数。
- 改纪念日与日期行为：日期取真实当天（`src/app.js` 顶部 `TODAY` 与日期辅助函数）。日历、倒计时、列表日期与星期都基于当天动态生成。

## 演示范围

日期取真实当天；初始记录与待办为示例数据。AI 陪聊、AI 整理、录音、照片均为模拟入口，没有连接真实 AI 服务、相册或麦克风。

可完成一轮「保存记录 +3 狗狗币 → 完成待办 +5 → 买口粮 −6 → 喂食」。重复完成同一项待办不会重复奖励，两只小狗的状态独立。设置中可以重置虚构演示数据或导出当前页 SVG。

在接入真实 AI 时，把服务调用放到后台；前端源码不应存放 API 密钥。当前没有密钥或环境变量配置。

`design/` 的 SVG 是设计参考，不能替代网页源码。更完整的 Figma 文字图层导入工具在单独的「Figma 编辑包」中。

角色素材来源与图标库许可见随附文件。此目录未提供角色 IP 的授权凭证。

## 已完成的检查

开发版已通过 JavaScript 语法检查，实际跑通一轮记事、完成待办、买口粮与喂食；数据写入 IndexedDB 后刷新可恢复。PWA 已验证：Service Worker 注册激活、预缓存静态资源、离线（服务器关闭）刷新仍可正常打开；manifest 与图标正常加载；「导出全部数据 / 导入数据」可用。三页在 320px 视口没有横向溢出，角色图片与本地图标正常加载，未发现 JavaScript 错误。
