// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

/*
 * Minimal constant product AMM pair (inspired by Uniswap V2) with 0.30% fee.
 * - No flash loan / fee-on-transfer handling.
 * - No price oracle accumulators.
 * - For demo/testnet only.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

contract Pair {
    string public constant name = "LP Token";
    string public constant symbol = "LPT";
    uint8 public constant decimals = 18;

    address public immutable token0;
    address public immutable token1;
    address public factory;

    uint112 private reserve0; // uses single storage slot, accessible via getReserves
    uint112 private reserve1;
    uint32  private blockTimestampLast;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    error Forbidden();
    error InsufficientLiquidity();
    error InsufficientInput();
    error InsufficientOutput();

    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);
    event Mint(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
    event Swap(address indexed sender, uint amountIn0, uint amountIn1, uint amountOut0, uint amountOut1, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
        factory = msg.sender;
    }

    // --- ERC20 (LP) ---
    function _mint(address to, uint value) internal {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }
    function _burn(address from, uint value) internal {
        balanceOf[from] -= value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    function approve(address spender, uint value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
    function transfer(address to, uint value) external returns (bool) {
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }
    function transferFrom(address from, address to, uint value) external returns (bool) {
        uint allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) allowance[from][msg.sender] = allowed - value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }

    // --- Reserves ---
    function getReserves() public view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function _update(uint balance0, uint balance1) private {
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }

    // --- Mint / Burn liquidity ---
    function mint(address to) external returns (uint liquidity) {
        // NOTE: relaxed access (was: require(msg.sender == factory)). Suitable ONLY for testnet/demo.
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint amount0 = balance0 - _reserve0;
        uint amount1 = balance1 - _reserve1;
        if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidity();

        if (totalSupply == 0) {
            liquidity = sqrt(amount0 * amount1);
        } else {
            liquidity = min((amount0 * totalSupply) / _reserve0, (amount1 * totalSupply) / _reserve1);
        }
        if (liquidity == 0) revert InsufficientLiquidity();
        _mint(to, liquidity);
        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1, to);
    }

    function burn(address to) external returns (uint amount0, uint amount1) {
        uint liquidity = balanceOf[address(this)];
        amount0 = (liquidity * reserve0) / totalSupply;
        amount1 = (liquidity * reserve1) / totalSupply;
        _burn(address(this), liquidity);
        _safeTransfer(token0, to, amount0);
        _safeTransfer(token1, to, amount1);
        (uint balance0, uint balance1) = (IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)));
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // --- Swap ---
    function swap(uint amountOut0, uint amountOut1, address to) external {
        if (amountOut0 == 0 && amountOut1 == 0) revert InsufficientOutput();
        (uint112 _reserve0, uint112 _reserve1,) = getReserves();
        if (amountOut0 >= _reserve0 || amountOut1 >= _reserve1) revert InsufficientLiquidity();

        if (amountOut0 > 0) _safeTransfer(token0, to, amountOut0);
        if (amountOut1 > 0) _safeTransfer(token1, to, amountOut1);

        uint balance0 = IERC20(token0).balanceOf(address(this));
        uint balance1 = IERC20(token1).balanceOf(address(this));
        uint amountIn0 = balance0 > (_reserve0 - amountOut0) ? balance0 - (_reserve0 - amountOut0) : 0;
        uint amountIn1 = balance1 > (_reserve1 - amountOut1) ? balance1 - (_reserve1 - amountOut1) : 0;
        if (amountIn0 == 0 && amountIn1 == 0) revert InsufficientInput();

        // 0.3% fee
        uint balance0Adjusted = (balance0 * 1000) - (amountIn0 * 3);
        uint balance1Adjusted = (balance1 * 1000) - (amountIn1 * 3);
        if (balance0Adjusted * balance1Adjusted < uint(_reserve0) * uint(_reserve1) * 1000**2) revert InsufficientInput();

        _update(balance0, balance1);
        emit Swap(msg.sender, amountIn0, amountIn1, amountOut0, amountOut1, to);
    }

    // --- Helpers ---
    function _safeTransfer(address token, address to, uint value) private {
        (bool s, bytes memory d) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(s && (d.length == 0 || abi.decode(d,(bool))), 'TRANSFER_FAILED');
    }

    function min(uint a, uint b) private pure returns (uint) { return a < b ? a : b; }
    function sqrt(uint y) private pure returns (uint z) { if (y > 3) { z = y; uint x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } } else if (y != 0) { z = 1; } }
}
