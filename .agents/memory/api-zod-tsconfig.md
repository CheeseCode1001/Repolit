---
name: api-zod tsconfig DOM lib requirement
description: api-zod lib must include dom lib or File type from upload schema breaks compilation.
---

## Rule
`lib/api-zod/tsconfig.json` must include `"lib": ["es2022", "dom"]` in `compilerOptions`.

**Why:** Orval generates `zod.instanceof(File)` for `multipart/form-data` file fields. `File` is a DOM type — without `dom` in lib, `tsc --build` fails with `Cannot find name 'File'`. The base `tsconfig.base.json` only includes `es2022`.

**How to apply:** Whenever you add a file upload endpoint to the OpenAPI spec and re-run codegen, confirm `lib/api-zod/tsconfig.json` still has `"dom"` in its lib array.
