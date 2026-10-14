# tutien

Claude Code mod. `/tutien update` fetches the newest `v*` tag, checks it out and runs `/reload-plugins`.

## Install

`/tutien update` moves a git clone, so install from a clone (not straight from GitHub):

```sh
git clone git@github.com:thangvofastboy/tutien.git ~/.claude/tutien
claude plugin marketplace add ~/.claude/tutien
claude plugin install tutien@tutien
```

The clone sits on a detached HEAD after each update; develop in a separate checkout.

## Release

1. Tăng `version` trong `.claude-plugin/plugin.json` (ví dụ `0.1.1` → `0.1.2`) trong nhánh của bạn.
2. Merge vào `main`. Workflow `.github/workflows/tag.yml` tạo và ký tag `v<version>` (bỏ qua nếu tag đã có).
3. Đăng ký tag lên server (server chỉ nhận hai bản mới nhất):
   `curl -X POST https://tutien.thang-vo.workers.dev/admin/releases -H "authorization: Bearer <ADMIN_TOKEN>" -H "content-type: application/json" -d '{"tag":"v<version>"}'`
4. Người chơi cập nhật: bản cài từ marketplace dùng `/plugin update tutien` rồi `/reload-plugins`; bản clone dùng `/tutien update`.

## Develop

```sh
claude plugin validate .
claude plugin test .
claude --plugin-dir .   # try it in a session
```
