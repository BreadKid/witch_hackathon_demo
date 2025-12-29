# witch_hackathon_demo

织码女巫hackathon项目演示demo代码
---
## 项目描述
测试环境：https://middlepoint-one.vercel.app/  
生产环境：todo

## 技术栈
### 前端
### 前端框架
| 技术 | 版本 |
|------|------|
| **Next.js** | 16.1.1 |
| **React** | 19.2.3 |
| **React DOM** | 19.2.3 |

### 语言
| 技术 | 版本 |
|------|------|
| **TypeScript** | ^5 |

### 样式方案
| 技术 | 版本 |
|------|------|
| **Tailwind CSS** | ^4 |
| **PostCSS** | (配合 Tailwind) |

### 地图服务
| 技术 | 版本 |
|------|------|
| **高德地图 JS API** | ^1.0.1 |

### 开发工具
| 技术 | 版本 |
|------|------|
| **ESLint** | ^9 |
| **eslint-config-next** | 16.1.1 |

---

### 架构特点

1. **App Router** - 使用 Next.js 的新版路由系统（`src/app/` 目录结构）
2. **Server Actions** - 启用了实验性的 Server Actions 功能
3. **API 代理** - 通过 `rewrites` 配置实现后端 API 代理，支持环境变量动态配置
4. **严格模式 TypeScript** - 开启了 `strict: true`

这是一个非常现代化的技术栈，使用了 **React 19** 和 **Next.js 16** 的最新版本，搭配 **Tailwind CSS v4** 进行样式开发，集成了**高德地图**服务。


### 后端
- 语言python
- **FastAPI**: 用于构建API服务。
- **Pydantic**: 用于数据校验和模型定义。
- **OpenAI Library**: 用于调用deepseek-chat模型生成推荐数据。
-  **Zeabur**: 用于后端接口公网部署

