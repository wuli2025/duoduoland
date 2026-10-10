# 多多群岛 功能树与维护入口

普通脚本依次加载，浏览器模块统一挂在 `window.BJ`。离线入口为 `index.html`；在线入口为 `node server/index.js`，Node 24，零运行时依赖。每个自有代码文件最多 500 行。

## 配置与数据

| 模块 / 文件 | 职责、接口与依赖 | 配置 / 验证入口 |
| --- | --- | --- |
| `src/config/app.js` | 品牌、导航、主题、城市、默认活动、计时、头像墙24人/卡片4人上限 | `BJ.config.app` |
| `assets.js` | 图片目录、扩展名、单图覆盖；`BJ.asset` | p01–p66 各分配一人 |
| `copy.js`、`fields.js` | 文案、15 个基础字段、5个合作条件与7个默认隐藏的交友字段、意图模板、职位过滤器 | `BJ.config.copy/fields/templates/jobFilters` |
| `dating.js` | 成年门槛、意图同义词/否定、年龄解析、双向硬条件字段、独立权重、禁用词、fitReason模板/标题和磨合点开关 | `BJ.config.dating` / Node UMD |
| `intent.js` | 16个常见标签上限、职业/交友字段映射、模式与版本提示文案 | `BJ.config.intent` / Node UMD |
| `matching.js` | 权重、覆盖比例、双向加成归一化、97 分上限、曲线、MMR、资源对齐 | `BJ.config.matching` / Node UMD |
| `synonyms.js`、`reasons.js` | 多行业角色、AI技术与合作偏好词表；意图规则、否定子句配置与合并；公开技术证据多套理由句式 | `BJ.config.synonyms/reasons` / Node UMD |
| `reason-policy.js` | 禁用内部措辞、统一“你”、40/20字预算、多档短模板、完整问句；策略版本6.1；前后端共用 | `BJ.config.reasonPolicy` / Node UMD |
| `llm.js` | enabled、endpoint、timeout=62000、candidateCount=10、LLM 0.6/本地 0.4、真实过程文案、计时刷新与动画时间、appVersion=10.0.0 | `BJ.config.llm` / Node UMD |
| `src/data/profile.js` | 林知夏、4 个版本、默认空白本场意图 | `me/defaultParticipation` |
| `events.js` | 10 个活动、8 家虚构公司、轮播及演示现场统计 | `events/companies/heroes/live` |
| `people-catalog.js` | 60 人独立编写的姓名、职位、行业、技能、资源与个人简介 | `peopleCatalog` |
| `people.js` | 15 字段档案、2–3 个不同可见范围版本、主题相关的活动参与和不同意图 | `people`；隐私、空意图、未签到、拒绝招呼等边界数据 |
| `ai-people.js` | 18位独立AI创业者/工程师，追加后共78人；p49–p66按人物表分配；3个隐私版本、4场AI/创业活动 | 技术及合作条件各不同，employment进入本场意图；18份兴趣休闲简介；按稳定ID配置签到、聊天与资本场成员 |
| `dating-people.js` | 按头像文字设定补齐78人性别/出生年份；新增可选交友版；24人明确公开（男女各12）；休闲主题场次为主，林知夏默认关闭 | 原职业版本均去除交友字段 |
| `job-details.js`、`jobs.js` | 16 个职位的独立要求、标签、福利、JD、活动和招聘/内推联系人 | `jobDetails/jobs`；列表显示筛选数 / 总数 |

上述数据均标注 DEMO DATA。未使用照片的 12 人显示首字；照片失败时也显示首字，不重复借用别人的照片。活动宣传总人数是演示值，实际推荐池按本地参会者计算。

## 核心层与后端

