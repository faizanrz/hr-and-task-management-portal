# Deploy Instructions (delete this file before pushing)

This folder contains a clean, scrubbed version of the FDC portal ready for public GitHub.

## What to do:

1. Move this folder to ~/Downloads/hr-and-task-management-portal
2. Delete this DEPLOY-INSTRUCTIONS.md file
3. git init && git branch -m main
4. git add . && git commit -m "Initial commit: HR & Task Management Portal"
5. gh repo create hr-and-task-management-portal --public --source=. --push

OR if the repo already exists on GitHub:
5. git remote add origin https://github.com/faizanrz/hr-and-task-management-portal.git
6. git push -u origin main

## What was scrubbed:
- All employee names/emails removed
- All API keys/secrets removed
- FDC branding replaced with generic "HR Portal" / "Your Company"
- BRIEF.md, .claude/, Sample UI Template excluded
- Seed/migration files with PII excluded
