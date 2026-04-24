# Examples

This folder contains two onboarding scripts:

- [demo-short.min.md](/Users/peyton/Workspace/00_高优先级项目/VeoGen/projs/examples/demo-short.min.md): the smallest self-contained script. No reference images are required.
- [demo-short.md](/Users/peyton/Workspace/00_高优先级项目/VeoGen/projs/examples/demo-short.md): the same story with bundled placeholder reference images under [`refs/`](/Users/peyton/Workspace/00_高优先级项目/VeoGen/projs/examples/refs/README.md).

Recommended first runs:

```bash
npm run plan -- --script projs/examples/demo-short.min.md
npm run render -- --script projs/examples/demo-short.min.md --dry-run
```

If you want to inspect reference-image behavior, switch to `demo-short.md`.
