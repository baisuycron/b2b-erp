# Design QA - 后台统一商城加载态

source visual truth path:
- C:\Users\Thunderobot\AppData\Local\Temp\codex-clipboard-f1b74e08-1d11-4fdd-a205-2410eca2b335.png

implementation screenshot path:
- unavailable

viewport:
- desktop admin page, matching the supplied 2048 x 1080 reference context

state:
- 后台页面数据请求进行中
- 页面显示与商城一致的全屏半透明遮罩、白色加载卡片、蓝色环形进度和“加载中...”文案
- 页面内不再同时显示 Ant Design 表格点状加载动画

full-view comparison evidence:
- blocked. The source screenshot is available, but both the in-app browser and Chrome bridge are unavailable because the Windows browser runtime cannot start in the current sandbox.

focused region comparison evidence:
- blocked. The intended focused region is the centered loading card and spinner; no updated rendered screenshot could be captured.

**Findings**
- [P2] Rendered visual comparison is unavailable
  Location: 后台全局加载遮罩。
  Evidence: the implementation reuses the exact shared component and existing CSS classes used by the mall, and the production build passes, but no browser screenshot is available.
  Impact: component parity is verified at source and build level; pixel-level placement cannot be formally confirmed in this environment.
  Fix: open the local or deployed admin page, trigger a page load, and capture the loading state when browser automation is available.

**Open Questions**
- None.

**Implementation Checklist**
- Extract the mall loading mask into a shared component.
- Render the shared loading mask from the admin root while page data is loading.
- Disable duplicate table/card loading spinners during the global loading state.
- Preserve local loading feedback for login and action buttons.
- Run the Vite production build.

**Patches made since previous QA pass**
- Added `src/shared/GlobalLoadingMask.tsx`.
- Updated `src/mall/main.tsx` to consume the shared component.
- Updated `src/admin/main.tsx` to render the shared component and suppress duplicate page-level spinners.
- Vite production build passed.

final result: blocked
