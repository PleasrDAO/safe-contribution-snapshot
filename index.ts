import { ethers } from 'ethers';
import { config } from 'dotenv';
import { formatEther } from '@ethersproject/units';
import { parse, stringify } from 'csv/sync';
import { readFileSync, writeFileSync, existsSync } from 'fs';

config();

const CEX_OVERRIDES: Record<string, string> = {
  // albatron9000#4542
  '0xe3f21f1be6131aab64509c4ccf91807446194548866bbbef363db458e0d57252':
    '0xE00Dc5eB53d376a50556f0039FDd3dA7dc83F06B',
  // avax_szn#2301
  '93d45d0c3c8acf3a1a10789fd2416d97a5419ec72d7ee625bccf884b306e9130':
    '0x7AC258e14B6f580a9f2C556022898c813BaD2036',
  // aliciakatz#6843
  '0xcc458f154221c31f14b03772421837cce2969a3d38f81147927f32ef8ec9b85a':
    '0x599Af7f3Eb2Af4f39A8174f1fab2cca09ff11a5d',
  // jonathanbroly#4332 TODO
  '0x073d9da34276075d7344df9f5b62e1785302b8b7da062efc62e2eec1b214eeb8':
    '0x89C14066d9b643BFF11148ddBCc6c32F8E07C3FA',
  // qasak#4459
  '0x2b3772b50ffddc076c74105c787f44d7a0f009932a3814f9f4909a312935dff9':
    '0xb6d84d05b7facFA94FAFB2f40d849B80A3f34FB7',
  // billy_72#4443
  '0xeb05dd124e0cbc16f2352fab345f55d475e51f88752777d2ebf530024edea2d8':
    '0xbF4B0bcDcC7DC29AB19f89d08b3a139893CdCFE6',
};

const SAFE_DEPLOYED_IN_BLOCK = 13724221;
const AUCTION_ENDED_IN_BLOCK = 13770208;
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const toBlock = AUCTION_ENDED_IN_BLOCK;

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

    try {
      const events = await safe.queryFilter(filter, fromChunkNumber, toChunkNumber);
      console.log(`got ${events.length} events in this set of blocks`);
      events.filter(Boolean).forEach((event: ethers.Event) => {
        if (!event.args?.sender || !event.args?.value) {
          console.log(`Invalid event??`, event);
          return;
        }

        const sender = CEX_OVERRIDES[event.transactionHash] ?? (event.args.sender as string);
        const value = event.args.value as ethers.BigNumber;

        if (CEX_OVERRIDES[event.transactionHash]) {
          console.log(
            `remapping tx ${event.transactionHash} for ${ethers.utils.formatEther(
              value,
            )} ETH from ${event.args.sender} to ${CEX_OVERRIDES[event.transactionHash]}`,
          );
        }

        handleContribution(sender, value);
      });

      console.log(`setting next to ${toChunkNumber + 1}`);
      setNextBlock(toChunkNumber + 1);

      await sleep(2000);
    } catch (error) {
      console.error(error);
      break;
    }
  }

  console.log('writing to snapshot.csv');
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