| 文件 | 公开接口 / 职责 | 依赖 |
| --- | --- | --- |
| `src/core/matcher.js` | UMD `create` → `project/parseIntent/score/rank/mmr/reason/similarity/matches`；project严格投影形状、缺版本空profile；MMR选人后按最终分数稳定排序；rank不返回完整人物 | matching、synonyms、reasons |
| `dating.js` | `parse/intent/ready/eligible/score/reasons/grounded/safe`；双向同意、单身/性别/年龄及偏好硬筛选；生活与兴趣计分，职业权重0；理由引用双方公开证据 | dating config；职业路径剔除敏感字段 |
| `dating-settings.js` | `migrate/enable/format/editValue/read`；旧存储默认关闭，仅当前场次授权、结构化偏好编辑 | dating；前端与测试共享 |
| `intent-tools.js` | guard/merge/empty/tags/toggle/allowed；关键词兜底、缺失字段合并、按公开字段计数、点选、回退前硬过滤 | dating、intent config |
| `store.js` | `createStore` → `get/update/toggle/clone/loadFailed/loadError`；读取失败和写入失败事件含错误 detail | localStorage、app.storageKey |
| `service.js` | `rank/participants/attendance/me/publicPerson/directory/datingInfo`；`careerProjection/jobFit/referralSameEvent`；事件相关人数与兴趣；attendance只返回签到优先的公开投影与登记/签到数 | engine、store、data、config |
| `llm-schema.js` | 职业模式要求姓名加完整行业/技能/offer/合作条件；交友模式校验双方公开生活证据与fitReason≤60字、前后端双向硬筛选；输出“您”转“你”；微信是/为/号、QQ是、vx为等脱敏；reason40/icebreaker20字；重复/不可修复只移除单条，dropped与结果必须构成完整ID集合 | matcher、reasonPolicy；前后端共用 |
| `llm-client.js` | UMD `create/fuse/errorCode/diagnostic/metadata`；部分结果过滤被移除候选，全空诚实降级；实际fetch前裁剪，onRequest提供真实起点/模型，meta校验与白名单、bypass参数，外部signal、具名错误、health失败重试协商；意图返回intent/engine/error；merge保留本地dating/性别；checkVersion/compatibility检测旧版本，旧版本dating禁止重排 | schema、engine、llm config |
| `progressive.js` | UMD `create` → `begin/read/recall/request/settle/get/elapsed/dispose`；idle→reading→recalled→llm-pending→done/cached/failed；等待隐藏排名，失败才显示本地行；离线local无请求 | 横幅与data-phase统一读phase |
| `router.js` | `start/go/path/refresh`；hash 路由、页面清理 | DOM |
| `src/app.js` | 组装 `BJ.ctx`，注入 service、llm、UI，设置主题及错误提示 | 上述模块 |
| `server/config.js` | 读取 `.env.local`，环境变量优先；不输出配置秘密 | Node fs/path |
| `server/llm.js` | `createLLM({config,fetchImpl,logger})` → `rerank/intent`；模板、总时间预算、并发上限、隐私校验后缓存；meta真实model/耗时/缓存日期/请求号，bypass显式重算 | schema、prompts、原生 fetch |
| `server/upstream.js` | Responses请求；reasoning low、max_output_tokens=2600；仅网络失败重试一次；不支持reasoning时明确记录并移除该参数重发 | 不记录完整提示词、Key或上游原始错误 |
| `server/cache.js` | 内存TTL、容量淘汰、并发合并与订阅者取消；最后等待方退出时中止上游；成功结果副本；bypass跳过命中与共享，旧请求不覆盖较新缓存 | TTL默认300000ms、上限64条 |
| `server/cache-versions.js` | 匹配/词表/本地理由的显式版本号；不序列化配置模块，避免函数丢失或循环引用错误 | 对应规则变更时提升版本；policy.version单独加入缓存键 |
| `server/error-log.js` | HTTP、LLM、listen统一安全错误出口；关联id/操作/error/code/时长，跨层不重复日志；可附数字HTTP码或安全causeCode | 不记录原始错误message、提示词、Key |
| `server/prompt-input.js` | 隐私白名单之后精简重复文本；去除所有签到/聊天/公开意图标记，本地操作状态只作缓存键 | 仅公开字段、必要意图及数值分数 |
| `server/reason-policy.js` | 不合格理由逐条本地重算，记录具名回退；按姓名与固定字数预算选完整证据；可用可见职称/城市区分，仍重复或不可修复只移除该候选并记录ID | matcher、reasonPolicy、schema |
| `server/listen.js` | EADDRINUSE自动顺延，统一错误日志含底层causeCode，打印并打开实际URL | PORT起始8787，PORT_ATTEMPTS默认10，最高100 |
| `server/index.js` | `createServer`；静态白名单，`GET /api/health`、`POST /api/llm/rerank`、`POST /api/llm/intent` | 原生 http；仅绑定 127.0.0.1 |
| `prompts/rerank.md`、`prompts/rerank-dating.md`、`prompts/intent.md` | 可编辑模板；公开证据与输出结构约束；输入文本仅作数据 | server/llm.js 模板替换 |
| `启动演示.bat`、`.env.example` | 启动服务并打开浏览器；无密钥配置示例 | Node 24 |

