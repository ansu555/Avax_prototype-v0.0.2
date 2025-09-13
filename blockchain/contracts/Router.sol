// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./Factory.sol";

interface IMinimalERC20 {
    function balanceOf(address owner) external view returns (uint);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);
    function approve(address spender, uint value) external returns (bool);
}

contract Router {
    Factory public immutable factory;

    error PairNotFound();
    error InsufficientOutput();

    constructor(address _factory) {
        factory = Factory(_factory);
    }

    function getPair(address tokenA, address tokenB) public view returns (address) {
        return factory.getPair(tokenA, tokenB);
    }

    // Given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) public pure returns (uint amountOut) {
        require(amountIn > 0, 'INSUFFICIENT_INPUT');
        require(reserveIn > 0 && reserveOut > 0, 'INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn * 997; // 0.3% fee
        uint numerator = amountInWithFee * reserveOut;
        uint denominator = reserveIn * 1000 + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts) {
        require(path.length >= 2, 'PATH_SHORT');
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        for (uint i; i < path.length - 1; i++) {
            address pair = getPair(path[i], path[i+1]);
            if (pair == address(0)) revert PairNotFound();
            (uint112 r0, uint112 r1,) = Pair(pair).getReserves();
            (uint reserveIn, uint reserveOut) = path[i] < path[i+1] ? (r0, r1) : (r1, r0);
            amounts[i+1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to
    ) external returns (uint[] memory amounts) {
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, 'SLIPPAGE');
        // pull the tokens from user on first hop
        IMinimalERC20(path[0]).transferFrom(msg.sender, getPair(path[0], path[1]), amountIn);
        _swap(amounts, path, to);
    }

    function _swap(uint[] memory amounts, address[] memory path, address _to) internal {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            address pair = getPair(input, output);
            if (pair == address(0)) revert PairNotFound();
            (address token0,) = input < output ? (input, output) : (output, input);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            address to = i < path.length - 2 ? getPair(output, path[i + 2]) : _to;
            Pair(pair).swap(amount0Out, amount1Out, to);
        }
    }
}
