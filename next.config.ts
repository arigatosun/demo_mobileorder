// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',        // 出力先
  register: true,
  skipWaiting: true,
  // 以下、必要に応じてオプションを追加
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.jsの他の設定があればここに
  reactStrictMode: true,
}

module.exports = withPWA(nextConfig)
