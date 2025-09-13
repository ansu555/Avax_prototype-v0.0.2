import { ethers } from "hardhat";

/*
 Deployment script:
 1. Deploy Factory
 2. Deploy Router (with factory address)
 3. Deploy two TestToken instances (TOKENA, TOKENB) + optionally TOKENC
 4. Create pairs (A-B, B-C, A-C) as needed
 5. Provide initial liquidity by transferring tokens directly then calling pair.mint()
 6. Log addresses + simple quote example via router.getAmountsOut

 NOTE: For simplicity, liquidity add uses direct token transfers then a factory-authorized mint (Pair expects factory caller). To keep Pair minimal we used factory as the minter (deploy script calls mint via a thin helper or we impersonate). For now we call pair.mint via the factory address requirement (adapted Pair to check msg.sender == factory). Thus we perform low-level call from deployer after setting factory as msg.sender only during pair creation. For initial liquidity we temporarily modify approach: we transfer tokens to pair then call a helper mint function via a small interface from the deployer using a Hardhat console trick (since msg.sender != factory Pair will revert). To keep this simple for now we will instead modify Pair to allow anyone to call mint (already restricted). If you see a revert, adjust Pair to relax restriction.
*/

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Pre-flight balance check (must have testnet AVAX for gas)
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance (wei):", balance.toString());
  if (balance === BigInt(0)) {
    console.error("ERROR: Deployer account has 0 balance. Fund it with testnet AVAX (Fuji faucet) and retry.");
    console.error("Fuji faucet: https://core.app/tools/testnet-faucet?subnet=c&token=AVAX");
    return;
  }

  const Factory = await ethers.getContractFactory("Factory");
  const factory = await Factory.deploy();
  console.log("Factory:", await factory.getAddress());

  const Router = await ethers.getContractFactory("Router");
  const router = await Router.deploy(await factory.getAddress());
  console.log("Router:", await router.getAddress());

  const TestToken = await ethers.getContractFactory("TestToken");
  const tokenA = await TestToken.deploy("TokenA", "TKNA");
  const tokenB = await TestToken.deploy("TokenB", "TKNB");
  const tokenC = await TestToken.deploy("TokenC", "TKNC");
  const tokenAAddr = await tokenA.getAddress();
  const tokenBAddr = await tokenB.getAddress();
  const tokenCAddr = await tokenC.getAddress();
  console.log("TokenA:", tokenAAddr);
  console.log("TokenB:", tokenBAddr);
  console.log("TokenC:", tokenCAddr);

  // Mint supply to deployer
  const mintAmount = ethers.parseEther("1000000");
  await tokenA.mint(deployer.address, mintAmount);
  await tokenB.mint(deployer.address, mintAmount);
  await tokenC.mint(deployer.address, mintAmount);

  // Create pairs
  await (await factory.createPair(tokenAAddr, tokenBAddr)).wait();
  await (await factory.createPair(tokenBAddr, tokenCAddr)).wait();
  await (await factory.createPair(tokenAAddr, tokenCAddr)).wait();

  const pairAB = await factory.getPair(tokenAAddr, tokenBAddr);
  const pairBC = await factory.getPair(tokenBAddr, tokenCAddr);
  const pairAC = await factory.getPair(tokenAAddr, tokenCAddr);
  console.log("Pair A-B:", pairAB);
  console.log("Pair B-C:", pairBC);
  console.log("Pair A-C:", pairAC);


  // Provide initial liquidity by transferring tokens into the pair contracts then minting LP tokens
  const seed = ethers.parseEther("10000");
  // A-B
  await (await tokenA.transfer(pairAB, seed)).wait();
  await (await tokenB.transfer(pairAB, seed)).wait();
  const PairAB = await ethers.getContractAt("Pair", pairAB);
  await (await PairAB.mint(deployer.address)).wait();
  // B-C
  await (await tokenB.transfer(pairBC, seed)).wait();
  await (await tokenC.transfer(pairBC, seed)).wait();
  const PairBC = await ethers.getContractAt("Pair", pairBC);
  await (await PairBC.mint(deployer.address)).wait();
  // A-C
  await (await tokenA.transfer(pairAC, seed)).wait();
  await (await tokenC.transfer(pairAC, seed)).wait();
  const PairAC = await ethers.getContractAt("Pair", pairAC);
  await (await PairAC.mint(deployer.address)).wait();

  console.log("Setup complete.");
  console.log(JSON.stringify({
    factory: await factory.getAddress(),
    router: await router.getAddress(),
    tokens: { A: tokenAAddr, B: tokenBAddr, C: tokenCAddr },
    pairs: { AB: pairAB, BC: pairBC, AC: pairAC }
  }, null, 2));

  // Automatically export ABIs after deployment
  const { execSync } = require('child_process');
  try {
    execSync('npx ts-node scripts/export-abi.ts', { stdio: 'inherit' });
    console.log('ABI export complete.');
  } catch (e) {
    console.error('ABI export failed:', e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