服务器默认60秒超时、并发2，浏览器增加2秒传输余量。在线等待只展示真实读取数、候选数、模型评估和POST起点计时；完成才显示Top5与服务端meta，缓存明示年龄并可强制重算。失败显示本地结果及重试。file直接本地，无思考态。缓存键包含活动、意图/公开投影、候选集合/状态、本地分/操作状态、模型/提示词、匹配与理由策略。取消传播到上游；只记录关联id、时长、具名错误和数字HTTP状态，不记录Key/提示词/错误原文。HTTP请求先合并Buffer再解码UTF-8，维持100000字节上限。

第5轮：所有HTTP拒绝与LLM校验/未配置/忙/超时均经过统一日志出口；相同请求跨层只记一次错误。取消用AbortSignal.reason显式区分LLM_ABORTED与LLM_TIMEOUT，真实连接断开测试直接断言日志。缓存只引用规则版本，不再把配置模块对象做stringify。原有公开投影、MMR选人后降序、头像及离线机制不变。

技术需求使用公开skills的覆盖率，在need中权重0.78；合作方式、To B/C、时间、报酬与入职状态逐项比较，冲突乘0.35、未公开乘0.8；行业和城市也参与双向评分。所有系数集中在matching.js，隐藏字段不参与。详见技术切换和兼职/全职冲突测试。

静态托管仅允许 index.html、src、assets，不提供 `.env.local`、server、prompts、docs。前后端白名单排除 contact/website 等联系方式；这是本地演示代理，不能替代生产服务的鉴权与服务端档案授权。

## UI 与页面

| 文件 / 路由 | 职责与交互 | 依赖 / 配置 |
| --- | --- | --- |
| `src/ui/icons.js` | 自绘 1.5px 线性 SVG；科技、休闲、创业、求职、交友五个版本图标不同 | 无外部图标库 |
| `components.js` | HTML 转义、图片/头像、首字占位、标签、按钮、空状态、装饰二维码；头像 eager 加载 | copy、assets、icons |
| `overlays.js` | modal、prompt、toast、焦点管理与 Esc | UI |
| `person.js` | 名片、公开字段、操作、详情；使用投影，不需要完整档案 | service、engine、store |
| `attendees.js` | 统一活动人数文案/头像墙/小头像；只消费attendance投影，hover与图片都受visibleFields限制 | service、app上限、copy.events |
| `intent-editor.js` | 设置页解析胶囊、常见标签和模式切换，删除性别/年龄同步原文，版本提示 | intentTools、service.commonTags、config.intent |
| `match-process.js` | 真实阶段与候选头像、服务端meta、缓存年龄、从请求起点的秒数；不推进阶段 | progressive、llm.process配置 |
| `search.js` | Ctrl+K/⌘K，自然语言解析优先调用 LLM；全局目录使用每人的一个实际场次投影，详情保持同一场次 | llm、service.directory、matcher |
| `shell.js` | 顶部导航、搜索、城市、通知、页脚 | app、copy |
| `pages/events.js` · `#/events` | 轮播、分类/城市、排行榜、按资料推荐活动、4人真实头像叠放及登记/签到数 | service、events |
| `pages/event-detail.js` · `#/events/:id` | 活动详情、日程、实际签到/登记人数、24人公开头像墙与剩余数、本场名片浮层、报名入口 | service |
| `pages/join.js` · `#/events/:id/join` | 名片版本、意图解析与手动标签、隐私选项、实时预览；迟到的解析结果不会覆盖手动编辑；页面离开/换步骤中止解析；交友意图给出公开授权提示，可拒绝 | llm、store、copy.join |
| `pages/match.js` · `#/events/:id/match` | 真实阶段思考→精排融合→MMR选人→分数降序；失败才显示本地Top5；meta与重算/重试；页面级try/catch；AbortError归类、保留安全code并记录活动/相位/固定诊断消息；标题同步实际人数；重算/离开abort；离线不调用；保留选择与操作状态；交友专用fitReason、实际人数与备选活动，缓存快照纳入当前公开授权 | service、llm、progressive、copy.match |
| `pages/discover.js` · `#/discover` | 推荐、同场、想认识我、看过我；话题过滤、详情、收藏 | service、engine、store |
| `pages/jobs.js` · `#/jobs/:id?` | 真实筛选数量、不同职位匹配度、JD、与职位活动关联的内推；匹配与投递共用 careerProjection | service、jobs、jobFilters |
| `pages/cards.js` · `#/me` | 基础资料、版本增删改名、字段排序与开关、保存、主题、分享 | fields、store |
| `pages/live.js` · `#/live/:id` | 深色现场大屏、需求条、匿名动态、演示二维码 | live、copy |

