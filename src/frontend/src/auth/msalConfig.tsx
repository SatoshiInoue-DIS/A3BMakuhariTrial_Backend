import { PublicClientApplication, Configuration, LogLevel } from "@azure/msal-browser";

const msalConfig: Configuration = {
    auth: {
        clientId: process.env.NEXT_PUBLIC_CLIENT_ID ?? "",
        authority: process.env.NEXT_PUBLIC_AUTHORITY,
        redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI,
        navigateToLoginRequestUrl: false,
    },
    cache: {
        cacheLocation: "sessionStorage", // キャッシュが保存される場所
        storeAuthStateInCookie: false, // IE11 または Edge で問題が発生する場合はこれを「true」に設定
    },
    system: {
        allowNativeBroker: false, // WAM ブローカーを無効
        // loggerOptions: {
        //     loggerCallback: (level, message, containsPii) => {
        //         if (containsPii) {
        //             return;
        //         }
        //         switch (level) {
        //             case LogLevel.Error:
        //                 console.error(message);
        //                 return;
        //             case LogLevel.Info:
        //                 console.info(message);
        //                 return;
        //             case LogLevel.Verbose:
        //                 console.debug(message);
        //                 return;
        //             case LogLevel.Warning:
        //                 console.warn(message);
        //                 return;
        //         }
        //     }
        // }
    }
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginRequest = {
    scopes: [
        process.env.NEXT_PUBLIC_CLIENT_ID + "/.default"
    ]
};
// export default msalConfig;
