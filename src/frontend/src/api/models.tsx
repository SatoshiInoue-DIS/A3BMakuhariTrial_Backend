export type UploadRequest = {
    // file_name: string;
    // file_path: string;
    file_data:File;
}

export type UploadResponse = {
    answer: boolean;
    error?: string;
}

export type SevedFileRequest = {
    bot: string;
}

export type SevedFileResponse = {
    filename: string;
    creation_time: string;
    last_modified: string;
    size: number;
    deleted: boolean;
    deleted_time: string;
    error?: string;
}