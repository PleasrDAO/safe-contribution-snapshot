import { ethers } from 'ethers';
import { formatEther } from '@ethersproject/units';
import _ from 'lodash';

import {
  CEX_OVERRIDES,
  EXCLUDE_TRANSACTIONS,
  KNOWN_CEX_ADDRESSES,
  MANUAL_OVERRIDES,
} from './lib/transactions';
import {
  AUCTION_ENDED_IN_BLOCK,
  CONTRIBUTION_ADDRESS,
  BLOCKS_PER_CHUNK,
  SAFE_DEPLOYED_IN_BLOCK,
} from './lib/const';
import { snapshotFilename, readSnapshot, writeSnapshot, writeLedger } from './lib/io';
import { Ledger, Transaction, Snapshot } from './lib/types';

import { config } from 'dotenv';
config();

import { Command } from 'commander';
const program = new Command();

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_ENDPOINT as string);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processSnapshot(snapshot: Snapshot, outputFilename: string, override: boolean) {
  console.log(`Snapshot has ${Object.keys(snapshot.transactions).length} entries.`);

  const ledger: Ledger = {};

  const addVal = (address: string, val: ethers.BigNumber) => {
    const a = address.toLowerCase();
    ledger[a] = (ledger[a] ?? ethers.BigNumber.from(0)).add(val);
  };

  const handleContribution = (sender: string, val: ethers.BigNumber) => {
    console.log(`${sender} sent ${formatEther(val)} ETH`);
    addVal(sender, val);
  };

  const handleTransaction = (transaction: Transaction) => {
    if (EXCLUDE_TRANSACTIONS.has(transaction.hash)) {
      console.log('Exluding transaction', transaction.hash);
      return;
    }

    const overrideAddress = CEX_OVERRIDES[transaction.hash];
    const sender = overrideAddress ?? transaction.sender;
    const value = transaction.value;

    if (overrideAddress) {
      console.log(
        `remapping tx ${transaction.hash} for ${ethers.utils.formatEther(value)} ETH from ${
          transaction.sender
        } to ${overrideAddress}`,
      );
    }

    handleContribution(sender, value);
  };

  _.values(snapshot.transactions).forEach(handleTransaction);

  if (override) {
    for (const address in MANUAL_OVERRIDES) {
      const val = MANUAL_OVERRIDES[address];
      console.log(`overriding ${address} by ${formatEther(val)} ETH`);
      addVal(address, val);
    }

    for (const address of KNOWN_CEX_ADDRESSES) {
      const a = address.toLowerCase();
      const val = ledger[a] ?? ethers.BigNumber.from(0);
      console.log(`draining ${address} by ${formatEther(val)} ETH`);
      addVal(CONTRIBUTION_ADDRESS, val);
      delete ledger.a;
    }
  }

  console.log(`writing to ${outputFilename}`);
  console.log(
    'Total eth:',
    ethers.utils.formatEther(_.values(ledger).reduce((a, b) => a.add(b), ethers.BigNumber.from(0))),
  );
  writeLedger(outputFilename, ledger);
}

async function fetchTransactions(
  startBlock: number,
  toBlock: number,
  chunkSize: number,
  contractAddress: string,
) {
  const useLatest = toBlock == 0;
  const endBlock: number = useLatest ? await provider.getBlockNumber() : toBlock;
  const safe = new ethers.Contract(
    contractAddress,
    [`event SafeReceived(address indexed sender, uint256 value)`],
    provider,
  );
  const filter = safe.filters.SafeReceived();

  const filename = snapshotFilename(startBlock, useLatest ? 'latest' : endBlock, contractAddress);
  const snapshot = readSnapshot(filename);
  const fromBlock = snapshot.currentBlock || startBlock;

  console.log(`Snapshoting from ${fromBlock} to ${endBlock}`);

  const handleEvent = (event: ethers.Event) => {
    if (!event.args?.sender || !event.args?.value) {
      console.log(`Invalid event??`, event);
      return;
    }

    const sender = event.args.sender as string;
    const value = event.args.value as ethers.BigNumber;

    snapshot.transactions[event.transactionHash] = {
      hash: event.transactionHash,
      sender,
      value,
    };
  };

  for (let i = fromBlock; i <= endBlock; i = i + chunkSize) {
    const fromChunkNumber = i;
    const toChunkNumber = Math.min(fromChunkNumber + chunkSize - 1, endBlock);

    console.log(`checking in ${fromChunkNumber} => ${toChunkNumber}...`);

    try {
      const events = await safe.queryFilter(filter, fromChunkNumber, toChunkNumber);
      console.log(`got ${events.length} events in this set of blocks`);
      events.filter(Boolean).forEach(handleEvent);

      snapshot.currentBlock = toChunkNumber + 1;
      console.log(`set next to ${toChunkNumber + 1}`);

      writeSnapshot(filename, snapshot);
      await sleep(1400);
    } catch (error) {
      console.error(error);
      break;
    }
  }

  return snapshot;
}

async function main(
  startBlock: number,
  endBlock: number,
  chunkSize: number,
  contractAddress: string,
  outputFilename: string,
  override: boolean,
) {
  const snapshot = await fetchTransactions(startBlock, endBlock, chunkSize, contractAddress);
  await processSnapshot(snapshot, outputFilename, override);
}

const parseDec = (n: string) => parseInt(n, 10);

program.version('0.0.1');
program
  .option('-s, --start <block>', 'start block', parseDec, AUCTION_ENDED_IN_BLOCK + 1)
  .option('-e, --end <block>', 'end block', parseDec, 0)
  .option('--chunk <number>', 'blocks per chunk', parseDec, BLOCKS_PER_CHUNK)
  .option('-a, --address <address>', 'address', CONTRIBUTION_ADDRESS)
  .option('-o, --output <filename>', 'output filename', 'refund.csv')
  .option('--override', 'use manual overrides?', false);

program.parse(process.argv);

const options = program.opts();

console.log(options);
main(options.start, options.end, options.chunk, options.address, options.output, options.override)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
