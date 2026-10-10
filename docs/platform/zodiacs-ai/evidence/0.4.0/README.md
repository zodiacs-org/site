# 0.4.0 audit evidence

Captured on 7 October 2026 by Codex. Read together with
[AUDIT-0.4.0.md](../../AUDIT-0.4.0.md), which distinguishes observations from
blocked and unexecuted cases. No file here contains the preview access cookie,
share secret or quota credential.

| File | What it establishes |
| --- | --- |
| `ci.json` | All 20 Site Check jobs passed on `edb054868f20f6a82fe7f3fab5c4824aa070522e` |
| `deployment.json` | Existing project, READY bounded Preview deployment, exact stable alias and recorded source |
| `preview-build.json` | Exact runtime/window digests and private compiled-adapter differences; no claim that this is a full-site preview |
| `staging-acceptance.json` | 16 checks and seven tool calls against actual protected Vercel staging using the official MCP client |
| `staging-local-day.json` | Actual staging chose 7 October for Bangkok and 6 October for Los Angeles while UTC was 7 October; this is not an assistant-host test |
| `private-preview-starters.jpg` | The existing private ChatGPT identity displays the three requested 0.4 starters |
| `chatgpt-expired-connection.jpg` | Initial actual Mercury starter attempt returned an expired-connection notice |
| `chatgpt-expired-connection-current.jpg` | That notice remained after attempting normal reconnect |
| `claude-connector-block.json` | Redacted actual Claude setup sequence, owner approval and rejection of the unsupported cookie header |
| `claude-header-rejected.jpg` | Actual Claude rejection; private sidebar hidden, credential value masked by the UI |
| `portal-0.3.4-in-review.jpg` | Read-only portal observation: 0.3.4 in review, not published |
| `portal-0.3.4-mcp.jpg` | Read-only scan observation: old tool surface, verified domain and tools not live |
| `public-url-check.json` | Four listing links returned 200; the proposed new recording URL returned 404 |

No ChatGPT iPhone result, successful Claude conversation, successful 0.4
ChatGPT panel flow or new walkthrough is represented here. Older synthetic
panel drives and the 0.3.4 video do not fill those gaps. The staged horoscope
window is a frozen 7 October build; repeat tests with a current window later.