样式文件在 `assets/css/`，按基础、组件、壳层及页面拆分。1440px 和 1024px 检查，无横向溢出；姓名后不显示名片版本标签。字号、布局、暖白与 Bonjour 风格保持原有设计。

## 验证

| 文件 | 验证范围 | 命令 |
| --- | --- | --- |
| `tests/matcher.test.js` | 双向匹配、隐私、MMR、权重切换、空意图、筛选、fresh | `node --test tests` |
| `tests/data.test.js` | 78 人、10 活动、16 职位、ID/外键/版本完整性、66 张头像路径及文件内容唯一 | 同上 |
| `tests/round2.test.js` | 默认分数区分、唯一公开证据理由、coverage/reach、动作降权、8 画像固定阈值、主题构成 | 同上 |
| `tests/service-store.test.js` | jobFit/投递一致性、空要求、同场关系、loadFailed/detail、全局投影目录、HTML 转义 | 同上 |
| `tests/llm.test.js` | 可注入 fetch 捕获上游 payload、schema、隐私白名单、超时、并发、网络重试、融合、意图、HTTP 边界 | 同上 |
| `tests/round3.test.js` | 技术切换、行业偏好、兼职/全职冲突、扩展字段隐私、18人数据、渐进状态与过期请求 | 同上 |
| `tests/llm-cache.test.js` | 缓存命中/TTL/容量/并发/失败不缓存、reasoning兼容、incomplete拒绝 | 同上 |
| `tests/round4-client.test.js` | 原始档案实际fetch白名单、严格project、离线不请求、错误码/相位、取消、降序、18人独立数据 | 同上 |
| `tests/round4-server.test.js` | 理由修复/日志、上游状态、UTF-8分块、端口顺延、操作后缓存失效、共享取消/槽释放 | 同上 |
| `tests/round5.test.js` | 仅兴趣回退/技能前四字拒绝、微信QQ扩展写法、称呼统一、实际上游清洗、全出口日志去重、真实断开日志、函数/循环配置及监听失败原因 | 同上 |
| `tests/round6.test.js` | 长姓名/长证据与完整问句、无姓名去重/单条移除/部分融合、可配置合作规则/否定、反向就业因子、数据反序稳定性、AbortError日志及直接上游取消 | 同上 |
| `tests/round7.test.js` | 真实状态/时钟、失败离线、meta透传/拒绝伪元信息、bypass及在途旧结果隔离、实际计算人数、活动投影/隐藏头像与职位 | 同上 |
| `tests/dating.test.js`、`dating-llm.test.js` | 交友解析/否定、双向条件/隐藏字段拒绝、78人授权数据、迁移/拒绝、职业不变、实际fetch隐私、fitReason回退/长度/证据、离线降级 | `node --test tests` |
| `scripts/eval-dating.js`、`eval-dating-scenarios.js` | 3组本地+真实LLM交友画像，事先固定检查；追加报告与回退数、请求号 | `node scripts/eval-dating.js` |
| `scripts/browser-round8.py` | 独立实例自动顺延端口，授权/拒绝、真实2人和5人精排、人数不足、字段开关、file离线 | `py -3 scripts/browser-round8.py` |
| `scripts/eval-scenarios.js`、`eval-ai-scenarios.js` | 10 个独立测试画像与3项技术切换，事先固定阈值 | 确定性检查纳入 tests |
| `scripts/eval-match.js` | 真实 LLM 与本地双引擎 Top5、命中与隐私检查、通过率 | `node scripts/eval-match.js`；`--local` 禁用真实调用 |
| `scripts/eval-latency.js`、`eval-report.js`、`eval-storage.js` | 参数对照、措辞/展示降序/严格证据/称呼检查、理由回退统计、每场景证据文件、回退与单条移除统计 | docs/evals/round-6/ |
| `scripts/browser-round2.py` | 真 Chromium file/HTTP、真实引擎标识、照片、动作、职位、图标、XSS、1024px | `py -3 scripts/browser-round2.py`（需先启动服务） |
| `scripts/browser-round3.py` | 真Chromium渐进精排、等待中交互、缓存、注入超时、file离线、1024px与新增意图标签 | `py -3 scripts/browser-round3.py --url http://127.0.0.1:8788/` |
| `scripts/browser-round4.py` | 自行启动/停止所属服务；端口顺延、真实渐进精排、页面reject、非法响应、离开取消、禁用LLM、实际停服降级、file | `py -3 scripts/browser-round4.py` |

