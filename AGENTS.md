# AGENTS

## Deploy Rule

- When the user says `部署到服务器`, `部署一下`, `发到服务器`, or otherwise clearly asks to deploy the current frontend UI change in this repository, default to the frontend static-package deploy flow.
- Use `npm run deploy:ui` from the repo root as the primary deployment command.
- This deploy flow is frontend-only:
  - build Vite output to `dist-web`
  - sync current build artifacts into `web/`
  - clear stale files under `web/assets/` before packaging
  - package `web/*` into `.tools/react-ui-deploy.zip`
  - upload the zip and `.tools/react-ui-deploy-server.ps1` to `124.223.21.76`
  - deploy to `C:\erp\b2b-web`
  - verify the live site by checking the current asset hashes on `http://124.223.21.76:8081/` and `http://124.223.21.76:8081/mall.html`
  - verify `http://124.223.21.76:8081/api/admin/summary`
- Do not restart or redeploy the backend unless the user explicitly asks for backend or full-stack deployment.

## Deploy Notes

- The deploy key is `.tools/b2b_erp_deploy_key`.
- In this environment, OpenSSH may reject the key unless a temporary copy is created with restricted ACLs for the actual executing user. The repo script `.tools/deploy-react-ui.ps1` already handles this.
- Prefer the repo script over retyping ad hoc `scp`/`ssh` commands.
