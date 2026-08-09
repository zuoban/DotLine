# DotLine - 批量二维码 / 一维条码生成与 Excel 嵌入器

[![Quality checks and release](https://github.com/zuoban/DotLine/actions/workflows/ci.yml/badge.svg)](https://github.com/zuoban/DotLine/actions/workflows/ci.yml)
[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io%2Fzuoban%2Fdotline-blue)](https://github.com/zuoban/DotLine/pkgs/container/dotline)

**DotLine** 是一款快速高效的高清批量二维码 / 一维条形码在线生成与导出工具。支持单张快速生成定制、批量导入 Excel 模板自动解析并一键生成高分辨率 PNG 码图、直接嵌入到导出 Excel 单元格中（自动计算单元格宽高自适应），以及一键打包导出 ZIP 图片集。

---

## 🌟 核心特性

### 1. 🎯 多码制与高自由度排版
- **二维码 (2D QR Code)**：支持配置二维码尺寸 (120px~400px)、内边距 (0~4) 及前背景颜色。
- **一维条形码 (1D Barcode)**：全面支持常用编码格式：
  - `CODE128` (通用)
  - `EAN13` / `EAN8` (零售商品码)
  - `CODE39` (工业/通用)
  - `UPC` (北美商品码)
  - `ITF14` (外箱物流码)
  - `MSI` (仓库货架码，无自动校验位)
  - `Pharmacode` (医药包装码，范围 3–131070)
- **条码宽度自适应拉长**：可开启自适应无缝拉长填满可用卡片宽度。

### 2. 🎨 高清分辨率与排版比例 (Aspect Ratio)
- **高清放大倍率 (HD Scale)**：支持 `1x (标准~300px)`、`2x (高清~600px)`、`3x (超清~1000px)` 及 `4x (印刷高清~1400px)` 像素级缩放绘制。
- **Canvas 比例裁切扩张**：支持 `自动自适应`、`1:1`、`4:3`、`3:2`、`16:9`、`9:16` 及 `自定义比例` 设置，填充画幅的同时保证二维码/条码矩阵零变形。
- **后台渲染**：支持的浏览器会通过 Web Worker + OffscreenCanvas 生成码图，并在独立 Worker 中完成 Excel 解析与写出，减少批量任务对页面交互的阻塞；不支持时自动回退。

### 3. 📝 下方文字与附加文本美化
- **双层文本排版**：支持同步在码图下方展示原输入文本及自定义附加文本（如：`扫描关注` / `内部标识`）。
- **微调布局与字体**：自定义文本字号、颜色、字体间距 (`textPadding`) 以及画布底边距 (`paddingBottom`)。

### 4. 📊 Excel 批量导入与图片单元格无缝嵌入
- **标准 Excel 模板**：提供标准 `.xlsx` 模版一键下载。
- **智能列定位**：自动识别导入文件中的 `输入文本` 与可选的 `附加内容` 数据列；原输入文本是否展示由页面开关统一控制。
- **智能工作表与表头定位**：自动跳过封面工作表，并在各工作表前 20 行中识别真实表头，支持标题、说明行位于数据表上方的常见文件。
- **图像无缝嵌入 Excel**：使用 `ExcelJS` 技术将高分辨率图片嵌入到新添加的 `二维码` / `条形码` 单元格中，按图片比例自动调整 Excel 行高 (pt) 与列宽，无错位拉伸。
- **ZIP 批量打包**：支持一键导出包含自定义文件命名的高清 PNG 压缩包。
- **安全处理上限**：单次支持 `.xlsx` 文件，最大 25MB / 2000 条有效数据；同时校验解压体积与预计渲染像素量，避免浏览器内存过载。
- **可取消与部分成功**：长时间批量任务可以取消；个别数据格式错误时仍会导出有效结果，并在 Excel 或 ZIP 中附带失败记录。
- **设置自动保存**：码制、尺寸、颜色与排版设置会保存在当前浏览器中，并可一键恢复默认值。

---

## 🚀 快速启动

### 方式一：Docker 镜像运行 (推荐)

直接使用 GitHub Container Registry 提供的预构建镜像：

```bash
# 拉取最新 Docker 镜像
docker pull ghcr.io/zuoban/dotline:latest

# 启动容器映射到本地 8080 端口
docker run -d -p 8080:80 --name dotline ghcr.io/zuoban/dotline:latest
```

在浏览器访问：`http://localhost:8080`

### 方式二：本地开发部署

**环境要求**：Node.js >= 22.12.0

```bash
# 1. 克隆代码仓库
git clone https://github.com/zuoban/DotLine.git
cd DotLine

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 构建生产环境产物
npm run build

# 5. 运行类型检查、代码规范、测试与构建
npm run check

# 6. 运行 Chromium 完整回归、Firefox/WebKit 冒烟与 axe 无障碍测试
npm run test:e2e

# 7. 运行 100 / 500 / 1000 / 2000 行批量性能基准
npm run benchmark:batch
npm run benchmark:compare
```

浏览器测试会验证键盘操作、缺少 OffscreenCanvas 时的自动降级，并从实际下载的 Excel / ZIP 中提取 PNG，反向校验 QR、CODE128、EAN13、MSI 与 Pharmacode 内容。性能报告写入 `performance-results/batch-performance.json`；CI 会保存报告并与最近一次 `main` 基线比较，解析或导出耗时退化超过 15% 时产生告警。

---

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript + Vite
- **UI & 样式**：Tailwind CSS + Lucide Icons
- **图形与二维码绘制**：QRCode.js + JsBarcode + Web Worker / OffscreenCanvas Composite Rendering
- **Excel 处理与嵌入**：ExcelJS + FileSaver.js + JSZip
- **容器与 CI/CD**：Docker (Nginx Alpine Multi-stage) + GitHub Actions

---

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。
