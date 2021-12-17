import { stringify } from 'csv/sync';
import Path from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';
import _ from 'lodash';

import { Ledger, Transaction, Snapshot } from './types';

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

export function snapshotFilename(
  startBlock: number,
  endBlock: number | string,
  contractAddress: string,
) {
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

export function writeLedger(filepath: string, ledger: Ledger) {
  writeFileSync(
    filepath,
    stringify(
      _.shuffle(
        Object.keys(ledger).map((sender) => ({ sender, value: ledger[sender].toString() })),
      ),
      {
        header: true,
      },
    ),
  );
}
