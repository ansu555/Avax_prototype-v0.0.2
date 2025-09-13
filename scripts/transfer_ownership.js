(async()=>{
  const fs = require('fs')
  const path = require('path')
  const envPath = path.join(process.cwd(), '.env.local')
  let env = {}
  try {
    const raw = fs.readFileSync(envPath, 'utf8')
    raw.split(/\n/).forEach(l => {
      const m = l.trim()
      if (!m || m.startsWith('#')) return
      const i = m.indexOf('=')
      if (i === -1) return
      const k = m.substring(0, i).trim()
      const v = m.substring(i + 1).trim()
      env[k] = v
    })
  } catch (e) {
    console.error('read env error', e.message || e)
    process.exit(1)
  }

  const { createPublicClient, createWalletClient, http } = require('viem')
  const { avalancheFuji } = require('viem/chains')
  const { privateKeyToAccount } = require('viem/accounts')
  const TestTokenAbi = require('../app/abis/TestToken.json')

  const RPC = env.RPC_URL_FUJI || env.NEXT_PUBLIC_RPC_URL_FUJI || env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) })
  
  // Current account (the one you want to transfer ownership TO)
  const currentPrivateKey = env.PRIVATE_KEY.startsWith('0x') ? env.PRIVATE_KEY : '0x' + env.PRIVATE_KEY
  const currentAccount = privateKeyToAccount(currentPrivateKey)
  
  console.log('Current account (new owner):', currentAccount.address)
  console.log('Token owner should be: 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf')
  console.log('')
  console.log('To transfer ownership, you need the private key for: 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf')
  console.log('')
  console.log('Options:')
  console.log('1. If you have the original deployer private key, replace PRIVATE_KEY in .env.local temporarily')
  console.log('2. Or provide it as OWNER_PRIVATE_KEY in .env.local')
  console.log('3. Or run this script with the owner key as an argument')
  console.log('')

  // Check if owner private key is provided
  const ownerPrivateKey = env.OWNER_PRIVATE_KEY || process.argv[2]
  
  if (!ownerPrivateKey) {
    console.log('No owner private key provided. Exiting.')
    console.log('Usage: node scripts/transfer_ownership.js <owner_private_key>')
    console.log('Or add OWNER_PRIVATE_KEY=<key> to .env.local')
    process.exit(1)
  }

  const normalizedOwnerKey = ownerPrivateKey.startsWith('0x') ? ownerPrivateKey : '0x' + ownerPrivateKey
  const ownerAccount = privateKeyToAccount(normalizedOwnerKey)
  
  console.log('Using owner account:', ownerAccount.address)
  
  const ownerWalletClient = createWalletClient({
    account: ownerAccount,
    chain: avalancheFuji,
    transport: http(RPC)
  })

  const TOKEN_A = env.NEXT_PUBLIC_TOKEN_A
  const TOKEN_B = env.NEXT_PUBLIC_TOKEN_B

  try {
    // Transfer ownership of TOKEN_A
    console.log('Transferring TOKEN_A ownership...')
    const transferA = await ownerWalletClient.writeContract({
      address: TOKEN_A,
      abi: TestTokenAbi,
      functionName: 'transferOwnership',
      args: [currentAccount.address]
    })
    console.log('TOKEN_A transfer tx:', transferA)

    // Transfer ownership of TOKEN_B
    console.log('Transferring TOKEN_B ownership...')
    const transferB = await ownerWalletClient.writeContract({
      address: TOKEN_B,
      abi: TestTokenAbi,
      functionName: 'transferOwnership',
      args: [currentAccount.address]
    })
    console.log('TOKEN_B transfer tx:', transferB)

    console.log('Waiting for transactions to confirm...')
    await publicClient.waitForTransactionReceipt({ hash: transferA })
    await publicClient.waitForTransactionReceipt({ hash: transferB })
    
    console.log('Ownership transferred successfully!')
    console.log('New owner:', currentAccount.address)
    
  } catch (e) {
    console.error('Transfer error:', e.message || e)
  }
})()