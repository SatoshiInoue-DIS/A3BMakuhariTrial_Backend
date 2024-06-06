/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Modeを有効にする
  reactStrictMode: true,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: "@svgr/webpack",
        },
      ],
    });
    return config;
  },
  // 静的サイトとしてエクスポートする設定を追加
  output: 'export',
  // Image Optimization APIを無効にする設定を追加
  images: {
    unoptimized: true,
  },
  // images: {
  //   disableStaticImages: true, // importした画像の型定義設定を無効にする
  // },
  // ルーティングのカスタマイズ
  // async rewrites() {
  //   return [
  //     { source: "/upload", destination: "/upload" }
  //   ];
  // }
};

export default nextConfig;
