import { ethers } from 'ethers';

export type Ledger = Record<string, ethers.BigNumber>;
export type Transaction = {
  hash: string;
  sender: string;
  value: ethers.BigNumber;
};
export type Snapshot = {
  currentBlock?: number;
  transactions: Record<string, Transaction>;
};