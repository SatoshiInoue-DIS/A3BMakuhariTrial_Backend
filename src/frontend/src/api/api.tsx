import { 
    UploadRequest, UploadResponse,
    SavedFileRequest, SavedFileResponse, DeleteResponse, DecodedToken
} from "./models";


const apiUrl = process.env.NEXT_PUBLIC_API_URL

export async function getLoginInfo(accessToken: string): Promise<DecodedToken> {
    try {
        const response = await fetch(`${apiUrl}/userinfo`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const userInfo: DecodedToken = await response.json();
        return userInfo;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Request timed out");
        }
        throw error; // その他のエラーはそのままスロー
    }
}

//Azure Blob StorageとAzure AI Searchのインデックスに登録したドキュメントを削除する
export async function deleteApi(options: {filename: string}[], bot:string, delete_id: string): Promise<DeleteResponse> {
    try {
        const response = await fetch(`${apiUrl}/delete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ options, bot: bot, delete_id: delete_id })
        });

        const parsedResponse: DeleteResponse = await response.json();
        if (response.status > 299 || !response.ok) {
            throw Error(parsedResponse.error || "Unknown error");
        }

        return parsedResponse;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Request timed out");
        }
        throw error; // その他のエラーはそのままスロー
    }
}

// ドキュメントをAzure Blob Storageに登録及びAzure AI Searchの検索インデックスに登録
export async function uploadApi(options: FormData): Promise<UploadResponse> {
    console.log("options:" + options)
    const requestId = options.get("upload_id") as string
    try {
        // 進行状況を確認する
        // checkProgress(requestId)
        const response = await fetch(`${apiUrl}/upload`, {
            // multipart/form-dataを指定するとboundaryが消えるためformデータがうまく送信されないため、固定で指定する
            // ※node-fetch側でうまくContent-Typeは設定してくれるっぽい
            // https://qiita.com/akameco/items/dc61497ad16200c67b44
            method: "POST",
            body: options,
        });
        
        const parsedResponse: UploadResponse = await response.json();
        if (response.status > 299 || !response.ok) {
            throw Error(parsedResponse.error || "Unknown error");
        }

        return parsedResponse;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Request timed out");
        }
        throw error; // その他のエラーはそのままスロー
    }
}

// タイムスタンプを使ったIDを生成する
export function generateId() {
        // 日本時間を取得
        const now = new Date();
        const utcOffset = now.getTimezoneOffset() * 60000; // 現在のタイムゾーンオフセット（ミリ秒）
        const jstOffset = 9 * 60 * 60 * 1000; // JST のオフセット（ミリ秒）
        const jstTime = new Date(now.getTime() + utcOffset + jstOffset);
    
        // 年、月、日、時間、分、秒を取得
        const year = jstTime.getFullYear();
        const month = String(jstTime.getMonth() + 1).padStart(2, '0');
        const day = String(jstTime.getDate()).padStart(2, '0');
        const hours = String(jstTime.getHours()).padStart(2, '0');
        const minutes = String(jstTime.getMinutes()).padStart(2, '0');
        const seconds = String(jstTime.getSeconds()).padStart(2, '0');
        const nowJST =  `${year}${month}${day}${hours}${minutes}${seconds}`;
    return `temp-${nowJST}`;
}

// 進行状況を確認する関数
export const checkProgress = (requestId: string, setProgress: (progress: number) => void): Promise<{ progress: number; isComp: boolean; failed_files: [] }> => {
    return new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
            try {
                const statusResponse = await fetch(`${apiUrl}/status/${requestId}`);
                const statusData = await statusResponse.json();
                
                // 進行状況を更新
                setProgress(Math.round(statusData.progress));
                //処理が完了したかどうか
                let idComp = statusData.isComp;
                // 処理が完了したらポーリング停止
                if (idComp) {
                    clearInterval(intervalId);
                    resolve({
                        progress: statusData.progress,
                        isComp: statusData.isComp,
                        failed_files: statusData.failed_files
                    });
                }
            } catch (error) {
                console.error("Error fetching progress:", error);
                // エラーが発生した場合もポーリングを停止
                clearInterval(intervalId);
                // Promiseを拒否
                reject(error);
            }
        }, 3000);  // 3秒ごとにポーリング
    });
};

// Azure Blob Storageに登録してあるドキュメント情報を取得する
export async function savedfileApi(options: SavedFileRequest): Promise<[]> {
    const response = await fetch(`${apiUrl}/savedfile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({options})
    });

    const parsedResponse: [] = await response.json();
    if (response.status > 299 || !response.ok) {
        // throw Error(parsedResponse.length > 0 ? parsedResponse[0].error || "Unknown error" :  "Unknown error");
    }

    return parsedResponse;
}

// Azure Blob Storageに登録してあるドキュメントを検索する
export async function searchfileApi(filename: string, bot:string,): Promise<[]> {
    const response = await fetch(`${apiUrl}/searchfile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            filename: filename,
            bot: bot
        })
    });

    const parsedResponse: [] = await response.json();
    if (response.status > 299 || !response.ok) {
        // throw Error(parsedResponse.length > 0 ? parsedResponse[0].error || "Unknown error" :  "Unknown error");
    }

    return parsedResponse;
}