第5轮历史输出：`docs/match-eval.md`、`docs/evals/round-5/`、`docs/tests-round5.txt`、`docs/lines-round5.json`、`docs/reviews/round-3/disposition.md`。第4轮评估归档为`docs/match-eval-round4.md`。本轮未改布局；历史浏览器证据保留于`docs/browser-round4.json`和`docs/screenshots/round-4/`，不冒称第5轮截图。端口顺延仍由Node测试复核，不结束占用端口的其他进程。

第6轮历史输出：`docs/match-eval.md`、`docs/evals/round-6/`、`docs/tests-round6.txt`、`docs/lines-round6.json`、`docs/reviews/final/disposition.md`。第5轮评估归档为`docs/match-eval-round5.md`。`py -3 scripts/browser-final.py`验证页面AbortError/普通错误、部分结果标题及file降级；截图在`docs/screenshots/final/`、结果在`docs/browser-final.json`。浏览器错误与部分响应为明确注入；真实模型证据来自独立13项评测。

第7轮：`match-process.css`定义黑细线圆环和亮黄轨道点，reduced-motion只保留静态位置的透明度脉冲；`attendees.css`定义头像墙/hover与卡片叠放。`py -3 scripts/browser-round7.py`为当前验收入口，旧轮次浏览器脚本保留历史相位契约。输出：`docs/verification-round7.md`、`docs/browser-round7.json`、`docs/server-round7.txt`、`docs/screenshots/round-7/`、`docs/tests-round7.txt`、`docs/lines-round7.json`。

行数命令：`py -3 "C:\Users\mi\Desktop\_skill_extract\项目skill\scripts\check_lines.py" .`。

第8轮：`docs/verification-round8.md`、`docs/browser-round8.json`、`docs/screenshots/round-8/`、`docs/evals/round-8/`、`docs/tests-round8.txt`、`docs/lines-round8.json`。3组交友画像本地与真实LLM均通过；未开放者不参与，人数不足不补齐。原8787用户服务保留，验收使用自动顺延的8788；更新后用户需重启自己的服务窗口加载新schema与提示词。

## 第9轮验收

`node --test tests`包含`round9.test.js`：默认空、旧意图/冲突性别、rank二次校验、版本不一致降级、真实HTTP健康版本、损坏召回过滤、标签统计/切换字段、8模板证据与长度。原职业分数回归用明确的professional-session测试夹具，避免把空白UI默认误当成职业需求。

`py -3 scripts/browser-round9.py`启动自己的8788实例：空白设置/标签点选删除、注入旧health和无mode意图后仍只显示男性、城市徒步真实LLM。记录`docs/browser-round9.json`、`docs/server-round9.txt`、`docs/screenshots/round-9/`、`docs/verification-round9.md`。版本在服务启动时固定，静态文件更新不会把旧进程冒称为新版。

## 演示边界

不包含真实账号、消息发送、招聘投递、扫码签到或语音识别。名片与操作状态保存在当前浏览器；file 与 HTTP 的存储域各自独立。大模型只辅助解析与重排，接口不可用时本地功能仍可完整使用。


## 第10轮：品牌、字体与首页轮播

| 模块 | 接口与职责 | 配置与验证 |
| --- | --- | --- |
| `src/config/app.js`、`copy.js` | 多多群岛品牌、标题、页脚、问候、分享示例域名；保留存储键 | `app.brand/title/description`；`src/app.js`同步文档元信息 |
| `src/config/carousel.js` | 三个标签、提示文案、5000ms间隔、450ms过渡、滑动阈值 | `BJ.config.carousel` / UMD |
| `src/core/carousel.js` | `sources(events,heroes,now)`、`wrap`、`create`；上海周边界、报名排序、标签切换重置索引 | `tests/carousel.test.js`，不修改输入活动 |
| `src/ui/carousel.js` | `BJ.mountCarousel(root,{groups,config,ui,isBlocked})`返回清理函数；侧卡、键盘、指示器、拖拽与触控，减少动态效果与暂停控制 | `pages/events.js`挂载；路由退出清理定时器与全局监听 |
| `assets/css/carousel.css` | 54%居中主图、两侧相邻图、可读遮罩、响应式与减少动态效果 | 参数化过渡时间 |
| `assets/css/base.css`及页面样式 | `--text-*`、`--weight-*`、`--leading-body`、深浅背景说明色；取消固定正文高度 | 1440/1024排版审计、最小13px |
| `scripts/browser-round10.py` | 自有端口实例、22张截图、字体/溢出/截断审计、鼠标/触控/键盘/自动切换、file入口 | `docs/browser-round10.json`、`docs/screenshots/round-10/` |

结果见 `docs/verification-round10.md`、`docs/tests-round10.txt`、`docs/lines-round10.json`；README包含启动方式、配置入口与日期边界说明。
