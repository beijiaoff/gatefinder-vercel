# 金结闸典（GateFinder）

面向水工金属结构设计、选型与资料复核的钢闸门参数检索工具。项目内置 **7,636** 条闸门与启闭机资料，支持按孔口尺寸、设计水头、闸门自重等条件组合查询，并提供可安装的离线 PWA 体验。

> 数据中可能存在 OCR 识别误差；工程应用前请以原始图纸、标准和正式技术资料为准。

## 功能

- 覆盖露顶平面闸门、露顶弧形闸门、潜孔平面闸门、潜孔弧形闸门等 7 类资料。
- 按尺寸、水头、重量与设备类型进行多条件筛选和排序。
- 查看完整条目资料；桌面端提供紧凑的 Windows 风格界面。
- 支持编辑校正：经密码解锁后，修改内容存储在 Neon Postgres。
- 可作为 PWA 安装，常用数据可离线访问。

## 技术栈

- [Next.js](https://nextjs.org/) 16 + React 19 + TypeScript
- Tailwind CSS 4
- [Neon Postgres](https://neon.tech/)：可选的编辑修改持久化
- Vercel：部署与托管

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。若只使用检索功能，`DATABASE_URL` 可留空；编辑与保存功能则需要配置以下环境变量：

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | Neon Postgres 连接字符串。|
| `EDITOR_PASSWORD_HASH` | 编辑密码的 SHA-256 摘要值。|

示例：

```bash
printf '%s' 'your-password' | shasum -a 256
```

将命令输出的 64 位十六进制摘要填入 `EDITOR_PASSWORD_HASH`。不要提交 `.env.local` 或任何真实密钥。

## 部署到 Vercel

1. 在 Vercel 新建项目并导入此仓库。
2. 选择 **Next.js** 预设；若仓库根目录即为本项目，无需设置 Root Directory。
3. 在 Vercel 的 Project Settings → Environment Variables 中配置上述变量。
4. 部署完成后，Vercel 会在每次推送到默认分支时自动构建。

## 数据与使用说明

内置目录数据仅供工程资料检索与辅助复核使用，不构成设计、制造或验收依据。请在具体工程中遵循适用的国家、行业与项目标准，并核验全部关键参数。

## 开发与验证

```bash
npm test
npm run build
```

## 许可证

本项目源代码采用 [MIT License](LICENSE)。数据资料、商标和第三方内容可能适用各自的权利或使用限制；使用前请自行确认授权与合规要求。
