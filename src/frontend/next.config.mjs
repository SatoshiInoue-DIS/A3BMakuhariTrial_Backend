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
  output: 'export',
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
