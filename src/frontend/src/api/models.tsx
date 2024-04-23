export type UploadRequest = {
    // file_name: string;
    // file_path: string;
    file_data:File;
}

export type UploadResponse = {
    answer: boolean;
    error?: string;
}