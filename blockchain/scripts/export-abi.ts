import { promises as fs } from 'fs';
import path from 'path';

/*
  Simple ABI export script.
  Artifact location pattern (Hardhat default):
    ./artifacts/contracts/<ContractName>.sol/<ContractName>.json
  Copies only the `abi` field into ../../app/abis (adjust path as needed).
*/

const CONTRACTS = ['Factory','Router','Pair','TestToken'];

async function main() {
  const root = path.join(__dirname, '..');
  const artifactsRoot = path.join(root, 'artifacts', 'contracts');
  const target = path.join(root, '..', 'app', 'abis');
  await fs.mkdir(target, { recursive: true });

  for (const name of CONTRACTS) {
    // Attempt to locate artifact by scanning subfolders
    const globFolder = path.join(artifactsRoot, name + '.sol');
    const file = path.join(globFolder, name + '.json');
    try {
      const raw = await fs.readFile(file, 'utf8');
      const artifact = JSON.parse(raw);
      const abi = artifact.abi;
      await fs.writeFile(path.join(target, name + '.json'), JSON.stringify(abi, null, 2));
      console.log('Exported ABI for', name);
    } catch (e) {
      console.warn('Skipping', name, '— artifact not found yet');
    }
  }
  console.log('ABI export complete.');
}

main().catch(e => { console.error(e); process.exit(1); });
