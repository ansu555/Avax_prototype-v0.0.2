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

  const { createPublicClient, http } = require('viem')
  const { avalancheFuji } = require('viem/chains')
  const TestTokenAbi = require('../app/abis/TestToken.json')

  const RPC = env.RPC_URL_FUJI || env.NEXT_PUBLIC_RPC_URL_FUJI || env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc'
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) })
  
  const TOKEN_A = env.NEXT_PUBLIC_TOKEN_A
  const TOKEN_B = env.NEXT_PUBLIC_TOKEN_B

  try {
    console.log('TOKEN_A owner:', await publicClient.readContract({
      address: TOKEN_A,
      abi: TestTokenAbi,
      functionName: 'owner'
    }))
    
    console.log('TOKEN_B owner:', await publicClient.readContract({
      address: TOKEN_B,
      abi: TestTokenAbi,
      functionName: 'owner'
    }))
  } catch (e) {
    console.error('Owner check error:', e.message || e)
  }
})()