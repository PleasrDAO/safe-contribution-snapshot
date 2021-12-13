import { parse, stringify } from 'csv/sync';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';
import { SAFE_DEPLOYED_IN_BLOCK } from './const';

const SNAPSHOT_FILENAME = 'snapshot.csv';
const NEXT_BLOCK_INFO = 'next.json';

type Snapshot = Record<string, ethers.BigNumber>;

export function readFromSnapshot(): Snapshot {
  if (!existsSync(SNAPSHOT_FILENAME)) return {};

  const data = parse(readFileSync(SNAPSHOT_FILENAME), { columns: true }) as {
    sender: string;
    value: string;
  }[];

  return data.reduce<Snapshot>((memo, { sender, value }) => {
    memo[sender] = ethers.BigNumber.from(value);
    return memo;
  }, {});
}

export function writeToSnapshot(snapshot: Snapshot) {
  writeFileSync(
    SNAPSHOT_FILENAME,
    stringify(
      Object.keys(snapshot).map((sender) => ({ sender, value: snapshot[sender].toString() })),
      {
        header: true,
      },
    ),
  );
}

export function getNextBlock() {
  if (!existsSync(NEXT_BLOCK_INFO)) return SAFE_DEPLOYED_IN_BLOCK;
  return JSON.parse(readFileSync(NEXT_BLOCK_INFO).toString()).next;
}

export function setNextBlock(next: number) {
  writeFileSync(NEXT_BLOCK_INFO, JSON.stringify({ next }));
}
