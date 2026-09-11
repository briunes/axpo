# Merge and production authorization

- Never automatically merge branches or pull requests, especially into `main` or production.
- Only perform a merge when Bruno explicitly instructs you to perform that specific merge. “Send to prod,” “release,” “deploy,” and similar requests do not authorize a merge.
- Branch creation, analysis, implementation, checks, and pull request preparation are allowed within the requested scope. Stop before merging unless explicitly instructed to merge.
- Never bypass this rule through direct pushes, auto-merge, deployments, or promotions into production. Production actions require explicit authorization for the specific action.
- Read this rule before taking action. Past merge approval does not authorize future merges.
