import { ReactHTMLElement } from "react";

export type UploadRequest = {
    // file_name: string;
    // file_path: string;
    file_data:File;
}

export type UploadResponse = {
    answer: boolean;
    failed_files?: string[];
    error?: string;
}

export type DeleteResponse = {
    answer: boolean;
    failed_files?: string[];
    error?: string;
}

export type SavedFileRequest = {
    bot: string;
}

export type SavedFileResponse = {
    // check:  any;
    // filename: string;
    // creation_time: string;
    // last_modified: string;
    // size: number;
    // deleted: boolean;
    // deleted_time: string;
    // error?: string;
    filename: string;
    size: number;
    last_modified: string;
    delete: boolean | undefined;
    file_format: string[];
}
export type SavedFileResponse2 = {
    // check:  any;
    // filename: string;
    // creation_time: string;
    // last_modified: string;
    // size: number;
    // deleted: boolean;
    // deleted_time: string;
    // error?: string;
    filename: string;
    size: number;
    last_modified: string;
    delete: boolean | undefined;
    file_format: [string, JSX.Element];
}

export type DecodedToken = {
    iss: string;
    aud: string;
    exp: number;
    iat: number;
    sub: string;
    name: string;
    email: string;
};