import { parse, stringify } from 'csv/sync';
import Path from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';
import _ from 'lodash';

const SNAPSHOT_FILENAME = 'snapshot.csv';
const NEXT_BLOCK_INFO = 'next.json';

// type Snapshot = Record<string, ethers.BigNumber>;
type Transaction = {
  hash: string;
  sender: string;
  value: ethers.BigNumber;
};
type Snapshot = {
  currentBlock?: number;
  transactions: Record<string, Transaction>;
};

function serializeTransaction(transaction: Transaction): string {
  return JSON.stringify({
    ...transaction,
    value: transaction.value.toString(),
  });
}

function deserializeTransaction(transaction: string): Transaction {
  const data = JSON.parse(transaction);
  return {
    ...data,
    value: ethers.BigNumber.from(data.value),
  };
}

function serializeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify({
    ...snapshot,
    transactions: _.mapValues(snapshot.transactions, serializeTransaction),
  });
}

function deserializeSnapshot(snapshot: string): Snapshot {
  const data = JSON.parse(snapshot);
  return {
    ...data,
    transactions: _.mapValues(data.transactions, deserializeTransaction),
  };
}

export function snapshotFilename(startBlock: number, endBlock: number, contractAddress: string) {
  return Path.join(__dirname, '../output', `${contractAddress}-${startBlock}-${endBlock}.json`);
}

export function readSnapshot(filename: string) {
  if (!existsSync(filename)) {
    return {
      currentBlock: undefined,
      transactions: {},
    };
  }

  return deserializeSnapshot(readFileSync(filename).toString());
}

export function writeSnapshot(filename: string, snapshot: Snapshot) {
  writeFileSync(filename, serializeSnapshot(snapshot));
}

// export function readFromSnapshot(): Snapshot {
//   if (!existsSync(SNAPSHOT_FILENAME)) return {};

//   const data = parse(readFileSync(SNAPSHOT_FILENAME), { columns: true }) as {
//     sender: string;
//     value: string;
//   }[];

//   return data.reduce<Snapshot>((memo, { sender, value }) => {
//     memo[sender] = ethers.BigNumber.from(value);
//     return memo;
//   }, {});
// }

// export function writeToSnapshot(snapshot: Snapshot) {
//   writeFileSync(
//     SNAPSHOT_FILENAME,
//     stringify(
//       Object.keys(snapshot).map((sender) => ({ sender, value: snapshot[sender].toString() })),
//       {
//         header: true,
//       },
//     ),
//   );
// }

// export function getNextBlock() {
//   if (!existsSync(NEXT_BLOCK_INFO)) return undefined;
//   return JSON.parse(readFileSync(NEXT_BLOCK_INFO).toString()).next;
// }

// export function setNextBlock(next: number) {
//   writeFileSync(NEXT_BLOCK_INFO, JSON.stringify({ next }));
// }
