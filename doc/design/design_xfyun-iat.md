# 讯飞 IAT 云函数接入设计

> 版本：v1.0
> 创建时间：2026-08-05
> 状态：待配置
> 最后更新：2026-08-05

## 接入结论

`cloudfunctions/asr` 使用讯飞 IAT WebSocket 接口：以 APIKey 与 APISecret 生成签名 URL，按 12,800 字节分帧上传 16k PCM，并在最终帧返回后合并识别文字。

## 环境变量

| 名称 | 用途 |
|---|---|
| `XFYUN_APP_ID` | 讯飞应用 ID |
| `XFYUN_API_KEY` | IAT APIKey |
| `XFYUN_API_SECRET` | IAT APISecret |

## 边界与失败处理

- 客户端不接触讯飞凭证，仅调用既有 `asr` 云函数。
- 云函数无论成功或失败都会删除对应云存储录音。
- 云函数使用 `ws` 依赖，部署时安装 `package.json` 中声明的依赖。
- 不再读取腾讯云 ASR 凭证或本地 `config.js`。

---

## 变更日志

- v1.0 创建：归档讯飞 IAT WebSocket、环境变量和音频清理设计（2026-08-05）。
