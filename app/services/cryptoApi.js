import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * CoinGecko API Service - Shows ONLY Avalanche Ecosystem Tokens
 * API Key: CG-yBGPehgHHsHoKf6haCAaEAWf
 * Documentation: https://docs.coingecko.com/
 */

const COINGECKO_API_KEY = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
const baseUrl = process.env.NEXT_PUBLIC_CRYPTO_API_URL || 'https://api.coingecko.com/api/v3';

export const cryptoApi = createApi({
    reducerPath: 'cryptoApi',
    baseQuery: fetchBaseQuery({
        baseUrl,
        prepareHeaders: (headers) => {
            if (COINGECKO_API_KEY) {
                headers.set('x-cg-demo-api-key', COINGECKO_API_KEY);
            }
            headers.set('Accept', 'application/json');
            return headers;
        }
    }),
    endpoints: (builder) => ({
        // Get Avalanche ecosystem cryptocurrencies
        getCryptos: builder.query({
            query: (count) => ({
                url: '/coins/markets',
                params: {
                    vs_currency: 'usd',
                    category: 'avalanche-ecosystem', // CoinGecko's native Avalanche filter!
                    order: 'market_cap_desc',
                    per_page: count || 100,
                    page: 1,
                    sparkline: true,
                    price_change_percentage: '1h,24h,7d'
                }
            }),
            transformResponse: (response) => {
                console.log('CoinGecko API Response:', response);
                
                // Transform CoinGecko format to match our app's expected format
                return response.map(coin => ({
                    uuid: coin.id,
                    id: coin.id,
                    rank: coin.market_cap_rank || 0,
                    name: coin.name,
                    symbol: coin.symbol.toUpperCase(),
                    price: coin.current_price?.toString() || '0',
                    change: coin.price_change_percentage_24h?.toString() || '0',
                    change1h: coin.price_change_percentage_1h_in_currency?.toString() || '0',
                    change7d: coin.price_change_percentage_7d_in_currency?.toString() || '0',
                    marketCap: coin.market_cap?.toString() || '0',
                    '24hVolume': coin.total_volume?.toString() || '0',
                    sparkline: coin.sparkline_in_7d?.price || [],
                    supply: {
                        circulating: coin.circulating_supply?.toString() || '0',
                        total: coin.total_supply?.toString() || '0',
                        max: coin.max_supply?.toString() || '0'
                    },
                    iconUrl: coin.image,
                    coinrankingUrl: `https://www.coingecko.com/en/coins/${coin.id}`
                }));
            },
        }),
        
        // Get global market stats
        getStats: builder.query({
            query: () => '/global',
            transformResponse: (response) => {
                const data = response.data;
                return {
                    totalCoins: data.active_cryptocurrencies,
                    totalMarkets: data.markets,
                    totalMarketCap: data.total_market_cap?.usd?.toString() || '0',
                    total24hVolume: data.total_volume?.usd?.toString() || '0',
                    btcDominance: data.market_cap_percentage?.btc || 0,
                    ethDominance: data.market_cap_percentage?.eth || 0
                };
            },
        }),
        
        // Get specific coin details by CoinGecko ID
        getCryptoDetails: builder.query({
            query: (coinId) => ({
                url: `/coins/${coinId}`,
                params: {
                    localization: false,
                    tickers: true,
                    market_data: true,
                    community_data: true,
                    developer_data: false,
                    sparkline: true
                }
            }),
            transformResponse: (response) => {
                const coin = response;
                return {
                    uuid: coin.id,
                    id: coin.id,
                    symbol: coin.symbol?.toUpperCase() || '',
                    name: coin.name,
                    description: coin.description?.en || '',
                    iconUrl: coin.image?.large || coin.image?.small,
                    websiteUrl: coin.links?.homepage?.[0] || '',
                    price: coin.market_data?.current_price?.usd?.toString() || '0',
                    marketCap: coin.market_data?.market_cap?.usd?.toString() || '0',
                    '24hVolume': coin.market_data?.total_volume?.usd?.toString() || '0',
                    change: coin.market_data?.price_change_percentage_24h?.toString() || '0',
                    rank: coin.market_cap_rank || 0,
                    supply: {
                        circulating: coin.market_data?.circulating_supply?.toString() || '0',
                        total: coin.market_data?.total_supply?.toString() || '0',
                        max: coin.market_data?.max_supply?.toString() || '0'
                    },
                    allTimeHigh: {
                        price: coin.market_data?.ath?.usd?.toString() || '0',
                        timestamp: coin.market_data?.ath_date?.usd || ''
                    },
                    sparkline: coin.market_data?.sparkline_7d?.price || []
                };
            },
        }),
        
        // Get coin price history
        getCryptoHistory: builder.query({
            query: ({ coinId, timePeriod }) => {
                // Convert timePeriod to days for CoinGecko
                const daysMap = {
                    '1h': 1,
                    '3h': 1,
                    '12h': 1,
                    '24h': 1,
                    '7d': 7,
                    '30d': 30,
                    '3m': 90,
                    '1y': 365,
                    '3y': 1095,
                    '5y': 1825
                };
                const days = daysMap[timePeriod] || 7;
                
                return {
                    url: `/coins/${coinId}/market_chart`,
                    params: {
                        vs_currency: 'usd',
                        days: days,
                        interval: days === 1 ? 'hourly' : 'daily'
                    }
                };
            },
            transformResponse: (response) => {
                // Transform to match expected format
                const prices = response.prices || [];
                return {
                    change: 0, // Calculate if needed
                    history: prices.map(([timestamp, price]) => ({
                        price: price.toString(),
                        timestamp: Math.floor(timestamp / 1000)
                    }))
                };
            },
        }),
    }),
})

export const { 
    useGetCryptosQuery, 
    useGetStatsQuery,
    useGetCryptoDetailsQuery,
    useGetCryptoHistoryQuery
} = cryptoApi;