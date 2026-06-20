# B2B ERP Agent Notes

## Deployment Safety

- When the user clearly asks to deploy this repository, first decide whether the current change is frontend-only or includes backend changes.
- For frontend UI deployments, use the repo frontend deploy flow instead of manually zipping `web/*`.
- Prefer `npm run deploy:ui` from the repo root when npm is available. In this Windows environment, if npm is not on PATH, run `.tools\deploy-react-ui.ps1` directly.
- The frontend deploy flow is frontend-only:
  - builds Vite output to `dist-web`
  - syncs current build artifacts into `web/`
  - clears stale files under `web/assets/`
  - packages `web/*` into `.tools\react-ui-deploy.zip`
  - uploads the zip and `.tools\react-ui-deploy-server.ps1` to `124.223.21.76`
  - deploys to `C:\erp\b2b-web`
  - verifies the live site asset hashes on `http://124.223.21.76:8081/` and `http://124.223.21.76:8081/mall.html`
  - verifies `http://124.223.21.76:8081/api/admin/summary`
- Do not restart or redeploy the backend for frontend-only changes unless the user explicitly asks for backend or full-stack deployment.
- If backend files changed and the user asks to deploy the repository, deploy backend with `.tools\deploy-current-backend.ps1` before deploying the frontend.

## Deploy Notes

- The deploy key is `.tools\b2b_erp_deploy_key`.
- In this environment, OpenSSH may reject the key unless a temporary copy is created with restricted ACLs for the actual executing user. The repo deploy scripts already handle this.
- Prefer repo scripts over ad hoc `scp`/`ssh` commands.

## Safe Package Notes

- `scripts\build-safe-ui-package.ps1` exists as a marker-validated UI package helper for legacy static admin/mall sources.
- Use it only when intentionally deploying that legacy safe-package path. Do not mix it with the normal Vite `dist-web -> web` deployment in the same deploy.
