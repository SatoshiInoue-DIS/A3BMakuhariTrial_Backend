import { 
    UploadRequest, UploadResponse,
    SevedFileRequest, SevedFileResponse, DeleteResponse
} from "./models";


const apiUrl = process.env.NEXT_PUBLIC_API_URL

//Azure Blob StorageとAzure AI Searchのインデックスに登録したドキュメントを削除する
export async function deleteApi(options: {filename: string}[], bot:string): Promise<DeleteResponse> {
    const response = await fetch(`${apiUrl}/delete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ options, bot: bot })
    });

    const parsedResponse: DeleteResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        const errorMessages = parsedResponse.map(res => res.error).filter(error => error !== undefined);
        throw Error(errorMessages.length > 0 ? errorMessages.join(", ") : "Unknown error");
    }

    return parsedResponse;
}

// ドキュメントをAzure Blob Storageに登録及びAzure AI Searchの検索インデックスに登録
export async function uploadApi(options: FormData): Promise<UploadResponse> {
    console.log(options)
    const response = await fetch(`${apiUrl}/upload`, {
        // multipart/form-dataを指定するとboundaryが消えるためformデータがうまく送信されないため、固定で指定する
        // ※node-fetch側でうまくContent-Typeは設定してくれるっぽい
        // https://qiita.com/akameco/items/dc61497ad16200c67b44
        method: "POST",
        body: options
    });

    const parsedResponse: UploadResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

// Azure Blob Storageに登録してあるドキュメント情報を取得する
export async function savedfileApi(options: SevedFileRequest): Promise<[]> {
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