// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "./Pair.sol";

contract Factory {
    mapping(address => mapping(address => address)) public getPair; // tokenA => tokenB => pair
    address[] public allPairs;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint index);

    function allPairsLength() external view returns (uint) { return allPairs.length; }

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO");
        require(getPair[token0][token1] == address(0), "EXISTS");
        pair = address(new Pair(token0, token1));
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate reverse mapping
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
