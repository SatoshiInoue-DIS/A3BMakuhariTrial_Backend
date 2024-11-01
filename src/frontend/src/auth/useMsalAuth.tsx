import { useState, useEffect } from "react";
import { msalInstance, loginRequest } from "./msalConfig";
import { getLoginInfo } from "../api";

export const useMsalAuth = async () => {
    const [loginUser, setLoginUser] = useState<string | null>(null);

    useEffect(() => {
        // ウィンドウが定義されていない場合は早期リターン（サーバーサイドのレンダリング対策）
        if (typeof window === "undefined") return;

        const initializeMsal = async () => {
            try {
                await msalInstance.initialize();
            } catch (error) {
                setLoginUser("anonymous");
            }
        };
        const handleLogin = async () => {
            try {
                // MSALインスタンスの初期化を待つ
                await initializeMsal();
                // 1. handleRedirectPromise()を呼び出して、リダイレクト後のパラメータを処理
                const loginResponse = await msalInstance.handleRedirectPromise();

                if (loginResponse) {
                    // 2. アクセストークンを使用して、ユーザー情報を取得するなどの処理を行う
                    const accessToken = loginResponse.accessToken;
                    const response = await getLoginInfo(accessToken)
                    setLoginUser(response.name || "anonymous");
                } else {
                    // トークンがない場合はログインを開始する
                    await msalInstance.loginRedirect(loginRequest);
                }
            } catch (error) {
                setLoginUser("anonymous");
            }
        };

        handleLogin();
    }, []);

    return loginUser;
};
