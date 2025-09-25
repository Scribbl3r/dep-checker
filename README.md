# 📦 dep-checker

A small CLI tool to **check, repair, and update project dependencies** for Node.js projects.

It can:

-   Detect **missing dependencies** between `package.json` and `node_modules`.
-   Find and optionally update **outdated dependencies**.
-   Detect and patch **vulnerabilities** (via `npm audit`, `yarn audit`, or `pnpm audit`).
-   Completely reset dependencies (`node_modules` + lockfile) and reinstall from scratch.

---

## 🚀 Installation

Clone or copy this repository, then make sure the script is executable:

```bash
chmod +x dep-check-script.js
```

You can then run it with Node.js:

```bash
node ./dep-check-script.js
```

## ⚙️ Usage

Base command

```bash
node dep-check-script.js [options]
```

Options `--fix ` Skip prompts and delete node_modules + lockfile before reinstalling everything.

`--npm` / `--yarn` / `--pnpm` Specify the package manager to use. If not provided, the script will ask interactively.

## 🧑‍💻 Interactive mode

If you run the script without --fix, you’ll be prompted with:

```pgsql
? what do you want this script to do ?
  ❯ check if there is any dependency missing
    search for outdated & vulnerabilities
    something is wrong, reinstall everything
```

Objectives scan → Compare installed vs declared dependencies. If mismatched, reinstall.

search → Detect outdated deps and vulnerabilities. You’ll be prompted to update.

clean → Delete and reinstall everything.

## 🔍 Examples

1. Scan for missing dependencies with npm

```bash
node dep-check-script.js --npm
```

Select scan when prompted.

2. Search outdated & vulnerabilities with Yarn

```bash
node dep-check-script.js --yarn
```

Select search when prompted. You’ll see a table of outdated dependencies and can choose whether to update them.

3. Force reinstall with pnpm

```bash
node dep-check-script.js --fix --pnpm
```

This will:

Remove node_modules and the lockfile

Reinstall everything with pnpm install

## 🛠️ Internals

Dependency checks → Runs npm ls, yarn list, or pnpm list.

Outdated checks → Uses npm outdated, yarn outdated, or pnpm outdated.

Vulnerabilities → Uses audit (npm audit, yarn audit, or pnpm audit).

Reinstall → Deletes node_modules and lockfile, then runs the chosen manager’s install.

## ⚠️ Notes

pnpm audit requires an extra package @pnpm/audit (the script will prompt to install it).

Only direct dependencies are updated automatically. Indirect deps require parent updates.

This tool is intended as a helper for developers, not as a replacement for official package managers.

```

```
