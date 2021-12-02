import { ethers } from 'ethers';
import { config } from 'dotenv';
import { formatEther } from '@ethersproject/units';
import { parse, stringify } from 'csv/sync';
import { readFileSync, writeFileSync, existsSync } from 'fs';

config();

const SAFE_DEPLOYED_IN_BLOCK = 13724221;
const FREEROSSDAO_SAFE_ADDRESS = '0xc102d2544a7029f7BA04BeB133dEADaA57fDF6b4';
const BLOCKS_PER_CHUNK = 100;
const SNAPSHOT_FILENAME = 'snapshot.csv';
const NEXT_BLOCK_INFO = 'next.json';

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_ENDPOINT as string);
const safe = new ethers.Contract(
  FREEROSSDAO_SAFE_ADDRESS,
  [`event SafeReceived(address indexed sender, uint256 value)`],
  provider,
);

type Snapshot = Record<string, ethers.BigNumber>;

function readFromSnapshot(): Snapshot {
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

function writeToSnapshot(snapshot: Snapshot) {
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

function getNextBlock() {
  if (!existsSync(NEXT_BLOCK_INFO)) return SAFE_DEPLOYED_IN_BLOCK;
  return JSON.parse(readFileSync(NEXT_BLOCK_INFO).toString()).next;
}

function setNextBlock(next: number) {
  writeFileSync(NEXT_BLOCK_INFO, JSON.stringify({ next }));
}

async function main() {
  const snapshot = readFromSnapshot();
  console.log(`Snapshot has ${Object.keys(snapshot).length} entries.`);

  const fromBlock = getNextBlock();
  const toBlock = await provider.getBlockNumber();

  console.log(`Snapshotting from ${fromBlock} to ${toBlock}`);
  const filter = safe.filters.SafeReceived();

  const handleContribution = (sender: string, value: ethers.BigNumber) => {
    console.log(`${sender} sent ${formatEther(value)} ETH`);
    snapshot[sender] = (snapshot[sender] ?? ethers.BigNumber.from(0)).add(value);
  };

  for (let i = fromBlock; i <= toBlock; i = i + BLOCKS_PER_CHUNK) {
    const fromChunkNumber = i;
    const toChunkNumber = Math.min(fromChunkNumber + BLOCKS_PER_CHUNK - 1, toBlock);

    console.log(`checking in ${fromChunkNumber} => ${toChunkNumber}...`);

    const events = await safe.queryFilter(filter, fromChunkNumber, toChunkNumber);
    events.filter(Boolean).forEach((event: ethers.Event) => {
      if (!event.args?.sender || !event.args?.value) {
        console.log(`Invalid event??`, event);
        return;
      }

      handleContribution(event.args.sender as string, event.args.value as ethers.BigNumber);
    });

    setNextBlock(toChunkNumber + 1);
  }

  writeToSnapshot(snapshot);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
