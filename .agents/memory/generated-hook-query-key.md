---
name: Orval generated hook queryKey requirement
description: Orval React Query hooks require explicit queryKey in query options alongside enabled.
---

## Rule
When using Orval-generated query hooks with a custom `query` options object (e.g. `{ enabled: !!user }`), you must ALSO pass `queryKey`:

```ts
useGetProfile({ query: { enabled: !!user, queryKey: getGetProfileQueryKey() } })
```

**Why:** The generated `UseQueryOptions` type marks `queryKey` as required. TypeScript errors with `Property 'queryKey' is missing`. Simply passing `enabled` is not enough.

**How to apply:** Every time you use a generated query hook with a `query` object, also import and pass the matching `getGet*QueryKey(args)` helper.
