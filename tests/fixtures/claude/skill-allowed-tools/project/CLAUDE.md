# Skill allowed-tools fixture project

The folder is never trusted (no `hasTrustDialogAccepted` record), so this fixture
also covers the `-p`/headless case of K7.

`.claude/settings.json` denies bare `Write`, which the deployer skill also
pre-approves through `allowed-tools`: the deny wins and the pre-approval has
nothing to approve (K8). Its `Bash(git push:*)` entry has no such deny and
stays an ordinary K6/K7 finding, so both branches live in one golden.
