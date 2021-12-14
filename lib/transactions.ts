import { BigNumber } from "@ethersproject/bignumber";

export const CEX_OVERRIDES: Record<string, string> = {
  // albatron9000#4542
  '0xe3f21f1be6131aab64509c4ccf91807446194548866bbbef363db458e0d57252':
    '0xE00Dc5eB53d376a50556f0039FDd3dA7dc83F06B',
  // avax_szn#2301
  '0x93d45d0c3c8acf3a1a10789fd2416d97a5419ec72d7ee625bccf884b306e9130':
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
    '0xa1C00d9B9d0979D58F06B6fc438ea5ff2836c669',
  // vitozhang.eth#8367
  '0x15a8bd82db8ab1f89735b3363450f58026bb1584e7945de7857ca6ea6dac1675':
    '0x89E200fB309dfea8577bAa5aBD9268de00E27F7d',
  // datwh0re#2006
  '0xef8fdbd3aa246ee78d04637a7ab099bacea814c4122e13328945582595b2bc12':
    '0xAeAE3050c45e4B013b08d532A842982609966945',
  // jack005#6109
  '0xfcf6af6008d668951dd7ba1c7fe875df959c1e769efa5ca96d907b60755a43d2':
    '0x42b70Cd9BE0fba250f7838e0b006C1c3560C42D9',
  // ysjlitt#8853
  '0x31febc4cd053a28fe0487997ae7d4103f71133a8514c6a2c2f668723c54e9969':
    '0x77080c88F9aBd8130866345Ef430EE99fAFcA73E',
  // sh#1070
  '0xe1781ce64dd72a412d525fb58bbfc03e5f2b987b2338bd1c4ddd1489300fc165':
    '0x027a7d4d4A28835Aae52CA7fA9FdDe04B46040F0',
};

// Exclude both the failed and successful auction refunds
export const EXCLUDE_TRANSACTIONS = new Set([
  '0xcfa584f6d072fd544a6f4e264eaededd4a5d3a0b842b3d3a6ff173f34682a698',
  '0xad60df9a9df45d471f0a49062c9b6651cbc5de69e3964a4487337daa67104c9e',
]);

export const KNOWN_MISSING_TRANSACTIONS = new Set([
  '0x34c2c9aaafa12c317f4489ec2947650ce4213e3b90e3c2ba2267d2b1281650e9',
  '0x3c39bc7e954109456b03a29c40c653a7e83f092ee4d2d272f34b6646a018cbe1',
]);

export const MANUAL_OVERRIDES: Record<string, BigNumber> = {
  // WETH contribution: https://etherscan.io/tx/0x70e3fafa676a4e98630f5bc402e1c672df46956fc652684119fe3a58e24234c0
  '0xbe3f4cd4839682b3d679abe579a655d8272cd24d': BigNumber.from('231600000000000000')
}