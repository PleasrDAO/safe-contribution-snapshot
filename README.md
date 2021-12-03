# safe-contribution-snapshot

> Snapshots ETH contributions to a Gnosis Safe

- [x] snapshots from source block
- [x] resumable from block
- [x] merges / de-dupes from previous snapshot
- [x] is mostly solid-state
- [ ] support WETH ?

```
ts-node index.ts
```

- Gnosis Safe Creation Block: `13724221`

### Notes

Not perfectly solid-state. If it crashes, run it from the beginning.
