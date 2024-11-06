import "@/pages/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import ReactDOM from "react-dom/client";
import React from "react";

import NoPage from "./NoPage";
import Layout from "./Layout";


function App({ Component, pageProps }: AppProps) {
    // 存在しないURLにアクセスした場合
    if (Component === NoPage) {
        return <Component {...pageProps} />;
    }
    return (
        <>
            <Head>
                <meta charSet="UTF-8" />
                <link rel="icon" type="image/x-icon" href="/favicon.ico" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>ドキュメント管理</title>
            </Head>
            <Layout>
                <Component {...pageProps} />
            </Layout>
        </>
    );
};

export default App;