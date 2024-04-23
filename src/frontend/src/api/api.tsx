import { UploadRequest, UploadResponse } from "./models";

export async function uploadApi(options: FormData): Promise<UploadResponse> {
    console.log(options)
    const response = await fetch("http://localhost:5000/upload", {
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