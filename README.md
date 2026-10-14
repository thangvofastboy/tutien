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

Every push to `main` (a merged PR) gets the next patch tag (`v0.1.0`, `v0.1.1`, ...) from `.github/workflows/tag.yml`. For a minor or major bump, push the tag by hand: `git tag v0.2.0 && git push origin v0.2.0`.

## Develop

```sh
claude plugin validate .
claude plugin test .
claude --plugin-dir .   # try it in a session
```
